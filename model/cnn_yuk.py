"""
Freight Driving Behavior Classfier

Architecture
- 1D Convolutional Neural Network 
- reference cnn.md 

Input: MPU6050 raw data (AccX, AccY, AccZ, GyroX, GyroY, GyroZ) @ ~1 Hz

Output:  4-class classification 

Classes: 
- 1 = Sudden Acceleration
- 2 = Sudden Right Turn
- 3 = Sudden Left Turn 
- 4 = Sudden Brake

TF model --> TFLite INT8 model for ESP32-S3

"""

 
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow import keras
from sklearn.model_selection import StratifiedGroupKFold, train_test_split

from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import (
    classification_report, confusion_matrix, ConfusionMatrixDisplay
)
 
# This interpreter replaces TFLite deprecated Interpreter
from ai_edge_litert.interpreter import Interpreter


# Reproducibility
SEED = 0
np.random.seed(SEED)
tf.random.set_seed(SEED)

# Configuration

WINDOW_SIZE   = 7       # Shortest event length (Sudden Brake = 7 rows)
HOP_SIZE      = 3       # Sliding window hop - overlap of 4
N_CHANNELS    = 6       # AccX, AccY, AccZ, GyroX, GyroY, GyroZ 
N_CLASSES     = 4       # 4 driving behaviors
BATCH_SIZE    = 16      # Small batch small dataset
MAX_EPOCHS    = 200
PATIENCE      = 15      # Early stopping patience (reduced to stop before overfitting)
LEARNING_RATE = 1e-3
 
# sensor_raw.csv
SENSOR_COLS = ["AccX", "AccY", "AccZ", "GyroX", "GyroY", "GyroZ"] # sensor_raw.csv
CLASS_NAMES = [
    "Sudden Accel",       # Original label 1 → index 0
    "Sudden Right Turn",  # Original label 2 → index 1
    "Sudden Left Turn",   # Original label 3 → index 2
    "Sudden Brake",       # Original label 4 → index 3
]
"""

# driving_events.csv
SENSOR_COLS = ['TIME', 'ACCEL_X', 'ACCEL_Y', 'ACCEL_Z', 'GYRO_X', 'GYRO_Y', 'GYRO_Z'] 

CLASS_NAMES = [
    "Accelerate",      
    "Aggressive Accelerate",  
    "Aggressive Brake",   
    "Aggressive Left",      
    "Aggressive Right",      
    "Brake",  
    "Idling",   
    "Left",   
    "Right",   
]"""
 
OUTPUT_DIR = "model/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

RAW_SENSOR_DATA_PATH = "./data/sensor_raw.csv"
#DRIVING_EVENT_DATA_PATH = "./data/driving_events.csv"

# Housekeeping
print("=" * 60)
print("1 - Loading data and splitting into sessions")
print("=" * 60)
 
df = pd.read_csv(RAW_SENSOR_DATA_PATH)
print(f"Raw data shape: {df.shape}")
print(f"Class distribution:\n{df['Class'].value_counts().sort_index().to_string()}")

# Each (DriverID, TaskID) may contain multiple recording sessions from
# different times/vehicles. Split by detecting time gaps > 5 seconds.
sessions = []
session_id = 0

# Creates windows/sessions for all recordings 
for (drv, tid), group in df.groupby(["DriverID", "TaskID"]):

    group = group.sort_values(["Hour", "Minute", "Second"]).reset_index(drop=True)
    time_key = group["Hour"] * 3600 + group["Minute"] * 60 + group["Second"]
    gaps = time_key.diff().fillna(0)
 
    # New session whenever gap > 5 seconds
    session_breaks = (gaps > 5).cumsum()
    for seg_id in session_breaks.unique():
        mask = session_breaks == seg_id
        seg_data = group[mask].copy()
        seg_data["SessionID"] = session_id
        sessions.append(seg_data)
        session_id += 1

df_sessions = pd.concat(sessions, ignore_index=True)
n_sessions = df_sessions["SessionID"].nunique()
print(f"\nExtracted {n_sessions} individual driving events")

# Verify session sizes
session_info = df_sessions.groupby("SessionID").agg(
    n_rows  = ("Class", "size"), # recording
    cls     = ("Class", "first"), # class
    driver  = ("DriverID", "first"), 
).reset_index()
 
 # Count how many events for each recording
