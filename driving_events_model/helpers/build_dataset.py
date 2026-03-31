import numpy as np
import tensorflow as tf
from sklearn.preprocessing import StandardScaler


def normalize(X_train, X_val, X_test):
    """
    Fits a StandardScaler on the training set and applies it to all three splits.

    The scaler is fit on a 2D view of X_train (flattening windows and timesteps
    into rows) so each channel gets its own mean and std. The same scaler is then
    applied to val and test — they never influence the scaling parameters.

    Args:
        X_train : np.ndarray, shape (N_train, window_size, n_channels)
        X_val   : np.ndarray, shape (N_val,   window_size, n_channels)
        X_test  : np.ndarray, shape (N_test,  window_size, n_channels)

    Returns:
        X_train_norm, X_val_norm, X_test_norm : normalized float32 arrays
        scaler                                : fitted StandardScaler instance
                                                (save this for inference)

    Raises:
        ValueError — if input arrays have inconsistent number of channels
    """

    # Guard clauses                                                        #
    if not (X_train.ndim == X_val.ndim == X_test.ndim == 3):
        raise ValueError("All inputs must be 3D arrays (N, window_size, n_channels)")

    n_channels = X_train.shape[2]
    if not (X_val.shape[2] == X_test.shape[2] == n_channels):
        raise ValueError(
            f"Channel mismatch — train: {n_channels}, "
            f"val: {X_val.shape[2]}, test: {X_test.shape[2]}"
        )

    # Fit scaler on training data only                                     #
    # Reshape: (N, window_size, n_channels) -> (N * window_size, n_channels)
    N_train, window_size, _ = X_train.shape
    scaler = StandardScaler()
    scaler.fit(X_train.reshape(-1, n_channels))

    # Apply to all splits and restore original shape                       #
    X_train_norm = scaler.transform(X_train.reshape(-1, n_channels))\
                         .reshape(X_train.shape).astype(np.float32)
    X_val_norm   = scaler.transform(X_val.reshape(-1, n_channels))\
                         .reshape(X_val.shape).astype(np.float32)
    X_test_norm  = scaler.transform(X_test.reshape(-1, n_channels))\
                         .reshape(X_test.shape).astype(np.float32)

    # Verification printout                                                #
    print(f"Scaler fit on {N_train} training windows ({N_train * window_size} timesteps)")
    print(f"Channel means (train): {scaler.mean_.round(4)}")
    print(f"Channel stds  (train): {scaler.scale_.round(4)}")
    print(f"Post-norm train mean : {X_train_norm.mean():.6f}  (should be ≈ 0)")
    print(f"Post-norm train std  : {X_train_norm.std():.6f}   (should be ≈ 1)")

    return X_train_norm, X_val_norm, X_test_norm, scaler


def build_datasets(
    X_train, y_train,
    X_val,   y_val,
    X_test,  y_test,
    batch_size,
    n_channels,
    seed          = 42,
    gaussian_std  = 0.08,
    jitter_min    = 0.9,
    jitter_max    = 1.1,
    dc_offset_std = 0.02,
):
    """
    Wraps train/val/test arrays into tf.data pipelines.
    Augmentation is applied only to the training set.

    Augmentations (training only):
        1. Gaussian noise    — simulates sensor measurement noise
        2. Scaling jitter    — simulates calibration differences between devices
        3. Channel DC offset — simulates per-channel sensor bias

    Args:
        X_train, y_train  : training windows and labels
        X_val,   y_val    : validation windows and labels
        X_test,  y_test   : test windows and labels
        batch_size        : int   — number of windows per batch
        n_channels        : int   — number of sensor channels (needed for DC offset shape)
        seed              : int   — shuffle seed. Default 42.
        gaussian_std      : float — stddev for Gaussian noise. Default 0.08.
        jitter_min        : float — lower bound for scaling jitter. Default 0.9.
        jitter_max        : float — upper bound for scaling jitter. Default 1.1.
        dc_offset_std     : float — stddev for per-channel DC offset. Default 0.02.

    Returns:
        train_ds, val_ds, test_ds : tf.data.Dataset objects ready for model.fit()

    Raises:
        ValueError — if batch_size or augmentation parameters are invalid
    """

    # Guard clauses                                                        #
    if batch_size < 1:
        raise ValueError(f"batch_size must be >= 1, got {batch_size}")
    if gaussian_std < 0:
        raise ValueError(f"gaussian_std must be >= 0, got {gaussian_std}")
    if not (jitter_min > 0 and jitter_max >= jitter_min):
        raise ValueError(
            f"jitter range invalid: minval={jitter_min}, maxval={jitter_max}"
        )
    if dc_offset_std < 0:
        raise ValueError(f"dc_offset_std must be >= 0, got {dc_offset_std}")

    # Augmentation function (closure over parameters)                     #
    def augment_window(x, y):
        # 1. Gaussian noise — independent per timestep per channel
        x = x + tf.random.normal(shape=tf.shape(x), mean=0.0, stddev=gaussian_std)

        # 2. Scaling jitter — single scalar applied to whole window
        x = x * tf.random.uniform(shape=[], minval=jitter_min, maxval=jitter_max)

        # 3. Channel-wise DC offset — constant per channel, varies per window
        x = x + tf.random.normal(shape=[n_channels], mean=0.0, stddev=dc_offset_std)

        return x, y

    # Build datasets                                                       #
    train_ds = (
        tf.data.Dataset.from_tensor_slices((X_train, y_train))
        .shuffle(buffer_size=len(X_train), seed=seed)
        .map(augment_window, num_parallel_calls=tf.data.AUTOTUNE)
        .batch(batch_size)
        .prefetch(tf.data.AUTOTUNE)
    )

    val_ds = (
        tf.data.Dataset.from_tensor_slices((X_val, y_val))
        .batch(batch_size)
        .prefetch(tf.data.AUTOTUNE)
    )

    test_ds = (
        tf.data.Dataset.from_tensor_slices((X_test, y_test))
        .batch(batch_size)
        .prefetch(tf.data.AUTOTUNE)
    )

    # Verification printout                                                #
    for batch_x, batch_y in train_ds.take(1):
        print(f"Train batch shape : X = {batch_x.shape}, y = {batch_y.shape}")
    for batch_x, batch_y in val_ds.take(1):
        print(f"Val   batch shape : X = {batch_x.shape}, y = {batch_y.shape}")
    for batch_x, batch_y in test_ds.take(1):
        print(f"Test  batch shape : X = {batch_x.shape}, y = {batch_y.shape}")

    print(
        f"\nAugmentation (train only): "
        f"Gaussian noise (σ = {gaussian_std}) | "
        f"scaling jitter [{jitter_min}, {jitter_max}] | "
        f"channel offset (σ = {dc_offset_std})"
    )

    return train_ds, val_ds, test_ds