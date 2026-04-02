import numpy as np
import tensorflow as tf
import keras
from sklearn.utils.class_weight import compute_class_weight
import os

def compute_class_weights(y_train, n_classes):
    """
    Computes balanced class weights to counteract class imbalance during training.

    Weights are calculated as n_samples / (n_classes * class_count) per class.
    Any class absent from y_train is assigned a neutral weight of 1.0 to prevent
    Keras from raising a KeyError during model.fit().

    Args:
        y_train   : np.ndarray, shape (N,) — integer class labels for the training set
        n_classes : int — total number of classes (including any absent from y_train)

    Returns:
        class_weight_dict : dict {class_index: weight} for all classes 0..n_classes-1

    Raises:
        ValueError — if y_train is empty or n_classes < 1
    """

    # ------------------------------------------------------------------ #
    # Guard clauses                                                        #
    # ------------------------------------------------------------------ #
    if len(y_train) == 0:
        raise ValueError("y_train is empty")
    if n_classes < 1:
        raise ValueError(f"n_classes must be >= 1, got {n_classes}")

    labels_in_train = np.unique(y_train)
    missing_classes = set(range(n_classes)) - set(labels_in_train)
    if missing_classes:
        print(f"  [Warning] Classes absent from training set (weight set to 1.0): {missing_classes}")

    # ------------------------------------------------------------------ #
    # Compute weights for classes present in training data                #
    # ------------------------------------------------------------------ #
    weights_array = compute_class_weight(
        class_weight = "balanced",
        classes      = labels_in_train,
        y            = y_train,
    )

    # ------------------------------------------------------------------ #
    # Map to full class range; default 1.0 for any absent class           #
    # ------------------------------------------------------------------ #
    class_weight_dict = {i: 1.0 for i in range(n_classes)}
    for cls, w in zip(labels_in_train, weights_array):
        class_weight_dict[cls] = float(w)

    return class_weight_dict


