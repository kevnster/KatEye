import numpy as np
import keras
from sklearn.metrics import classification_report


def train_model(
    model,
    train_ds,
    val_ds,
    class_weight_dict,
    max_epochs    = 100,
    patience      = 15,
    lr_factor     = 0.5,
    lr_patience   = 10,
    min_lr        = 1e-6,
):
    """
    Trains a compiled Keras model with early stopping and learning rate reduction.

    Callbacks:
        EarlyStopping     — halts training when val_loss stops improving and
                            restores the best weights automatically
        ReduceLROnPlateau — halves the learning rate when val_loss plateaus,
                            allowing finer optimisation steps before stopping

    Args:
        model             : compiled keras.Model
        train_ds          : tf.data.Dataset — augmented, batched, prefetched
        val_ds            : tf.data.Dataset — batched, prefetched, no augmentation
        class_weight_dict : dict {class_index: weight} — from compute_class_weights()
        max_epochs        : int   — upper bound on training epochs. Default 100.
        patience          : int   — EarlyStopping patience in epochs. Default 15.
        lr_factor         : float — multiplicative LR reduction factor. Default 0.5.
        lr_patience       : int   — epochs before LR is reduced. Default 10.
        min_lr            : float — floor for learning rate reduction. Default 1e-6.

    Returns:
        history : keras.callbacks.History — contains per-epoch loss and metrics

    Raises:
        ValueError — if patience or max_epochs are invalid
    """

    # Guard clauses                                                        #

    if max_epochs < 1:
        raise ValueError(f"max_epochs must be >= 1, got {max_epochs}")
    if patience < 1:
        raise ValueError(f"patience must be >= 1, got {patience}")
    if lr_patience < 1:
        raise ValueError(f"lr_patience must be >= 1, got {lr_patience}")
    if not (0.0 < lr_factor < 1.0):
        raise ValueError(f"lr_factor must be in (0, 1), got {lr_factor}")
    if min_lr <= 0:
        raise ValueError(f"min_lr must be > 0, got {min_lr}")

    # Callbacks                                                           #
    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor             = "val_loss",
            patience            = patience,
            restore_best_weights= True,
            verbose             = 1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor   = "val_loss",
            factor    = lr_factor,
            patience  = lr_patience,
            min_lr    = min_lr,
            verbose   = 1,
        ),
    ]

    # Training loop                                                       #

    history = model.fit(
        train_ds,
        validation_data = val_ds,
        epochs          = max_epochs,
        class_weight    = class_weight_dict,
        callbacks       = callbacks,
        verbose         = 1,
    )

    # Post-training summary                                               #
    epochs_run    = len(history.history["loss"])
    best_val_acc  = max(history.history["val_accuracy"])
    best_val_loss = min(history.history["val_loss"])

    print(f"\nTraining completed after {epochs_run} / {max_epochs} epochs")
    print(f"Best validation accuracy : {best_val_acc:.4f}")
    print(f"Best validation loss     : {best_val_loss:.4f}")

    if epochs_run < max_epochs:
        print(f"Early stopping triggered (patience={patience})")
    else:
        print("Warning: hit max_epochs — consider increasing max_epochs or patience")

    return history


def evaluate_model(model, test_ds, X_test, y_test, class_names):
    """
    Evaluates a trained model on the held-out test set.

    Produces:
        - Per-class precision, recall, and F1 (classification report)
        - Overall test loss and accuracy from model.evaluate()

    Args:
        model       : trained keras.Model with restore_best_weights applied
        test_ds     : tf.data.Dataset — batched, prefetched, no augmentation
        X_test      : np.ndarray, shape (N, window_size, n_channels) — raw test windows
                      used for model.predict() to get per-sample probabilities
        y_test      : np.ndarray, shape (N,) — true integer labels
        class_names : list[str] — activity names ordered by label index

    Returns:
        y_pred    : np.ndarray, shape (N,) — predicted class indices
        test_loss : float
        test_acc  : float

    Raises:
        ValueError — if y_test and X_test have mismatched lengths
    """

    # Guard clauses                                                        #

    if len(X_test) != len(y_test):
        raise ValueError(
            f"X_test and y_test length mismatch: {len(X_test)} vs {len(y_test)}"
        )
    if len(class_names) == 0:
        raise ValueError("class_names must not be empty")

    # Predict                                                             #
    y_pred_probs = model.predict(X_test, verbose=0)   # (N, n_classes)
    y_pred       = np.argmax(y_pred_probs, axis=1)    # (N,)

    # Classification report (per-class precision, recall, F1)            #
    print("\nClassification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names = class_names,
        digits       = 4,
    ))

    # Overall loss and accuracy from compiled metrics                     #
    test_loss, test_acc = model.evaluate(test_ds, verbose=0)
    print(f"Test Loss     : {test_loss:.4f}")
    print(f"Test Accuracy : {test_acc:.4f}")

    # Per-class accuracy breakdown                                        #
    print("\nPer-class accuracy:")
    for i, name in enumerate(class_names):
        mask         = y_test == i
        if mask.sum() == 0:
            print(f"  {name}: no samples in test set")
            continue
        class_acc    = np.mean(y_pred[mask] == y_test[mask])
        print(f"  {name}: {class_acc:.4f}  ({mask.sum()} samples)")

    return y_pred, test_loss, test_acc