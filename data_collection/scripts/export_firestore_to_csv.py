"""
Export Firestore recordings to CSV for the KatEye training pipeline.

Each Firestore document (560 samples, 6 channels) is expanded into 560 rows
with synthetic TIME values. A 30-second gap is inserted between recordings so
that data_preparation.py's session detection (gap_threshold=5s) correctly
splits them into separate sessions.

Output CSV columns: ACTIVITY, TIME, ACCEL_X, ACCEL_Y, ACCEL_Z, GYRO_X, GYRO_Y, GYRO_Z
"""

import argparse
import sys
from datetime import datetime, timedelta

import firebase_admin
import pandas as pd
from firebase_admin import credentials, firestore

# Class names must match cnn_pipeline.py
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
]


def init_firebase(service_account_path: str) -> firestore.Client:
    """Initialize Firebase Admin SDK and return Firestore client."""
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)
    return firestore.client()


def fetch_recordings(db: firestore.Client, include_flagged: bool = False):
    """Fetch all non-flagged recordings from Firestore."""
    query = db.collection("recordings")
    if not include_flagged:
        query = query.where("flagged", "!=", True)

    docs = query.stream()
    recordings = []
    for doc in docs:
        data = doc.to_dict()
        data["_id"] = doc.id
        recordings.append(data)

    print(f"Fetched {len(recordings)} recordings from Firestore")
    return recordings


def recordings_to_dataframe(recordings: list, sample_rate_hz: int = 56) -> pd.DataFrame:
    """
    Convert Firestore recordings to a DataFrame matching the training CSV format.

    Each recording gets a unique base time. Samples are spaced at 1/sample_rate_hz.
    A 30-second gap is inserted between recordings for session detection.
    """
    all_rows = []
    # Start at an arbitrary base time
    current_time = datetime(2024, 1, 1, 0, 0, 0)
    sample_interval = timedelta(seconds=1.0 / sample_rate_hz)
    gap_between_recordings = timedelta(seconds=30)

    for rec in recordings:
        label_idx = rec.get("label", -1)
        if label_idx < 0 or label_idx >= len(CLASS_NAMES):
            print(f"  Skipping recording {rec.get('_id', '?')}: invalid label {label_idx}")
            continue

        label_name = CLASS_NAMES[label_idx]
        data = rec.get("data", {})

        # Extract channel arrays
        accel_x = data.get("accel_x", [])
        accel_y = data.get("accel_y", [])
        accel_z = data.get("accel_z", [])
        gyro_x = data.get("gyro_x", [])
        gyro_y = data.get("gyro_y", [])
        gyro_z = data.get("gyro_z", [])

        num_samples = rec.get("num_samples", len(accel_x))
        if len(accel_x) != num_samples:
            print(
                f"  Warning: recording {rec.get('_id', '?')} has "
                f"{len(accel_x)} samples, expected {num_samples}"
            )
            num_samples = min(len(accel_x), len(accel_y), len(accel_z),
                             len(gyro_x), len(gyro_y), len(gyro_z))

        for i in range(num_samples):
            t = current_time + i * sample_interval
            time_str = t.strftime("%H:%M:%S")

            all_rows.append({
                "ACTIVITY": label_name,
                "TIME": time_str,
                "ACCEL_X": accel_x[i],
                "ACCEL_Y": accel_y[i],
                "ACCEL_Z": accel_z[i],
                "GYRO_X": gyro_x[i],
                "GYRO_Y": gyro_y[i],
                "GYRO_Z": gyro_z[i],
            })

        # Advance time past this recording + gap
        current_time += num_samples * sample_interval + gap_between_recordings

    df = pd.DataFrame(all_rows)
    print(f"Generated {len(df)} rows from {len(recordings)} recordings")

    if len(df) > 0:
        print("\nClass distribution:")
        print(df["ACTIVITY"].value_counts().sort_index().to_string())

    return df


def main():
    parser = argparse.ArgumentParser(
        description="Export Firestore recordings to CSV for KatEye training pipeline"
    )
    parser.add_argument(
        "--service-account", "-s",
        required=True,
        help="Path to Firebase service account JSON key file",
    )
    parser.add_argument(
        "--output", "-o",
        default="collected_data.csv",
        help="Output CSV path (default: collected_data.csv)",
    )
    parser.add_argument(
        "--include-flagged",
        action="store_true",
        help="Include flagged (bad) recordings",
    )
    args = parser.parse_args()

    db = init_firebase(args.service_account)
    recordings = fetch_recordings(db, include_flagged=args.include_flagged)

    if not recordings:
        print("No recordings found. Exiting.")
        sys.exit(0)

    df = recordings_to_dataframe(recordings)

    if df.empty:
        print("No valid data to export. Exiting.")
        sys.exit(0)

    df.to_csv(args.output, index=False)
    print(f"\nExported to: {args.output}")


if __name__ == "__main__":
    main()