for cls in sorted(session_info["cls"].unique()):
    subset = session_info[session_info["cls"] == cls]
    print(f"  Class {cls} ({CLASS_NAMES[cls-1]}): "
          f"{len(subset)} events, {subset['n_rows'].iloc[0]} rows each")
    
print("\n" + "=" * 60)
print("2: Sliding window extraction")
print("=" * 60)
 
def extract_windows(df, window_size, hop_size, sensor_cols):
    """Extract fixed-size sliding windows from each session. """

    X_windows = []
    y_labels  = []
    groups    = []  # Track which driver each window came from (for CV)
 
    for sid in df["SessionID"].unique():
        session = df[df["SessionID"] == sid].sort_values(
            ["Hour", "Minute", "Second"]
        )
        data   = session[sensor_cols].values   # shape: (n_rows, 6)
        label  = session["Class"].iloc[0] - 1  # Convert label from 1-4 to  0-3
        driver = session["DriverID"].iloc[0]
        n_rows = len(data)
 
        # Slide window across this session
        start = 0
        while start + window_size <= n_rows:
            window = data[start : start + window_size]
            X_windows.append(window)
            y_labels.append(label)
            groups.append(driver)
            start += hop_size
 
    X = np.array(X_windows, dtype=np.float32)  # (N, WINDOW_SIZE, N_CHANNELS)
    y = np.array(y_labels, dtype=np.int32)      # (N,)
    g = np.array(groups)                         # (N,) driver IDs
    return X, y, g
 
 
X_all, y_all, groups_all = extract_windows(
    df_sessions, WINDOW_SIZE, HOP_SIZE, SENSOR_COLS
)

print(f"Total windows: {len(X_all)}")
print(f"Window shape:  {X_all.shape}  of  (samples, timesteps, channels)")
print(f"Label shape:   {y_all.shape}")
print(f"\nWindows per class:")

# Counts of each label
for i, name in enumerate(CLASS_NAMES):
    count = np.sum(y_all == i)
    print(f"  {name}: {count}")

# Number of recordings / driver
print(f"\nWindows per driver:")
for drv in np.unique(groups_all):
    print(f"  {drv}: {np.sum(groups_all == drv)}")
 

print("\n" + "=" * 60)
print("3: Train/test split (stratified by class, grouped by driver)")
print("=" * 60)

# Use StratifiedGroupKFold to keep all windows from one driver together.
# This prevents data leakage (same driver's event in both train and test).
# We'll use 1 fold for a 67/33 split (2 drivers train, 1 driver test).

sgkf = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=SEED)
train_idx, test_idx = next(sgkf.split(X_all, y_all, groups_all))
 
X_trainval_raw, y_trainval = X_all[train_idx], y_all[train_idx]
X_test_raw,    y_test     = X_all[test_idx],  y_all[test_idx]

# Further split train into train + val (80/20 stratified)
# This keeps the test set completely held out from model selection.
X_train_raw, X_val_raw, y_train, y_val = train_test_split(
    X_trainval_raw, y_trainval,
    test_size=0.2, stratify=y_trainval, random_state=SEED
)

print(f"Train: {len(X_train_raw)} windows  |  Val: {len(X_val_raw)} windows  |  Test: {len(X_test_raw)} windows")
print(f"Train drivers: {np.unique(groups_all[train_idx])}")
print(f"Test  drivers: {np.unique(groups_all[test_idx])}")

print(f"\nTrain class distribution:")
for i, name in enumerate(CLASS_NAMES):
    print(f"  {name}: {np.sum(y_train == i)}")

print(f"Val class distribution:")
for i, name in enumerate(CLASS_NAMES):
    print(f"  {name}: {np.sum(y_val == i)}")

print(f"Test class distribution:")
for i, name in enumerate(CLASS_NAMES):
    print(f"  {name}: {np.sum(y_test == i)}")


# NORMALIZATION - Train
print("\n" + "=" * 60)
print("4: Z-score normalization (fit on train set only)")
print("=" * 60)
 
# Compute mean/std per channel across all train windows
# Shape: (n_train, 7, 6) -> compute over axes 0 and 1

train_mean = X_train_raw.mean(axis=(0, 1))  # shape: (6,)
train_std  = X_train_raw.std(axis=(0, 1))   # shape: (6,)
train_std[train_std == 0] = 1.0             # Prevent division by zero
 
X_train = (X_train_raw - train_mean) / train_std
X_val   = (X_val_raw   - train_mean) / train_std
X_test  = (X_test_raw  - train_mean) / train_std
 
