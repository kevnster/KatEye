
 
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
 
OUTPUT_DIR = "model/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)


print("\n" + "=" * 60)
print("Converting to TFLite (INT8 quantized) :D")
print("=" * 60)


def representative_dataset_gen():
    """Calibration data for INT8 quantization.
    Uses a subset of training data to determine activation ranges."""
    for i in range(min(100, len(X_train))):
        sample = X_train[i : i + 1].astype(np.float32)
        yield [sample]


# --- Full float32 TFLite (for comparison) ---

model = keras.saving.load_model('model/output/driving_cnn.keras')


converter_f32 = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_f32 = converter_f32.convert()
f32_path = os.path.join(OUTPUT_DIR, "driving_cnn_f32.tflite")
with open(f32_path, "wb") as f:
    f.write(tflite_f32)
print(f"Float32 TFLite: {os.path.getsize(f32_path) / 1024:.1f} KB → {f32_path}")

# --- INT8 fully quantized TFLite (for ESP32-S3) ---
converter_int8 = tf.lite.TFLiteConverter.from_keras_model(model)
converter_int8.optimizations = [tf.lite.Optimize.DEFAULT]
converter_int8.representative_dataset = representative_dataset_gen
converter_int8.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS_INT8
]
converter_int8.inference_input_type  = tf.int8
converter_int8.inference_output_type = tf.int8

tflite_int8 = converter_int8.convert()
int8_path = os.path.join(OUTPUT_DIR, "driving_cnn_int8.tflite")
with open(int8_path, "wb") as f:
    f.write(tflite_int8)
print(f"INT8 TFLite:    {os.path.getsize(int8_path) / 1024:.1f} KB → {int8_path}")


