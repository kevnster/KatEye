"""
Freight Driving Behavior Classfier

Architecture
- 1D Convolutional Neural Network 

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
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import (
    classification_report, confusion_matrix, ConfusionMatrixDisplay
)
 
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
PATIENCE      = 25      # Early stopping patience
LEARNING_RATE = 1e-3
 
SENSOR_COLS = ["AccX", "AccY", "AccZ", "GyroX", "GyroY", "GyroZ"] # sensor_raw.csv
CLASS_NAMES = [
    "Sudden Accel",       # Original label 1 → index 0
    "Sudden Right Turn",  # Original label 2 → index 1
    "Sudden Left Turn",   # Original label 3 → index 2
    "Sudden Brake",       # Original label 4 → index 3
]
 
OUTPUT_DIR = "/model/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

RAW_SENSOR_DATA_PATH = "./data/sensor_raw.csv"
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
print("STEP 2: Sliding window extraction")
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
 