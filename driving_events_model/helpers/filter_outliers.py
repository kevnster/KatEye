"""
helpers/filter_outliers.py

Removes noisy / mislabelled samples from the raw session DataFrame
before sliding-window extraction.

Data context
------------
  Source   : Smartphone IMU (not a fixed embedded sensor)
  Rate     : ~56 Hz
  Channels : ACCEL_X, ACCEL_Y, ACCEL_Z  (m/s²)
             GYRO_X,  GYRO_Y,  GYRO_Z   (rad/s)
  Gravity  : rides on ACCEL_Y (~9.81 m/s² when phone is upright)

Two complementary strategies are applied:

  Pass 1 — IQR per-sample filter
    For every (class, channel) pair declared in OUTLIER_CONFIG, any
    individual row whose value falls outside [Q1 - k*IQR, Q3 + k*IQR]
    is dropped.  Catches single-sample spikes, e.g. the GYRO_X/Y/Z
    outliers visible in the Idling box-plot.

  Pass 2 — Window-level std-dev filter for stationary classes
    After IQR cleaning, proto-windows are reconstructed using the same
    (window_size, hop_size) and time-sort order as extract_windows().
    Any window whose gyro std-dev exceeds `max_gyro_std` on any axis
    is discarded entirely.  A truly still phone must be quiet.

Design notes
------------
  • Pass 1 resets the DataFrame index before Pass 2 so that integer
    positional lookups inside sessions remain contiguous.
  • Proto-windows in Pass 2 are built with the same Hour/Minute/Second
    sort key used by extract_windows(), guaranteeing identical boundaries.
  • `max_gyro_std` defaults to 0.10 rad/s — calibrated for smartphone
    MEMS gyros at 56 Hz.  Tighten toward 0.05 only if your device is
    known to be very quiet at rest.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# ------------------------------------------------------------------ #
# Configuration                                                        #
# ------------------------------------------------------------------ #

# Per-class channel rules:  { class_label: [(column, iqr_multiplier), ...] }
#
# Idling — all gyro axes must be near-zero, and accel axes must stay
# within the expected static ranges.  Tighter k for gyros because any
# large rotation during a supposed idle is definitively mislabelled.
#
# ACCEL_Y is the gravity channel for an upright phone (~9.81 m/s²).
# Anything far from that is a bump / pickup event and should be removed.

OUTLIER_CONFIG: dict[str, list[tuple[str, float]]] = {
    "Idling": [
        # Gyro channels: must be near-zero — use tight multiplier
        ("GYRO_X", 1.5),
        ("GYRO_Y", 1.5),
        ("GYRO_Z", 1.5),
        # Lateral / vertical accel: small residual noise only
        ("ACCEL_X", 2.0),
        ("ACCEL_Z", 2.0),
        # Gravity axis: phone must stay upright; deviations = movement
        ("ACCEL_Y", 2.0),
    ],
    # Expand as box-plots reveal outliers in other classes, e.g.:
    # "Brake": [("ACCEL_Y", 2.5)],
    # "Aggressive Left": [("GYRO_Z", 2.0)],
}

# Gyro std-dev ceiling for the window-level Pass 2 filter.
# Smartphone MEMS gyros at 56 Hz have an idle noise floor of roughly
# 0.01–0.05 rad/s.  A threshold of 0.10 rad/s gives a comfortable
# margin above sensor noise while still rejecting accidental movements.
DEFAULT_MAX_GYRO_STD: float = 0.10

# Classes subjected to the window-level gyro std filter.
STILL_CLASSES: list[str] = ["Idling"]

GYRO_COLS:  list[str] = ["GYRO_X", "GYRO_Y", "GYRO_Z"]
TIME_SORT_COLS: list[str] = ["Hour", "Minute", "Second"]

# ── Pass 3 configuration ─────────────────────────────────────────── #
# Absolute mean gyro threshold for the session-level bimodal filter.
# Any session (of ANY class) whose mean |GYRO_X| or mean |GYRO_Z|
# exceeds this threshold is dropped entirely.
#
# Rationale: the training data contains spurious sessions with a
# sustained GYRO_X cluster at ~3.5 rad/s and GYRO_Z at ~-1.5 rad/s
# (visible as bimodal peaks in the channel histograms).  These are
# recording artefacts — real driving gyro should oscillate around zero,
# not sit at a large DC offset.  They inflate std_gx / std_gz and cause
# the normalizer to amplify MPU6050 idle noise by ×20–×42.
#
# 0.5 rad/s (~28°/s) is well above the sensor noise floor but well
# below the artefact clusters.  Adjust if your data's legitimate
# manoeuvre sessions are being incorrectly dropped (check the verbose
# output for which sessions are removed and which class they belong to).
DEFAULT_MAX_SESSION_GYRO_MEAN: float = 0.5   # rad/s

# Axes to check in the session-level filter.
SESSION_GYRO_CHECK_COLS: list[str] = ["GYRO_X", "GYRO_Z"]


# ================================================================== #
#  Public API                                                         #
# ================================================================== #

def filter_outliers(
    df: pd.DataFrame,
    label_col: str = "ACTIVITY",
    session_col: str = "SessionID",          # matches data_preparation.py output
    window_size: int = 112,
    hop_size: int = 56,
    outlier_config: dict[str, list[tuple[str, float]]] | None = None,
    still_classes: list[str] | None = None,
    max_gyro_std: float = DEFAULT_MAX_GYRO_STD,
    max_session_gyro_mean: float = DEFAULT_MAX_SESSION_GYRO_MEAN,
    verbose: bool = True,
) -> pd.DataFrame:
    """
    Clean the raw session DataFrame in two passes.

    Parameters
    ----------
    df            : Raw sessions DataFrame — output of prepare_data().
                    Must contain: ACTIVITY, SessionID, Hour, Minute, Second,
                    ACCEL_X/Y/Z, GYRO_X/Y/Z.
    label_col     : Column holding the class label string. Default "ACTIVITY".
    session_col   : Column holding the session identifier. Default "SessionID"
                    (matches the output of data_preparation.prepare_data()).
    window_size   : Must equal the window_size passed to extract_windows().
    hop_size      : Must equal the hop_size passed to extract_windows().
    outlier_config: Override module-level OUTLIER_CONFIG.
    still_classes : Override module-level STILL_CLASSES.
    max_gyro_std  : Gyro std-dev ceiling (rad/s) for the window-level filter.
    max_session_gyro_mean : Absolute mean gyro ceiling (rad/s) for the
                    session-level bimodal artefact filter (Pass 3).
                    Any session in any class whose mean |GYRO_X| or mean
                    |GYRO_Z| exceeds this is dropped entirely.
                    Default 0.5 rad/s.
    verbose       : Print a per-step removal report.

    Returns
    -------
    Cleaned DataFrame with a fresh contiguous index.
    """

    # ── Validate inputs ───────────────────────────────────────────
    _check_required_columns(df, label_col, session_col)

    if outlier_config is None:
        outlier_config = OUTLIER_CONFIG
    if still_classes is None:
        still_classes = STILL_CLASSES

    rows_initial = len(df)
    _log(f"\nOutlier filter started — {rows_initial:,} rows total", verbose)

    # ── Pass 1: IQR per-sample filter ────────────────────────────
    df = _iqr_filter(df, label_col, outlier_config, verbose)

    # Reset index so Pass 2 positional slicing is contiguous
    # (Pass 1 leaves gaps wherever rows were dropped)
    df = df.reset_index(drop=True)

    # ── Pass 2: Window-level gyro std filter ─────────────────────
    df = _window_std_filter(
        df, label_col, session_col,
        still_classes, window_size, hop_size, max_gyro_std, verbose,
    )

    df = df.reset_index(drop=True)

    # ── Pass 3: Session-level bimodal gyro artefact filter ───────
    # Targets the spurious DC-offset gyro clusters (e.g. GYRO_X ≈ 3.5 rad/s,
    # GYRO_Z ≈ −1.5 rad/s) that appear in any class and corrupt the training
    # distribution, causing std_gx / std_gz to be artificially inflated.
    df = _session_gyro_mean_filter(
        df, label_col, session_col, max_session_gyro_mean, verbose,
    )

    # Final reset so downstream code gets a clean 0…N-1 index
    df = df.reset_index(drop=True)

    rows_final = len(df)
    removed    = rows_initial - rows_final
    pct        = removed / rows_initial * 100 if rows_initial else 0.0
    _log(
        f"\nOutlier filter complete: "
        f"{rows_initial:,} → {rows_final:,} rows  "
        f"({removed:,} removed, {pct:.1f}%)",
        verbose,
    )
    _log(_class_summary(df, label_col), verbose)

    return df


# ================================================================== #
#  Internal helpers                                                   #
# ================================================================== #

def _check_required_columns(
    df: pd.DataFrame,
    label_col: str,
    session_col: str,
) -> None:
    """Raise clearly if columns that later passes depend on are absent."""
    required = {label_col, session_col} | set(TIME_SORT_COLS) | set(GYRO_COLS)
    missing  = required - set(df.columns)
    if missing:
        raise ValueError(
            f"filter_outliers: DataFrame is missing required columns: {sorted(missing)}\n"
            f"Available columns: {sorted(df.columns.tolist())}"
        )


def _iqr_filter(
    df: pd.DataFrame,
    label_col: str,
    config: dict[str, list[tuple[str, float]]],
    verbose: bool,
) -> pd.DataFrame:
    """
    Drop individual rows that fall outside IQR bounds for each
    (class, channel) pair declared in config.

    All class rules are evaluated against the *original* quantiles
    (computed before any rows are dropped within that class), so the
    order of rules within a class does not affect the outcome.
    """
    _log("\n  Pass 1 — IQR per-sample filter", verbose)

    # Build a single boolean keep-mask over the whole DataFrame.
    # Start with all True; flip to False for outlier rows.
    keep_mask = pd.Series(True, index=df.index)

    for cls, channel_rules in config.items():
        cls_mask = df[label_col] == cls
        cls_idx  = df.index[cls_mask]

        if cls_idx.empty:
            _log(f"    [{cls}] — not found in DataFrame, skipping", verbose)
            continue

        n_before = int(cls_mask.sum())
        _log(f"\n    [{cls}] — {n_before:,} rows", verbose)

        for col, k in channel_rules:
            if col not in df.columns:
                _log(f"      {col:<12} — column missing, skipping", verbose)
                continue

            series   = df.loc[cls_idx, col]
            Q1, Q3   = series.quantile(0.25), series.quantile(0.75)
            IQR      = Q3 - Q1

            # IQR == 0 means all values are identical; skip to avoid
            # a degenerate zero-width interval that would drop everything.
            if IQR == 0.0:
                _log(
                    f"      {col:<12} k={k}  IQR=0 (constant column) — skipping",
                    verbose,
                )
                continue

            lo, hi  = Q1 - k * IQR, Q3 + k * IQR
            out_idx = cls_idx[(series < lo) | (series > hi)]
            keep_mask.loc[out_idx] = False

            _log(
                f"      {col:<12} k={k}  "
                f"bounds=[{lo:+.4f}, {hi:+.4f}]  "
                f"removed {len(out_idx):,}",
                verbose,
            )

        n_after  = int((cls_mask & keep_mask).sum())
        _log(
            f"      → {n_after:,} rows remain  "
            f"({n_before - n_after:,} removed)",
            verbose,
        )

    return df[keep_mask].copy()


def _window_std_filter(
    df: pd.DataFrame,
    label_col: str,
    session_col: str,
    still_classes: list[str],
    window_size: int,
    hop_size: int,
    max_gyro_std: float,
    verbose: bool,
) -> pd.DataFrame:
    """
    For each still class, reconstruct proto-windows using the identical
    time-sort key and (window_size, hop_size) used by extract_windows().

    Any proto-window whose gyro std-dev exceeds max_gyro_std on *any*
    axis is discarded by marking all of its row indices as bad.

    Note: This operates on the *reset* index produced by _iqr_filter's
    caller, so positional arithmetic inside each session is valid.
    """
    _log(
        f"\n  Pass 2 — Window-level gyro std filter "
        f"(threshold = {max_gyro_std} rad/s)",
        verbose,
    )

    bad_idx: set[int] = set()

    for cls in still_classes:
        cls_mask = df[label_col] == cls
        if not cls_mask.any():
            _log(f"    [{cls}] — not found, skipping", verbose)
            continue

        windows_checked = 0
        windows_dropped = 0

        for session_id, sess_df in df[cls_mask].groupby(session_col):

            # Sort exactly as extract_windows does so window boundaries match
            sess_sorted = sess_df.sort_values(TIME_SORT_COLS)
            idx_list    = sess_sorted.index.tolist()   # integer positions after reset
            n           = len(idx_list)
            start       = 0

            while start + window_size <= n:
                win_idx = idx_list[start : start + window_size]
                window  = df.loc[win_idx, GYRO_COLS]

                windows_checked += 1
                noisy_col = next(
                    (col for col in GYRO_COLS if window[col].std() > max_gyro_std),
                    None,
                )

                if noisy_col is not None:
                    bad_idx.update(win_idx)
                    windows_dropped += 1

                start += hop_size

        drop_pct = windows_dropped / max(windows_checked, 1) * 100
        _log(
            f"    [{cls}] — checked {windows_checked} proto-windows, "
            f"dropped {windows_dropped} ({drop_pct:.1f}%)",
            verbose,
        )

    return df.drop(index=list(bad_idx)).copy()


def _session_gyro_mean_filter(
    df: pd.DataFrame,
    label_col: str,
    session_col: str,
    max_session_gyro_mean: float,
    verbose: bool,
) -> pd.DataFrame:
    """
    Drop entire sessions (from any class) whose mean absolute gyro value
    on GYRO_X or GYRO_Z exceeds max_session_gyro_mean.

    This targets bimodal DC-offset artefacts in the training data where
    the recording device had a sustained rotation offset rather than
    oscillating around zero as genuine driving data does.  Such sessions
    inflate the per-channel std used for z-score normalisation, causing
    the deployed sensor's near-zero idle readings to be amplified into
    extreme normalised values the model associates with other classes.
    """
    _log(
        f"\n  Pass 3 — Session-level bimodal gyro filter "
        f"(|mean| threshold = {max_session_gyro_mean} rad/s on GYRO_X / GYRO_Z)",
        verbose,
    )

    bad_sessions: set = set()
    session_counts: dict[str, int] = {}

    for session_id, sess_df in df.groupby(session_col):
        cls = sess_df[label_col].iloc[0]
        for col in SESSION_GYRO_CHECK_COLS:
            if col not in df.columns:
                continue
            if sess_df[col].abs().mean() > max_session_gyro_mean:
                bad_sessions.add(session_id)
                session_counts[cls] = session_counts.get(cls, 0) + 1
                break   # one bad axis is enough to reject the session

    total_dropped = len(bad_sessions)
    if total_dropped == 0:
        _log("    No sessions exceeded the threshold — nothing removed", verbose)
    else:
        _log(f"    Dropping {total_dropped} sessions:", verbose)
        for cls, n in sorted(session_counts.items()):
            _log(f"      {cls}: {n} session(s)", verbose)

    return df[~df[session_col].isin(bad_sessions)].copy()


def _class_summary(df: pd.DataFrame, label_col: str) -> str:
    """Return a one-line-per-class row count summary after filtering."""
    counts = df[label_col].value_counts().sort_index()
    lines  = ["\n  Post-filter class counts:"]
    for cls, n in counts.items():
        lines.append(f"    {cls}: {n:,}")
    return "\n".join(lines)


def _log(msg: str, verbose: bool) -> None:
    if verbose:
        print(msg)