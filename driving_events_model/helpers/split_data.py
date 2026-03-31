from sklearn.model_selection import StratifiedGroupKFold, train_test_split
import pandas as pd
import numpy as np

def split_data(X, y, groups, class_names, n_splits=3, val_size=0.2, seed=42):
    """
    Splits windowed data into train, validation, and test sets.

    Stages:
        1. StratifiedGroupKFold to produce a group-safe train/test split
        2. Carve out the held-out test set
        3. Split remaining trainval into train + val

    Args:
        X           : np.ndarray, shape (N, window_size, n_channels) — windowed sensor data
        y           : np.ndarray, shape (N,)                         — integer class labels
        groups      : np.ndarray, shape (N,)                         — SessionID per window
        class_names : list[str]  — activity names ordered by label index (for printout)
        n_splits    : int        — folds for StratifiedGroupKFold; controls train/test ratio
                                   (3 → ~67/33, 4 → ~75/25, 5 → ~80/20). Default 3.
        val_size    : float      — fraction of trainval to reserve for validation. Default 0.2.
        seed        : int        — random state for reproducibility. Default 42.

    Returns:
        X_train, y_train : training windows and labels
        X_val,   y_val   : validation windows and labels
        X_test,  y_test  : held-out test windows and labels

    Raises:
        ValueError — if inputs are inconsistent or parameters are out of range
    """

    # Guard clauses                                                        #
    if not (len(X) == len(y) == len(groups)):
        raise ValueError(
            f"X, y, and groups must have the same length. "
            f"Got X={len(X)}, y={len(y)}, groups={len(groups)}"
        )
    if n_splits < 2:
        raise ValueError(f"n_splits must be >= 2, got {n_splits}")
    if not (0.0 < val_size < 1.0):
        raise ValueError(f"val_size must be between 0 and 1, got {val_size}")

    # 1. StratifiedGroupKFold — group-safe train/test split               #
    sgkf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    train_idx, test_idx = next(sgkf.split(X, y, groups))

    # 2. Carve out held-out test set                                       #
    X_trainval, y_trainval = X[train_idx], y[train_idx]
    X_test,     y_test     = X[test_idx],  y[test_idx]

    # 3. Split trainval into train + val                                   #
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval,
        test_size=val_size,
        stratify=y_trainval,
        random_state=seed
    )

    # Verification printout                                                #
    total = len(X)
    print(f"Train : {len(X_train):>6} windows ({100 * len(X_train) / total:.1f}%)")
    print(f"Val   : {len(X_val):>6} windows ({100 * len(X_val)   / total:.1f}%)")
    print(f"Test  : {len(X_test):>6} windows ({100 * len(X_test)  / total:.1f}%)")

    for split_name, y_split in [("Train", y_train), ("Val", y_val), ("Test", y_test)]:
        print(f"\n{split_name} class distribution:")
        for i, name in enumerate(class_names):
            print(f"  {name}: {np.sum(y_split == i)}")

    return X_train, y_train, X_val, y_val, X_test, y_test