print("Per-channel normalization stats:")
for i, col in enumerate(SENSOR_COLS):
    print(f"  {col:6s}: mean={train_mean[i]:+.4f}, std={train_std[i]:.4f}")
 
# Save normalization params (needed for ESP32 inference)
norm_params = np.stack([train_mean, train_std])
np.save(os.path.join(OUTPUT_DIR, "norm_params.npy"), norm_params)

print(f"\n Normalization params saved -> norm_params.npy")
print(f"  (Load on ESP32 to normalize raw sensor data before inference)")

"""
AUGMENTATION
- Add Gaussian Noise 
- Jitters 
- Time warmping

"""


print("\n" + "=" * 60)
print("5: Building tf.data pipeline with on-the-fly augmentation")
print("=" * 60)
 
GAUSSIAN_STD = 0.08
JITTER_MIN, JITTER_MAX = 0.9, 1.1
DC_OFFSET = 0.02
 
def augment_window(x, y):
    """Apply augmentation to a single (window, label) pair.
 
    Augmentations:
      1. Gaussian noise  — simulates sensor noise variation
      2. Scaling jitter  — simulates calibration differences between vehicles
      3. Time warping     — randomly shifts amplitudes slightly
    """
    # 1. Gaussian noise: σ = 0.05 (data is already z-score normalized)
    noise = tf.random.normal(shape  = tf.shape(x), 
                             mean   = 0.0, 
                             stddev = GAUSSIAN_STD)
    x = x + noise
 
    # 2. Scaling jitter: multiply by random factor in [0.9, 1.1]
    scale = tf.random.uniform(shape  = [], 
                              minval = JITTER_MIN, 
                              maxval = JITTER_MAX)
    x = x * scale
 
    # 3. Channel-wise random shift: small DC offset per channel
    offset = tf.random.normal(shape = [N_CHANNELS], 
                              mean  = 0.0, 
                              stddev= DC_OFFSET)
    x = x + offset
 
    return x, y
 
 
# Build training dataset with augmentation
train_ds = (
    tf.data.Dataset.from_tensor_slices((X_train, y_train))
    .shuffle(buffer_size=len(X_train), seed=SEED)
    .map(augment_window, num_parallel_calls=tf.data.AUTOTUNE)
    .batch(BATCH_SIZE)
    .prefetch(tf.data.AUTOTUNE)
)
 
# Build validation dataset (NO augmentation) — used for early stopping / LR scheduling
val_ds = (
    tf.data.Dataset.from_tensor_slices((X_val, y_val))
    .batch(BATCH_SIZE)
    .prefetch(tf.data.AUTOTUNE)
)

# Build test dataset (NO augmentation) — held out, only used for final evaluation
test_ds = (
    tf.data.Dataset.from_tensor_slices((X_test, y_test))
    .batch(BATCH_SIZE)
    .prefetch(tf.data.AUTOTUNE)
)

# Verify shapes
for batch_x, batch_y in train_ds.take(1):
    print(f"Train batch shape: X={batch_x.shape}, y={batch_y.shape}")
for batch_x, batch_y in test_ds.take(1):
    print(f"Test  batch shape: X={batch_x.shape}, y={batch_y.shape}")
 
print(f"Augmentation: Gaussian noise (σ={GAUSSIAN_STD}) + scaling jitter [{JITTER_MIN}, {JITTER_MAX}] "
      f"+ channel offset (σ={DC_OFFSET})")


# WEIGHTED CLASS

print("\n" + "=" * 60)
print("6: Computing class weights for imbalanced data")
print("=" * 60)
 
class_weights_array = compute_class_weight(
    class_weight    = "balanced", 
    classes         = np.arange(N_CLASSES), 
    y               = y_train
)
class_weight_dict = {i: w for i, w in enumerate(class_weights_array)}
 
for i, name in enumerate(CLASS_NAMES):
    print(f"  {name}: weight = {class_weight_dict[i]:.3f}")
 
# Build the 1D CNN for ESP32-S3
# Reference CNN.md

print("\n" + "=" * 60)
print("7: Building 1D CNN model (ESP32-S3 optimized)")
print("=" * 60)


