import os
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay


def plot_results(history, y_test, y_pred, class_names, output_dir, filename="training_results.png", dpi=150):
    """
    Generates and saves a three-panel diagnostic figure:
        Panel 1 — Accuracy learning curves (train vs val)
        Panel 2 — Loss learning curves (train vs val)
        Panel 3 — Confusion matrix on the test set

    Args:
        history     : keras.callbacks.History — returned by train_model()
        y_test      : np.ndarray, shape (N,) — true integer labels
        y_pred      : np.ndarray, shape (N,) — predicted integer labels from evaluate_model()
        class_names : list[str] — activity names ordered by label index
        output_dir  : str  — directory to save the figure (created if it doesn't exist)
        filename    : str  — output filename. Default "training_results.png".
        dpi         : int  — image resolution. Default 150.

    Returns:
        save_path : str — absolute path to the saved figure

    Raises:
        ValueError — if history is missing expected keys or y_test/y_pred are mismatched
    """

    # Guard clauses                                                        #
    required_keys = {"accuracy", "val_accuracy", "loss", "val_loss"}
    missing_keys  = required_keys - set(history.history.keys())
    if missing_keys:
        raise ValueError(f"History object is missing keys: {missing_keys}")
    if len(y_test) != len(y_pred):
        raise ValueError(
            f"y_test and y_pred length mismatch: {len(y_test)} vs {len(y_pred)}"
        )
    os.makedirs(output_dir, exist_ok=True)

    # Figure layout                                                       #
    fig, axes = plt.subplots(1, 3, figsize=(20, 6))

    # Panel 1 — Accuracy learning curves                                  #
    axes[0].plot(history.history["accuracy"],     label="Train",      linewidth=2)
    axes[0].plot(history.history["val_accuracy"], label="Validation", linewidth=2)
    axes[0].set_title("Model Accuracy", fontsize=14, fontweight="bold")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Accuracy")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # Panel 2 — Loss learning curves                                      #
    axes[1].plot(history.history["loss"],     label="Train",      linewidth=2)
    axes[1].plot(history.history["val_loss"], label="Validation", linewidth=2)
    axes[1].set_title("Model Loss", fontsize=14, fontweight="bold")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Loss")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    # Mark the best val_loss epoch
    best_epoch = int(np.argmin(history.history["val_loss"]))
    axes[1].axvline(
        x          = best_epoch,
        color      = "red",
        linestyle  = "--",
        alpha      = 0.5,
        label      = f"Best epoch ({best_epoch})",
    )
    axes[1].legend()

    # Panel 3 — Confusion matrix                                          #
    cm   = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=class_names)
    disp.plot(ax=axes[2], cmap="Blues", values_format="d", colorbar=False)
    axes[2].set_title("Confusion Matrix", fontsize=14, fontweight="bold")
    axes[2].set_xticklabels(class_names, rotation=45, ha="right", fontsize=7)
    axes[2].set_yticklabels(class_names, fontsize=7)

    plt.tight_layout()
    save_path = os.path.join(output_dir, filename)
    plt.savefig(save_path, dpi=dpi, bbox_inches="tight")
    plt.close()

    print(f"Saved figure → {save_path}")
    return save_path