def build_cnn_model(window_size, n_channels, n_classes, learning_rate=1e-3, dropout_rate=0.4):
    """
    Builds and compiles a 1D CNN optimised for deployment on the ESP32-S3.

    Architecture:
        Conv1D(32)  -> ReLU ->
        Conv1D(64)  -> ReLU ->
        MaxPool1D   -> Dropout ->
        Flatten     -> Dense(64) -> ReLU -> Dropout ->
        Dense(n_classes, softmax)

    Filter counts and dense width are kept small deliberately to stay within
    the ESP32-S3's 512 KB SRAM budget after INT8 quantisation (~1 byte/param).

    Args:
        window_size   : int   — number of timesteps per input window
        n_channels    : int   — number of sensor channels
        n_classes     : int   — number of output classes
        learning_rate : float — Adam learning rate. Default 1e-3.
        dropout_rate  : float — dropout probability applied after MaxPool and Dense.
                                Default 0.4.

    Returns:
        model : compiled keras.Model ready for model.fit()

    Raises:
        ValueError — if any dimension argument is < 1 or dropout_rate is out of range
    """

    # ------------------------------------------------------------------ #
    # Guard clauses                                                        #
    # ------------------------------------------------------------------ #
    if window_size < 1:
        raise ValueError(f"window_size must be >= 1, got {window_size}")
    if n_channels < 1:
        raise ValueError(f"n_channels must be >= 1, got {n_channels}")
    if n_classes < 2:
        raise ValueError(f"n_classes must be >= 2, got {n_classes}")
    if learning_rate <= 0:
        raise ValueError(f"learning_rate must be > 0, got {learning_rate}")
    if not (0.0 <= dropout_rate < 1.0):
        raise ValueError(f"dropout_rate must be in [0, 1), got {dropout_rate}")

    # ------------------------------------------------------------------ #
    # Input                                                               #
    # ------------------------------------------------------------------ #
    inputs = keras.Input(shape=(window_size, n_channels), name="sensor_input")

    # ------------------------------------------------------------------ #
    # Conv Block 1 — local feature detection                              #
    # ------------------------------------------------------------------ #
    x = keras.layers.Conv1D(
        filters     = 8,
        kernel_size = 3,
        padding     = "same",
        name        = "conv1d_1",
    )(inputs)
    x = keras.layers.ReLU(name="relu_1")(x)

    # ------------------------------------------------------------------ #
    # Conv Block 2 — higher-level feature composition                     #
    # ------------------------------------------------------------------ #
    x = keras.layers.Conv1D(
        filters     = 16,
        kernel_size = 3,
        padding     = "same",
        name        = "conv1d_2",
    )(x)
    x = keras.layers.ReLU(name="relu_2")(x)

    # ------------------------------------------------------------------ #
    # Pooling + regularisation                                            #
    # ------------------------------------------------------------------ #
    x = keras.layers.MaxPool1D(pool_size=2, name="maxpool")(x)
    x = keras.layers.Dropout(dropout_rate, name="dropout_1")(x)

    # ------------------------------------------------------------------ #
    # Classification head                                                 #
    # ------------------------------------------------------------------ #
    x = keras.layers.Flatten(name="flatten")(x)
    x = keras.layers.Dense(16, name="dense_1")(x)
    x = keras.layers.ReLU(name="relu_3")(x)
    x = keras.layers.Dropout(dropout_rate, name="dropout_2")(x)
    outputs = keras.layers.Dense(n_classes, activation="softmax", name="output")(x)

    # ------------------------------------------------------------------ #
    # Compile                                                             #
    # ------------------------------------------------------------------ #
    model = keras.Model(inputs=inputs, outputs=outputs, name="DrivingCNN")
    model.compile(
        optimizer = keras.optimizers.Adam(learning_rate=learning_rate),
        loss      = "sparse_categorical_crossentropy",
        metrics   = ["accuracy"],
    )

    # ------------------------------------------------------------------ #
    # Verification printout                                               #
    # ------------------------------------------------------------------ #
    model.summary()
    total_params = model.count_params()
    estimated_kb = total_params / 1024
    fits         = estimated_kb < 512
    print(f"\nTotal parameters     : {total_params:,}")
    print(f"Estimated INT8 size  : ~{estimated_kb:.1f} KB")
    print(f"ESP32-S3 SRAM (512 KB): {'✓ fits' if fits else '⚠ may be tight'}")

    return model


def save_model(model, output_dir, filename="driving_cnn.keras"):
    """
    Saves a trained Keras model to disk in the native .keras format.

    The .keras format stores architecture, weights, and optimizer state
    in a single file — suitable for resuming training or running inference.

    Args:
        model      : trained keras.Model
        output_dir : str — directory to save into (created if it doesn't exist)
        filename   : str — output filename. Should end in .keras. Default "driving_cnn.keras".

    Returns:
        save_path : str — absolute path to the saved model file

    Raises:
        ValueError — if filename does not end in .keras
    """

    # ------------------------------------------------------------------ #
    # Guard clauses                                                        #
    # ------------------------------------------------------------------ #
    if not filename.endswith(".keras"):
        raise ValueError(
            f"filename should end in '.keras' for the native Keras format, got '{filename}'"
        )
    os.makedirs(output_dir, exist_ok=True)

    # ------------------------------------------------------------------ #
    # Save                                                                #
    # ------------------------------------------------------------------ #
    save_path = os.path.join(output_dir, filename)
    model.save(save_path)

    # ------------------------------------------------------------------ #
    # Verification printout                                               #
    # ------------------------------------------------------------------ #
    file_size_kb = os.path.getsize(save_path) / 1024
    print(f"Saved Keras model → {save_path}")
    print(f"File size: {file_size_kb:.1f} KB")

    if file_size_kb < 1:
        print("Warning: file is unexpectedly small — verify the save completed correctly")

    return save_path