def build_cnn_model(window_size, n_channels, n_classes):
    """Build the 1D CNN model using Keras

    Constraints:
    - Being mindful of amount of filters, pool size and dense layers for space complexity 
    Reference: https://doi.org/10.12688/f1000research.73134.2
    
    """
    inputs = keras.Input(shape=(window_size, n_channels), name="sensor_input")
 
    # --- Convolutional feature extraction ---
    # Conv Block 1: 16 filters, kernel=3
    x = keras.layers.Conv1D(
            filters     = 32, 
            kernel_size = 3, 
            padding     = "same", 
            name        = "conv1d_1"
        )(inputs)
    
    x = keras.layers.ReLU(name="relu_1")(x) # max(x, 0)
 
    # Conv Block 2: 32 filters, kernel=3
    x = keras.layers.Conv1D(
            filters     = 64, 
            kernel_size = 3, 
            padding     = "same", 
            name        = "conv1d_2"
        )(x)
    x = keras.layers.ReLU(name = "relu_2")(x)
 
    # Pooling + regularization
    x = keras.layers.MaxPool1D(pool_size    = 2, 
                               name         = "maxpool")(x)
    
    x = keras.layers.Dropout(0.4, name = "dropout_1")(x)
 
    # Classification head 
    x = keras.layers.Flatten(name = "flatten")(x)
    x = keras.layers.Dense(64, name = "dense_1")(x)
    x = keras.layers.ReLU(name = "relu_3")(x)
    x = keras.layers.Dropout(0.4, name = "dropout_2")(x)
 
    outputs = keras.layers.Dense(
        n_classes, activation="softmax", name="output"
    )(x)
 
    model = keras.Model(inputs=inputs, outputs=outputs, name="DrivingCNN")
    return model
 
 
model = build_cnn_model(WINDOW_SIZE, N_CHANNELS, N_CLASSES) # Configs declared at the beginning
 
model.compile(
    optimizer   = keras.optimizers.Adam(learning_rate=LEARNING_RATE),
    loss        = "sparse_categorical_crossentropy",
    metrics     = ["accuracy"],
)
 
# Print architecture summary
model.summary()
 
 # Check size of initial model
total_params = model.count_params()
print(f"\nTotal parameters: {total_params:,}")
print(f"Estimated INT8 model size: ~{total_params / 1024:.1f} KB")
print(f"ESP32-S3 SRAM: 512 KB -> model fits comfortably")


# TRAINING W/ Early Dropout
print("\n" + "=" * 60)
print("8: Training with early stopping")
print("=" * 60)
 
callbacks = [
    keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=PATIENCE,
        restore_best_weights=True,
        verbose=1,
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=10,
        min_lr=1e-6,
        verbose=1,
    ),
]
 
history = model.fit(
    train_ds,
    validation_data = val_ds,
    epochs          = MAX_EPOCHS,
    class_weight    = class_weight_dict,
    callbacks       = callbacks,
    verbose         = 1,
)
 
print(f"\nTraining completed after {len(history.history['loss'])} epochs")
best_val_acc = max(history.history["val_accuracy"])
best_val_loss = min(history.history["val_loss"])
print(f"Best validation accuracy: {best_val_acc:.4f}")
print(f"Best validation loss:     {best_val_loss:.4f}")


# EVALUATION

print("\n" + "=" * 60)
print(" 9: Evaluation on test set")
print("=" * 60)
 
# Predict on test set
y_pred_probs = model.predict(X_test, verbose=0)
y_pred = np.argmax(y_pred_probs, axis=1)
 
# Classification report
print("\nClassification Report:")
print(classification_report(
    y_test, y_pred, target_names=CLASS_NAMES, digits=4
))
 
# Overall accuracy
test_loss, test_acc = model.evaluate(test_ds, verbose=0)
print(f"Test Loss:     {test_loss:.4f}")
print(f"Test Accuracy: {test_acc:.4f}")
 

# VISUALS

print("\n" + "=" * 60)
print(" 10: Generating visualizations")
print("=" * 60)
 
fig, axes = plt.subplots(1, 3, figsize=(18, 5))
 
# --- Learning curve: Accuracy ---
axes[0].plot(history.history["accuracy"], label="Train", linewidth=2)
axes[0].plot(history.history["val_accuracy"], label="Validation", linewidth=2)
axes[0].set_title("Model Accuracy", fontsize=14, fontweight="bold")
axes[0].set_xlabel("Epoch")
axes[0].set_ylabel("Accuracy")
axes[0].legend()
axes[0].grid(True, alpha=0.3)
 
