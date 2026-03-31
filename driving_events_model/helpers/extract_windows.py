import numpy as np
import pandas as pd

def extract_windows(df, window_size, hop_size, sensor_cols, class_names):
    """
    Transforms raw session data into fixed-size sliding windows for model input.

    Stages:
        1. Build a label lookup (activity string -> integer index)
        2. Initialise collection lists (X, y, groups)
        3. Iterate over sessions
        4. Slide the window across each session
        5. Stack into NumPy arrays

    Args:
        df          : pd.DataFrame — output of prepare_data(), must contain
                      SessionID, ACTIVITY, Hour, Minute, Second, and sensor columns
        window_size : int          — number of timesteps per window
        hop_size    : int          — step size between windows (< window_size = overlap)
        sensor_cols : list[str]    — column names for the sensor channels
        class_names : list[str]    — ordered activity names; index position becomes the label

    Returns:
        X      : np.ndarray, shape (N, window_size, n_channels), dtype float32
        y      : np.ndarray, shape (N,), dtype int32
        groups : np.ndarray, shape (N,), dtype int — SessionID for each window
    
    Raises:
        ValueError — if required columns are missing, parameters are invalid,
                     or an activity is not found in class_names
    """

    # Guard clauses                                                        #
    required_cols = {"SessionID", "ACTIVITY", "Hour", "Minute", "Second"} | set(sensor_cols)
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"DataFrame is missing required columns: {missing}")

    if window_size < 1:
        raise ValueError(f"window_size must be >= 1, got {window_size}")
    if hop_size < 1:
        raise ValueError(f"hop_size must be >= 1, got {hop_size}")
    if hop_size > window_size:
        raise ValueError(
            f"hop_size ({hop_size}) > window_size ({window_size}) — "
            "this would leave gaps between windows"
        )
    if not class_names:
        raise ValueError("class_names must not be empty")

    unknown_activities = set(df["ACTIVITY"].unique()) - set(class_names)
    if unknown_activities:
        raise ValueError(
            f"Activities found in data but missing from class_names: {unknown_activities}"
        )

    # 1. Build label lookup                                                #
    activity_to_idx = {name: i for i, name in enumerate(class_names)}

    # 2. Initialise collection lists                                       #
    X_windows = []
    y_labels  = []
    groups    = []

    # 3-4. Iterate over sessions and slide the window                     #
    skipped_sessions = 0

    for sid in df["SessionID"].unique():
        session  = df[df["SessionID"] == sid].sort_values(["Hour", "Minute", "Second"])
        data     = session[sensor_cols].values          # (n_rows, n_channels)
        activity = session["ACTIVITY"].iloc[0]
        label    = activity_to_idx[activity]
        n_rows   = len(data)

        if n_rows < window_size:
            skipped_sessions += 1
            continue

        start = 0
        while start + window_size <= n_rows:
            X_windows.append(data[start : start + window_size])
            y_labels.append(label)
            groups.append(sid)
            start += hop_size

    if skipped_sessions:
        print(f"  [Warning] Skipped {skipped_sessions} sessions shorter than window_size={window_size}")

    if not X_windows:
        raise ValueError(
            "No windows were extracted. Check that sessions are long enough "
            f"for window_size={window_size}."
        )

    # 5. Stack into arrays                                                 #
    X      = np.array(X_windows, dtype=np.float32)  # (N, window_size, n_channels)
    y      = np.array(y_labels,  dtype=np.int32)     # (N,)
    groups = np.array(groups)                         # (N,)

    # Verification printout                                                #
    print(f"Total windows : {len(X)}")
    print(f"Window shape  : {X.shape}  (samples, timesteps, channels)")
    print(f"Label shape   : {y.shape}")
    print(f"\nWindows per class:")
    for i, name in enumerate(class_names):
        print(f"  {name}: {np.sum(y == i)}")
    print(f"\nSessions contributing windows: {len(np.unique(groups))}")

    return X, y, groups