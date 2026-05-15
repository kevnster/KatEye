"""
Merge the original training data with collected hardware data.

Loads both data sources via prepare_data(), offsets SessionIDs from the
collected data to avoid collisions, and returns a unified DataFrame.

Usage:
    python merge_datasets.py --original ../model_src/data/driving_events.db \
                             --collected collected_data.csv \
                             --output merged_data.csv
"""

import argparse
import sys
import os

import pandas as pd

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from KatEye.model_src.driving_events_model.helpers.data_preparation import prepare_data


def merge_datasets(
    original_path: str,
    collected_path: str,
    gap_threshold: int = 5,
    max_session_rows: int = 3000,
) -> pd.DataFrame:
    """
    Load and merge original + collected datasets with non-overlapping SessionIDs.

    Args:
        original_path:    Path to original data (.db or .csv)
        collected_path:   Path to collected data (.csv)
        gap_threshold:    Seconds gap to split sessions (default 5)
        max_session_rows: Max rows per session chunk (default 3000)

    Returns:
        Combined DataFrame with columns including SessionID
    """
    print("=" * 60)
    print("Loading original dataset")
    print("=" * 60)
    df_original = prepare_data(
        path=original_path,
        max_session_rows=max_session_rows,
        gap_threshold=gap_threshold,
    )

    print("\n" + "=" * 60)
    print("Loading collected dataset")
    print("=" * 60)
    df_collected = prepare_data(
        path=collected_path,
        max_session_rows=max_session_rows,
        gap_threshold=gap_threshold,
    )

    # Offset collected SessionIDs to avoid collisions
    max_original_session = df_original["SessionID"].max()
    df_collected["SessionID"] += max_original_session + 1

    # Concatenate
    df_merged = pd.concat([df_original, df_collected], ignore_index=True)

    print("\n" + "=" * 60)
    print("Merged dataset summary")
    print("=" * 60)
    print(f"  Original sessions:  {df_original['SessionID'].nunique()}")
    print(f"  Collected sessions: {df_collected['SessionID'].nunique()}")
    print(f"  Total sessions:     {df_merged['SessionID'].nunique()}")
    print(f"  Total rows:         {len(df_merged)}")
    print(f"\nClass distribution:")
    print(df_merged["ACTIVITY"].value_counts().sort_index().to_string())

    return df_merged


def main():
    parser = argparse.ArgumentParser(
        description="Merge original and collected datasets for KatEye fine-tuning"
    )
    parser.add_argument(
        "--original",
        required=True,
        help="Path to original training data (.db or .csv)",
    )
    parser.add_argument(
        "--collected",
        required=True,
        help="Path to collected hardware data (.csv)",
    )
    parser.add_argument(
        "--output", "-o",
        default="merged_data.csv",
        help="Output CSV path (default: merged_data.csv)",
    )
    args = parser.parse_args()

    df_merged = merge_datasets(args.original, args.collected)

    # Export (drop helper columns that prepare_data adds)
    export_cols = ["ACTIVITY", "TIME", "ACCEL_X", "ACCEL_Y", "ACCEL_Z",
                   "GYRO_X", "GYRO_Y", "GYRO_Z"]
    df_merged[export_cols].to_csv(args.output, index=False)
    print(f"\nExported merged data to: {args.output}")


if __name__ == "__main__":
    main()