# --- Learning curve: Loss ---
axes[1].plot(history.history["loss"], label="Train", linewidth=2)
axes[1].plot(history.history["val_loss"], label="Validation", linewidth=2)
axes[1].set_title("Model Loss", fontsize=14, fontweight="bold")
axes[1].set_xlabel("Epoch")
axes[1].set_ylabel("Loss")
axes[1].legend()
axes[1].grid(True, alpha=0.3)

# CONFUSION MATRIX -- see feature strength for classification
cm = confusion_matrix(y_test, y_pred)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=CLASS_NAMES)
disp.plot(ax=axes[2], cmap="Blues", values_format="d")
axes[2].set_title("Confusion Matrix", fontsize=14, fontweight="bold")
axes[2].set_xticklabels(CLASS_NAMES, rotation=30, ha="right", fontsize=8)
axes[2].set_yticklabels(CLASS_NAMES, fontsize=8)
 
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "training_results.png"), dpi=150,
            bbox_inches="tight")
plt.close()
print("Saved to training_results.png")


# SAVING
print("\n" + "=" * 60)
print(" 11: Saving Keras model")
print("=" * 60)
 
keras_path = os.path.join(OUTPUT_DIR, "driving_cnn.keras")
model.save(keras_path)
print(f"Saved Keras model → {keras_path}")
print(f"File size: {os.path.getsize(keras_path) / 1024:.1f} KB")


# TODO TFLITE CONVERSION - int8
print("\n" + "=" * 60)
print("12: Converting to TFLite (INT8 quantized)")
print("=" * 60)


def representative_dataset_gen():
    """Calibration data for INT8 quantization.
    Uses a subset of training data to determine activation ranges."""
    for i in range(min(100, len(X_train))):
        sample = X_train[i : i + 1].astype(np.float32)
        yield [sample]


# --- Full float32 TFLite (for comparison) ---
converter_f32 = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_f32 = converter_f32.convert()
f32_path = os.path.join(OUTPUT_DIR, "driving_cnn_f32.tflite")
with open(f32_path, "wb") as f:
    f.write(tflite_f32)
print(f"Float32 TFLite: {os.path.getsize(f32_path) / 1024:.1f} KB → {f32_path}")

# --- INT8 fully quantized TFLite (for ESP32-S3) ---
converter_int8 = tf.lite.TFLiteConverter.from_keras_model(model)
converter_int8.optimizations = [tf.lite.Optimize.DEFAULT]
converter_int8.representative_dataset = representative_dataset_gen
converter_int8.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS_INT8
]
converter_int8.inference_input_type  = tf.int8
converter_int8.inference_output_type = tf.int8

tflite_int8 = converter_int8.convert()
int8_path = os.path.join(OUTPUT_DIR, "driving_cnn_int8.tflite")
with open(int8_path, "wb") as f:
    f.write(tflite_int8)
print(f"INT8 TFLite:    {os.path.getsize(int8_path) / 1024:.1f} KB to {int8_path}")

# VERIFY
print("\n" + "=" * 60)
print("13: Verifying TFLite model accuracy")
print("=" * 60)

# Load and test the INT8 model
#interpreter = tf.lite.Interpreter(model_path=int8_path)
interpreter = Interpreter(model_path=int8_path)

interpreter.allocate_tensors()

input_details  = interpreter.get_input_details()
output_details = interpreter.get_output_details()

print(f"TFLite input:  {input_details[0]['shape']} dtype={input_details[0]['dtype']}")
print(f"TFLite output: {output_details[0]['shape']} dtype={output_details[0]['dtype']}")

# Get quantization parameters for input
input_scale = input_details[0]["quantization_parameters"]["scales"][0]
input_zp    = input_details[0]["quantization_parameters"]["zero_points"][0]
print(f"Input quantization: scale={input_scale:.6f}, zero_point={input_zp}")

# Run inference on test set
tflite_preds = []
for i in range(len(X_test)):
    sample = X_test[i : i + 1].astype(np.float32)

    # Quantize input to INT8
    sample_int8 = (sample / input_scale + input_zp).astype(np.int8)

    interpreter.set_tensor(input_details[0]["index"], sample_int8)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]["index"])
    tflite_preds.append(np.argmax(output, axis=1)[0])

tflite_preds = np.array(tflite_preds)
tflite_acc = np.mean(tflite_preds == y_test)

