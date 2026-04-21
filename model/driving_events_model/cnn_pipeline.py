"""
Driving Behavior Classifier — Goh Dataset

Architecture
- 1D Convolutional Neural Network
- reference SKILL.md

Input: Smartphone IMU raw data (ACCEL_X, ACCEL_Y, ACCEL_Z, GYRO_X, GYRO_Y, GYRO_Z) @ ~56 Hz

Output:  9-class classification

Classes:
- 0 = Accelerate
- 1 = Aggressive Accelerate
- 2 = Aggressive Brake
- 3 = Aggressive Left
- 4 = Aggressive Right
- 5 = Brake
- 6 = Idling
- 7 = Left
- 8 = Right

TF model --> TFLite INT8 model for ESP32-S3
"""

import os
import numpy as np
import pandas as pd
import sqlite3
import matplotlib.pyplot as plt
import tensorflow as tf
from sklearn.model_selection import StratifiedGroupKFold, train_test_split
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import (
    classification_report, confusion_matrix, ConfusionMatrixDisplay
)
from ai_edge_litert.interpreter import Interpreter

from helpers.data_preparation import prepare_data
from helpers.extract_windows import extract_windows
from helpers.split_data import split_data
from helpers.build_dataset import normalize, build_datasets
from helpers.build_cnn_model import compute_class_weights, build_cnn_model, save_model
from helpers.train_eval import train_model, evaluate_model
from helpers.plot_save_results import plot_results
from helpers.tflite_convert import convert_to_tflite, verify_tflite, export_c_header
from helpers.filter_outliers import filter_outliers  

SEED = 0
np.random.seed(SEED)
tf.random.set_seed(SEED)

WINDOW_SIZE   = 112
HOP_SIZE      = 56
N_CHANNELS    = 6
N_CLASSES     = 9
BATCH_SIZE    = 32
MAX_EPOCHS    = 200
PATIENCE      = 15
LEARNING_RATE = 1e-3

SENSOR_COLS = ["ACCEL_X", "ACCEL_Y", "ACCEL_Z", "GYRO_X", "GYRO_Y", "GYRO_Z"]
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

