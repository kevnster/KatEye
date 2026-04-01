import os
import numpy as np
import tensorflow as tf
from ai_edge_litert.interpreter import Interpreter

def convert_to_tflite(model, X_train, output_dir, model_name="driving_cnn"):
    """
    Converts a trained Keras model to two TFLite formats:
        1. Float32 — for baseline comparison
        2. INT8 fully quantised — for ESP32-S3 deployment

    INT8 quantisation uses a representative dataset drawn from X_train
    to calibrate activation ranges at every layer.

    Args:
        model       : trained keras.Model
        X_train     : np.ndarray, shape (N, window_size, n_channels) — calibration data
        output_dir  : str  — directory to write .tflite files (created if needed)
        model_name  : str  — base filename, e.g. "driving_cnn" produces
                             "driving_cnn_f32.tflite" and "driving_cnn_int8.tflite"

    Returns:
        f32_path    : str         — path to float32 .tflite file
        int8_path   : str         — path to INT8 .tflite file
        tflite_int8 : bytes       — raw INT8 model bytes (for C header generation)

    Raises:
        ValueError — if X_train is empty or output_dir cannot be created
    """

    # Guard clauses                                                        #
    if len(X_train) == 0:
        raise ValueError("X_train is empty — cannot generate representative dataset")
    os.makedirs(output_dir, exist_ok=True)

    # Representative dataset (calibration for INT8)                       #
    n_calibration = min(100, len(X_train))

    def representative_dataset_gen():
        for i in range(n_calibration):
            sample = X_train[i : i + 1].astype(np.float32)
            yield [sample]

    # Float32 TFLite — baseline, no quantisation   

    converter_f32  = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_f32     = converter_f32.convert()
    f32_path       = os.path.join(output_dir, f"{model_name}_f32.tflite")
    with open(f32_path, "wb") as f:
        f.write(tflite_f32)
    print(f"Float32 TFLite : {os.path.getsize(f32_path) / 1024:.1f} KB → {f32_path}")

    # INT8 fully quantised TFLite — ESP32-S3 deployment target           #
    converter_int8                            = tf.lite.TFLiteConverter.from_keras_model(model)
    converter_int8.optimizations              = [tf.lite.Optimize.DEFAULT]
    converter_int8.representative_dataset     = representative_dataset_gen
    converter_int8.target_spec.supported_ops  = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter_int8.inference_input_type       = tf.int8
    converter_int8.inference_output_type      = tf.int8

    tflite_int8  = converter_int8.convert()
    int8_path    = os.path.join(output_dir, f"{model_name}_int8.tflite")
    with open(int8_path, "wb") as f:
        f.write(tflite_int8)
    print(f"INT8 TFLite    : {os.path.getsize(int8_path) / 1024:.1f} KB → {int8_path}")

    # Size reduction summary
    f32_kb   = os.path.getsize(f32_path)  / 1024
    int8_kb  = os.path.getsize(int8_path) / 1024
    print(f"Size reduction : {f32_kb:.1f} KB → {int8_kb:.1f} KB "
          f"({100 * (1 - int8_kb / f32_kb):.1f}% smaller)")

    return f32_path, int8_path, tflite_int8


def verify_tflite(int8_path, X_test, y_test, keras_test_acc):
    """
    Loads the INT8 TFLite model and runs inference on the full test set.
    Reports accuracy and quantisation loss vs the original Keras model.

    Each sample is quantised from float32 to int8 using the scale and
    zero_point baked into the model during conversion, then fed to the
    interpreter one sample at a time (TFLite does not support batch inference).

    Args:
        int8_path      : str        — path to the INT8 .tflite file
        X_test         : np.ndarray, shape (N, window_size, n_channels)
        y_test         : np.ndarray, shape (N,) — true integer labels
        keras_test_acc : float      — Keras model test accuracy for comparison

    Returns:
        tflite_preds   : np.ndarray, shape (N,) — predicted class indices
        tflite_acc     : float      — INT8 model accuracy on test set
        input_scale    : float      — quantisation scale (needed for C header / firmware)
        input_zp       : int        — quantisation zero point (needed for C header / firmware)

    Raises:
        FileNotFoundError — if int8_path does not exist
        ValueError        — if X_test and y_test are mismatched
    """

    # Guard clauses                                                        #
    if not os.path.exists(int8_path):
        raise FileNotFoundError(f"TFLite model not found: {int8_path}")
    if len(X_test) != len(y_test):
        raise ValueError(
            f"X_test and y_test length mismatch: {len(X_test)} vs {len(y_test)}"
        )

    # Load interpreter and inspect tensors                                #
    interpreter = Interpreter(model_path=int8_path)
    interpreter.allocate_tensors()

    input_details  = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    print(f"TFLite input  : {input_details[0]['shape']}  dtype={input_details[0]['dtype']}")
    print(f"TFLite output : {output_details[0]['shape']} dtype={output_details[0]['dtype']}")

    input_scale = input_details[0]["quantization_parameters"]["scales"][0]
    input_zp    = input_details[0]["quantization_parameters"]["zero_points"][0]
    print(f"Input quantization : scale={input_scale:.6f}, zero_point={input_zp}")

    # Run inference sample-by-sample                                      #
    tflite_preds = []
    for i in range(len(X_test)):
        sample      = X_test[i : i + 1].astype(np.float32)
        sample_int8 = (sample / input_scale + input_zp).astype(np.int8)

        interpreter.set_tensor(input_details[0]["index"], sample_int8)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]["index"])
        tflite_preds.append(int(np.argmax(output, axis=1)[0]))

    tflite_preds = np.array(tflite_preds)
    tflite_acc   = float(np.mean(tflite_preds == y_test))

    # Verification printout                                               #
    quant_loss = keras_test_acc - tflite_acc
    print(f"\nKeras accuracy   : {keras_test_acc:.4f}")
    print(f"TFLite INT8 acc  : {tflite_acc:.4f}")
    print(f"Quantisation loss: {quant_loss:.4f}")

    if quant_loss > 0.02:
        print("Warning: quantisation loss > 2% — consider increasing "
              "representative dataset size or allowing mixed precision")
    else:
        print("Quantisation loss within acceptable range (< 2%)")

    return tflite_preds, tflite_acc, input_scale, input_zp