print(f"\nTFLite INT8 Accuracy: {tflite_acc:.4f}")
print(f"Keras Accuracy:       {test_acc:.4f}")
print(f"Quantization loss:    {test_acc - tflite_acc:.4f}")


print("\n" + "=" * 60)
print("14: Generating C header for ESP32-S3 firmware")
print("=" * 60)

# Convert TFLite model bytes to C array
def tflite_to_c_header(tflite_model_bytes, header_path, array_name="driving_cnn_model"):
    """Convert TFLite model to a C header file for ESP32 embedding."""
    with open(header_path, "w") as f:
        f.write(f"// Auto-generated TFLite model for ESP32-S3\n")
        f.write(f"// Model: 1D CNN Driving Behavior Classifier\n")
        f.write(f"// Input:  INT8 tensor of shape (1, {WINDOW_SIZE}, {N_CHANNELS})\n")
        f.write(f"// Output: INT8 tensor of shape (1, {N_CLASSES})\n")
        f.write(f"// Classes: {', '.join(CLASS_NAMES)}\n")
        f.write(f"// Input normalization (apply BEFORE quantization):\n")
        for i, col in enumerate(SENSOR_COLS):
            f.write(f"//   {col}: (raw - {train_mean[i]:.6f}) / {train_std[i]:.6f}\n")
        f.write(f"// Input quantization: scale={input_scale:.6f}, "
                f"zero_point={input_zp}\n")
        f.write(f"//\n")
        f.write(f"// Size: {len(tflite_model_bytes)} bytes\n\n")
        f.write(f"#ifndef {array_name.upper()}_H\n")
        f.write(f"#define {array_name.upper()}_H\n\n")
        f.write(f"#include <stdint.h>\n\n")
        f.write(f"const unsigned int {array_name}_len = {len(tflite_model_bytes)};\n")
        f.write(f"alignas(8) const uint8_t {array_name}[] = {{\n")

        # Write hex bytes, 12 per line
        for i, byte in enumerate(tflite_model_bytes):
            if i % 12 == 0:
                f.write("  ")
            f.write(f"0x{byte:02x}")
            if i < len(tflite_model_bytes) - 1:
                f.write(", ")
            if (i + 1) % 12 == 0:
                f.write("\n")

        f.write(f"\n}};\n\n")
        f.write(f"#endif // {array_name.upper()}_H\n")


header_path = os.path.join(OUTPUT_DIR, "driving_cnn_model.h")
tflite_to_c_header(tflite_int8, header_path)
print(f"Saved C header → {header_path}")
print(f"File size: {os.path.getsize(header_path) / 1024:.1f} KB")

# Summary
print("\n" + "=" * 60)
print("PIPELINE COMPLETE ; SUMMARY")
print("=" * 60)
print(f"""
Dataset:
  Raw rows:          {len(df):,}
  Sessions/events:   {n_sessions}
  Windowed samples:  {len(X_all)} (window={WINDOW_SIZE}, hop={HOP_SIZE})
  Train / Test:      {len(X_train)} / {len(X_test)}

Model:
  Architecture:      1D CNN (Conv1D→ReLU→Conv1D→ReLU→MaxPool→Dense→Softmax)
  Parameters:        {total_params:,}
  Filters:           16 → 32
  Dense units:       32
  Regularization:    Dropout(0.3) + Dropout(0.4) + class weights

Training:
  Epochs completed:  {len(history.history['loss'])}
  Best val accuracy: {best_val_acc:.4f}
  Best val loss:     {best_val_loss:.4f}

Performance:
  Keras test acc:    {test_acc:.4f}
  TFLite INT8 acc:   {tflite_acc:.4f}
  Quantization loss: {abs(test_acc - tflite_acc):.4f}

Output files:
  {OUTPUT_DIR}/training_results.png     — Learning curves + confusion matrix
  {OUTPUT_DIR}/norm_params.npy          — Normalization mean/std for ESP32
  {OUTPUT_DIR}/driving_cnn.keras        — Full Keras model
  {OUTPUT_DIR}/driving_cnn_f32.tflite   — Float32 TFLite ({os.path.getsize(f32_path)/1024:.1f} KB)
  {OUTPUT_DIR}/driving_cnn_int8.tflite  — INT8 TFLite ({os.path.getsize(int8_path)/1024:.1f} KB)
  {OUTPUT_DIR}/driving_cnn_model.h      — C header for ESP32 firmware
""")