OUTPUT_DIR              = "model/output"
DRIVING_EVENT_DATA_PATH = "./data/driving_events.db"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def run_pipeline():

    print("=" * 60)
    print("1 — Loading data and splitting into sessions")
    print("=" * 60)

    df_sessions = prepare_data(
        path             = DRIVING_EVENT_DATA_PATH,
        max_session_rows = 3000,
        gap_threshold    = 5,
    )

    print("\n" + "=" * 60)
    print("1b — Outlier filtering (pre-windowing)")
    print("=" * 60)

    df_sessions = filter_outliers(
        df                   = df_sessions,
        label_col            = "ACTIVITY",
        session_col          = "SessionID",
        window_size          = WINDOW_SIZE,   # must match extract_windows
        hop_size             = HOP_SIZE,      # must match extract_windows
        max_gyro_std         = 0.045,         # rad/s — Pass 2: still-class window filter
        max_session_gyro_mean= 0.5,           # rad/s — Pass 3: bimodal artefact filter
        verbose              = True,
    )

    # -------------------------------------------------------------- #
    # 2. Sliding window extraction                                    #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("2 — Sliding window extraction")
    print("=" * 60)

    X_all, y_all, groups_all = extract_windows(
        df          = df_sessions,
        window_size = WINDOW_SIZE,
        hop_size    = HOP_SIZE,
        sensor_cols = SENSOR_COLS,
        class_names = CLASS_NAMES,
    )

    # -------------------------------------------------------------- #
    # 3. Train / val / test split                                     #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("3 — Train/test split (stratified by class, grouped by session)")
    print("=" * 60)

    X_train_raw, y_train, X_val_raw, y_val, X_test_raw, y_test = split_data(
        X           = X_all,
        y           = y_all,
        groups      = groups_all,
        class_names = CLASS_NAMES,
        n_splits    = 3,
        val_size    = 0.2,
        seed        = SEED,
    )

    # -------------------------------------------------------------- #
    # 4. Normalisation                                                #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("4 — Normalisation")
    print("=" * 60)

    X_train, X_val, X_test, scaler = normalize(
        X_train = X_train_raw,
        X_val   = X_val_raw,
        X_test  = X_test_raw,
    )

    # Expose per-channel stats for C header generation
    train_mean = scaler.mean_
    train_std  = scaler.scale_

    # -------------------------------------------------------------- #
    # 5. tf.data pipeline with on-the-fly augmentation               #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("5 — Building tf.data pipeline with on-the-fly augmentation")
    print("=" * 60)

    train_ds, val_ds, test_ds = build_datasets(
        X_train      = X_train,
        y_train      = y_train,
        X_val        = X_val,
        y_val        = y_val,
        X_test       = X_test,
        y_test       = y_test,
        batch_size   = BATCH_SIZE,
        n_channels   = N_CHANNELS,
        seed         = SEED,
    )

    # -------------------------------------------------------------- #
    # 6. Class weights                                                #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("6 — Computing class weights for imbalanced data")
    print("=" * 60)

    class_weight_dict = compute_class_weights(
        y_train   = y_train,
        n_classes = N_CLASSES,
    )

    # -------------------------------------------------------------- #
    # 7. Build model                                                  #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("7 — Building 1D CNN model (ESP32-S3 optimised)")
    print("=" * 60)

    model = build_cnn_model(
        window_size   = WINDOW_SIZE,
        n_channels    = N_CHANNELS,
        n_classes     = N_CLASSES,
        learning_rate = LEARNING_RATE,
        dropout_rate  = 0.4,
    )

    # -------------------------------------------------------------- #
    # 8. Training                                                     #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("8 — Training with early stopping")
    print("=" * 60)

    history = train_model(
        model             = model,
        train_ds          = train_ds,
        val_ds            = val_ds,
        class_weight_dict = class_weight_dict,
        max_epochs        = MAX_EPOCHS,
        patience          = PATIENCE,
    )

    # -------------------------------------------------------------- #
    # 9. Evaluation                                                   #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("9 — Evaluation on test set")
    print("=" * 60)

    y_pred, test_loss, test_acc = evaluate_model(
        model       = model,
        test_ds     = test_ds,
        X_test      = X_test,
        y_test      = y_test,
        class_names = CLASS_NAMES,
    )

    # -------------------------------------------------------------- #
    # 10. Visualisations                                              #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("10 — Generating visualisations")
    print("=" * 60)

    plot_results(
        history    = history,
        y_test     = y_test,
        y_pred     = y_pred,
        class_names= CLASS_NAMES,
        output_dir = OUTPUT_DIR,
    )

    # -------------------------------------------------------------- #
    # 11. Save Keras model                                            #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("11 — Saving Keras model")
    print("=" * 60)

    save_model(
        model      = model,
        output_dir = OUTPUT_DIR,
        filename   = "driving_cnn.keras",
    )

    # -------------------------------------------------------------- #
    # 12. TFLite conversion (float32 + INT8)                         #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("12 — Converting to TFLite (INT8 quantised)")
    print("=" * 60)

    f32_path, int8_path, tflite_int8 = convert_to_tflite(
        model      = model,
        X_train    = X_train,
        output_dir = OUTPUT_DIR,
    )

    # -------------------------------------------------------------- #
    # 13. Verify TFLite accuracy                                      #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("13 — Verifying TFLite INT8 accuracy")
    print("=" * 60)

    tflite_preds, tflite_acc, input_scale, input_zp = verify_tflite(
        int8_path      = int8_path,
        X_test         = X_test,
        y_test         = y_test,
        keras_test_acc = test_acc,
    )

    # 14. Export C header for ESP32-S3 firmware                      
    print("\n" + "=" * 60)
    print("14 — Generating C header for ESP32-S3 firmware")
    print("=" * 60)

    export_c_header(
        tflite_int8 = tflite_int8,
        output_dir  = OUTPUT_DIR,
        input_scale = input_scale,
        input_zp    = input_zp,
        window_size = WINDOW_SIZE,
        n_channels  = N_CHANNELS,
        n_classes   = N_CLASSES,
        sensor_cols = SENSOR_COLS,
        class_names = CLASS_NAMES,
        train_mean  = train_mean,
        train_std   = train_std,
    )

    # -------------------------------------------------------------- #
    # Pipeline complete                                               #
    # -------------------------------------------------------------- #
    print("\n" + "=" * 60)
    print("Pipeline complete")
    print("=" * 60)
    print(f"  Keras model  : {os.path.join(OUTPUT_DIR, 'driving_cnn.keras')}")
    print(f"  TFLite INT8  : {int8_path}")
    print(f"  C header     : {os.path.join(OUTPUT_DIR, 'driving_cnn_model.h')}")
    print(f"  Plots        : {os.path.join(OUTPUT_DIR, 'training_results.png')}")
    print(f"  Keras acc    : {test_acc:.4f}")
    print(f"  TFLite acc   : {tflite_acc:.4f}")
    print(f"  Quant loss   : {test_acc - tflite_acc:.4f}")

    return {
        "model"       : model,
        "history"     : history,
        "scaler"      : scaler,
        "test_acc"    : test_acc,
        "tflite_acc"  : tflite_acc,
        "y_pred"      : y_pred,
        "tflite_preds": tflite_preds,
    }


if __name__ == "__main__":
    results = run_pipeline()