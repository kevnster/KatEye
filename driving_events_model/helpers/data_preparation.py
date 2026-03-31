import pandas as pd
import sqlite3
import os

def prepare_data(path, max_session_rows = 3000, gap_threshold = 5):
    """
    Loads sensor data, parses timestamps, and splits into labeled sessions.

    Stages:
        1. Load the raw data (supports .db and .csv)
        2. Parse the time string into numeric columns
        3. Detect session boundaries via time gaps
        4. Sub-chunk oversized sessions
        5. Assign a global SessionID and reassemble
        6. Verification printout

    Args:
        path            : str  — path to a .db (SQLite) or .csv file
        max_session_rows: int  — max rows per session before sub-chunking (default 3000)
        gap_threshold   : int  — seconds between rows that triggers a new session (default 5)

    Returns:
        df_sessions: pd.DataFrame with all original columns plus SessionID
    """

    # 1. Load raw data                                                     #
    ext = os.path.splitext(path)[-1].lower()

    # Check what kind of data file we have
    if ext == ".db":
        conn = sqlite3.connect(path)
        df = pd.read_sql_query("SELECT * FROM SENSOR_TABLE", conn)
        conn.close()
    elif ext == ".csv":
        df = pd.read_csv(path)
    else:
        raise ValueError(f"Unsupported file type '{ext}'. Expected .db or .csv.")

    print("=" * 60)
    print("1 - Data loaded")
    print("=" * 60)
    print(f"Raw data shape: {df.shape}")
    print(f"Activity distribution:\n{df['ACTIVITY'].value_counts().sort_index().to_string()}")

    # 2. Validate and parse TIME column                                    #
    if "TIME" not in df.columns:
        raise ValueError("Expected a 'TIME' column but none was found.")

    time_pattern = r"^\d{1,2}:\d{2}:\d{2}$"
    invalid_mask = ~df["TIME"].astype(str).str.match(time_pattern)
    if invalid_mask.any():
        bad_samples = df.loc[invalid_mask, "TIME"].unique()[:5]
        raise ValueError(
            f"TIME column contains values not matching HH:MM:SS format. "
            f"Examples: {bad_samples}"
        )

    time_parts    = df["TIME"].str.split(":", expand=True).astype(int)
    df["Hour"]    = time_parts[0]
    df["Minute"]  = time_parts[1]
    df["Second"]  = time_parts[2]

    # 3-5. Detect sessions, sub-chunk, assign SessionID                   #
    print("=" * 60)
    print("2 - Splitting into sessions")
    print("=" * 60)

    sessions   = []
    session_id = 0

    for activity, group in df.groupby("ACTIVITY"):
        group    = group.sort_values(["Hour", "Minute", "Second"]).reset_index(drop=True)
        time_key = group["Hour"] * 3600 + group["Minute"] * 60 + group["Second"]
        gaps     = time_key.diff().fillna(0)

        # 3. Each run of rows with no gap > threshold becomes one segment
        session_breaks = (gaps > gap_threshold).cumsum()

        for seg_id in session_breaks.unique():
            seg_data = group[session_breaks == seg_id].reset_index(drop=True)

            # 4. Sub-chunk if segment exceeds max_session_rows
            if len(seg_data) > max_session_rows:
                for start in range(0, len(seg_data), max_session_rows):
                    chunk = seg_data.iloc[start : start + max_session_rows].copy()
                    chunk["SessionID"] = session_id
                    sessions.append(chunk)
                    session_id += 1
            else:
                seg_data = seg_data.copy()
                seg_data["SessionID"] = session_id
                sessions.append(seg_data)
                session_id += 1

    # 5. Reassemble
    df_sessions = pd.concat(sessions, ignore_index=True)
    print(f"Extracted {df_sessions['SessionID'].nunique()} individual driving sessions")

    # 6. Verification printout                                            #
    session_info = df_sessions.groupby("SessionID").agg(
        n_rows   = ("ACTIVITY", "size"),
        activity = ("ACTIVITY", "first"),
    ).reset_index()

    for act in sorted(session_info["activity"].unique()):
        subset = session_info[session_info["activity"] == act]
        print(
            f"  {act}: {len(subset)} sessions, "
            f"rows min={subset['n_rows'].min()} / max={subset['n_rows'].max()}"
        )

    return df_sessions