def export_c_header(
    tflite_int8,
    output_dir,
    input_scale,
    input_zp,
    window_size,
    n_channels,
    n_classes,
    sensor_cols,
    class_names,
    train_mean,
    train_std,
    array_name  = "driving_cnn_model",
    filename    = "driving_cnn_model.h",
):
    """
    Converts INT8 TFLite model bytes into a C header file for ESP32-S3 firmware.

    The header contains:
        - The model as a uint8_t byte array with alignas(8) alignment
        - Per-channel normalisation constants (mean, std) as comments
        - Quantisation parameters (scale, zero_point) as comments
        - Class name and shape metadata as comments

    The firmware must apply normalisation then quantisation to raw sensor
    data before feeding it to TFLite Micro — the embedded comments provide
    the exact constants required.

    Args:
        tflite_int8 : bytes      — raw INT8 model bytes from convert_to_tflite()
        output_dir  : str        — directory to write the header (created if needed)
        input_scale : float      — quantisation scale from verify_tflite()
        input_zp    : int        — quantisation zero point from verify_tflite()
        window_size : int        — timesteps per inference window
        n_channels  : int        — number of sensor channels
        n_classes   : int        — number of output classes
        sensor_cols : list[str]  — sensor column names (for normalisation comments)
        class_names : list[str]  — activity names ordered by label index
        train_mean  : np.ndarray, shape (n_channels,) — per-channel means from scaler
        train_std   : np.ndarray, shape (n_channels,) — per-channel stds from scaler
        array_name  : str        — C identifier for the model array. Default "driving_cnn_model".
        filename    : str        — output filename. Default "driving_cnn_model.h".

    Returns:
        header_path : str — absolute path to the saved .h file

    Raises:
        ValueError — if train_mean / train_std length doesn't match n_channels
    """

    # Guard clauses                                                        #
    if len(train_mean) != n_channels or len(train_std) != n_channels:
        raise ValueError(
            f"train_mean/train_std length ({len(train_mean)}/{len(train_std)}) "
            f"must match n_channels ({n_channels})"
        )
    os.makedirs(output_dir, exist_ok=True)

    # Write header                                                        #

    header_path = os.path.join(output_dir, filename)
    guard       = array_name.upper() + "_H"

    with open(header_path, "w") as f:

        # File-level comments — preprocessing constants for firmware
        f.write( "// Auto-generated TFLite model for ESP32-S3\n")
        f.write( "// Model  : 1D CNN Driving Behaviour Classifier\n")
        f.write(f"// Input  : INT8 tensor shape (1, {window_size}, {n_channels})\n")
        f.write(f"// Output : INT8 tensor shape (1, {n_classes})\n")
        f.write(f"// Classes: {', '.join(class_names)}\n")
        f.write( "//\n")
        f.write( "// Preprocessing (apply in order before inference):\n")
        f.write( "//   Step 1 — z-score normalise each channel:\n")
        for i, col in enumerate(sensor_cols):
            f.write(f"//     {col}: (raw - {train_mean[i]:.6f}) / {train_std[i]:.6f}\n")
        f.write(f"//   Step 2 — quantise to INT8:\n")
        f.write(f"//     int8_val = (float_val / {input_scale:.6f}) + {input_zp}\n")
        f.write( "//\n")
        f.write(f"// Size: {len(tflite_int8)} bytes\n\n")

        # Include guard
        f.write(f"#ifndef {guard}\n")
        f.write(f"#define {guard}\n\n")
        f.write( "#include <stdint.h>\n\n")

        # Array declaration
        f.write(f"const unsigned int {array_name}_len = {len(tflite_int8)};\n")
        f.write(f"alignas(8) const uint8_t {array_name}[] = {{\n")

        # Hex bytes — 12 per line
        for i, byte in enumerate(tflite_int8):
            if i % 12 == 0:
                f.write("  ")
            f.write(f"0x{byte:02x}")
            if i < len(tflite_int8) - 1:
                f.write(", ")
            if (i + 1) % 12 == 0:
                f.write("\n")

        f.write("\n};\n\n")
        f.write(f"#endif // {guard}\n")

    # Verification printout                                               #
    print(f"Saved C header → {header_path}")
    print(f"File size      : {os.path.getsize(header_path) / 1024:.1f} KB")
    print(f"Model bytes    : {len(tflite_int8):,}")

    return header_path