#include <Arduino.h>
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/system_setup.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "driving_cnn_model.h"

#include "I2Cdev.h"
#include "MPU6050.h"
#include "Wire.h"

// ─── Constants ───────────────────────────────────────────────────────────────

namespace {

  // Model I/O
  const tflite::Model*      model       = nullptr;
  tflite::MicroInterpreter* interpreter = nullptr;
  TfLiteTensor*             input       = nullptr;
  TfLiteTensor*             output      = nullptr;

  constexpr int kTensorArenaSize = 64 * 1024;
  uint8_t* tensor_arena = nullptr;

  // MPU
  MPU6050 mpu;

  // Window
  constexpr int WINDOW_SIZE    = 112;
  constexpr int NUM_CHANNELS   = 6;
  constexpr int SAMPLE_RATE_HZ = 56;          // Must match training
  constexpr int SAMPLE_PERIOD_MS = 1000 / SAMPLE_RATE_HZ;

  // Class labels
  const char* const CLASS_NAMES[] = {
    "Accelerate", "Aggressive Accelerate", "Aggressive Brake",
    "Aggressive Left", "Aggressive Right", "Brake",
    "Idling", "Left", "Right"
  };
  constexpr int NUM_CLASSES = 9;

  // ── Sensor biases (set during calibration in setup) ──
  float bias_ax = 0, bias_ay = 0, bias_az = 0;
  float bias_gx = 0, bias_gy = 0, bias_gz = 0;

  // ── Z-score params from training (physical units) ──
  // Accel in m/s², Gyro in rad/s
  const float mean_ax = 0.0910f,  std_ax = 1.0028f;
  const float mean_ay = 9.7665f,  std_ay = 0.3390f;
  const float mean_az = 0.0544f,  std_az = 1.2132f;
  const float mean_gx = -0.0008f, std_gx = 0.0487f;
  const float mean_gy = -0.0115f, std_gy = 0.2636f;
  const float mean_gz = 0.0002f,  std_gz = 0.0236f;

  // ── Raw-unit equivalents (pre-computed in setup) ──
  // Avoids repeated multiplication in the hot loop
  float raw_mean_ax, raw_std_ax;
  float raw_mean_ay, raw_std_ay;
  float raw_mean_az, raw_std_az;
  float raw_mean_gx, raw_std_gx;
  float raw_mean_gy, raw_std_gy;
  float raw_mean_gz, raw_std_gz;

} // namespace

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Collect `num_samples` readings while the board is still,
 * then store the mean bias for each axis.
 *
 * gravity_axis: 0=X, 1=Y, 2=Z  (which axis opposes gravity)
 * gravity_sign: +1 or -1        (direction of 1g on that axis)
 *
 * At ±8g, 1g = 4096 LSB.
 */
void calibrateSensor(int gravity_axis = 1, int gravity_sign = 1,
                     int num_samples = 200) {
  Serial.println("\n── Calibration ─────────────────────────────");
  Serial.println("Keep board PERFECTLY STILL. Starting in 3 s...");
  delay(3000);

  const float G_LSB = 4096.0f; // LSB per g at ±8g range

  long sum_ax = 0, sum_ay = 0, sum_az = 0;
  long sum_gx = 0, sum_gy = 0, sum_gz = 0;

  for (int i = 0; i < num_samples; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    sum_ax += ax; sum_ay += ay; sum_az += az;
    sum_gx += gx; sum_gy += gy; sum_gz += gz;
    delay(SAMPLE_PERIOD_MS);
  }

  bias_ax = (float)sum_ax / num_samples;
  bias_ay = (float)sum_ay / num_samples;
  bias_az = (float)sum_az / num_samples;
  bias_gx = (float)sum_gx / num_samples;
  bias_gy = (float)sum_gy / num_samples;
  bias_gz = (float)sum_gz / num_samples;

  // Remove the expected 1g from whichever axis faces gravity
  // so the bias only captures sensor error, not real acceleration
  float* biases[3] = { &bias_ax, &bias_ay, &bias_az };
  *biases[gravity_axis] -= gravity_sign * G_LSB;

  Serial.printf("Biases → ax:%.1f  ay:%.1f  az:%.1f  gx:%.1f  gy:%.1f  gz:%.1f\n",
                bias_ax, bias_ay, bias_az, bias_gx, bias_gy, bias_gz);
  Serial.println("Calibration done.\n");
}

// ─── Setup ───────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  while (!Serial);

  // ── MPU6050 ──
  Serial.println("Initializing MPU6050...");
  Wire.begin(21, 22);
  mpu.initialize();

  if (!mpu.testConnection())
    Serial.println("MPU6050 connection test failed (clone detected — continuing).");
  else
    Serial.println("MPU6050 connected.");

  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_8);   // ±8g  → 4096 LSB/g
  mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_500);   // ±500°/s → 65.5 LSB/(°/s)
  mpu.setDLPFMode(MPU6050_DLPF_BW_5);              // 5 Hz LPF

  // ── One-shot calibration ──
  // Change gravity_axis/sign to match your board's mounting orientation:
  //   axis 0=X, 1=Y, 2=Z  |  sign +1 if axis points up, -1 if down
  calibrateSensor(/*gravity_axis=*/1, /*gravity_sign=*/1);

  // ── STEP 1: Gravity axis verification ──────────────────────────────────────
  // Read one raw sample immediately after calibration while the board is still.
  // Whichever axis reads ≈ ±4096 is carrying gravity — that value MUST match
  // the gravity_axis argument passed to calibrateSensor() above.
  //
  // If the wrong axis shows ±4096:
  //   • Update gravity_axis in calibrateSensor() to the correct axis (0=X, 1=Y, 2=Z)
  //   • Flip gravity_sign if the reading is negative
  //   • Re-flash and re-run before continuing
  {
    Serial.println("=== STEP 1: Gravity axis check ===");
    Serial.println("    Expect ≈ ±4096 on exactly ONE axis; others near 0.");
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    Serial.printf("    Raw (pre-bias): ax=%d  ay=%d  az=%d\n", ax, ay, az);
    if      (abs(ax) > 3000) Serial.println("    → Gravity detected on X axis (axis 0)");
    else if (abs(ay) > 3000) Serial.println("    → Gravity detected on Y axis (axis 1)");
    else if (abs(az) > 3000) Serial.println("    → Gravity detected on Z axis (axis 2)");
    else                     Serial.println("    → WARNING: No axis near ±4096. Board moving or sensor fault.");
    Serial.println("==================================\n");
  }

  // ── Pre-compute raw-unit normalization params ──
  // Accel: LSB = physical_value * (4096 LSB/g) / (9.81 m/s²/g)
  const float A = 4096.0f / 9.81f;   // LSB per (m/s²)
  // Gyro:  LSB = physical_value * 65.5 / (π/180)
  const float G = 65.5f / (PI / 180.0f);  // LSB per (rad/s)

  raw_mean_ax = mean_ax * A;  raw_std_ax = std_ax * A;
  raw_mean_ay = mean_ay * A;  raw_std_ay = std_ay * A;
  raw_mean_az = mean_az * A;  raw_std_az = std_az * A;
  raw_mean_gx = mean_gx * G;  raw_std_gx = std_gx * G;
  raw_mean_gy = mean_gy * G;  raw_std_gy = std_gy * G;
  raw_mean_gz = mean_gz * G;  raw_std_gz = std_gz * G;

  // ── TFLite model ──
  Serial.println("Loading TFLite model...");

  tensor_arena = (uint8_t*)ps_malloc(kTensorArenaSize);
  if (!tensor_arena) { Serial.println("PSRAM alloc failed!"); while (1); }

  model = tflite::GetModel(driving_cnn_model);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("Schema version mismatch!"); while (1);
  }

  static tflite::MicroMutableOpResolver<12> resolver;
  resolver.AddConv2D();
  resolver.AddMaxPool2D();
  resolver.AddAveragePool2D();
  resolver.AddReshape();
  resolver.AddFullyConnected();
  resolver.AddRelu();
  resolver.AddSoftmax();
  resolver.AddExpandDims();
  resolver.AddShape();
  resolver.AddStridedSlice();
  resolver.AddPack();
  resolver.AddSqueeze();

  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("AllocateTensors() failed!"); while (1);
  }

  input  = interpreter->input(0);
  output = interpreter->output(0);

  Serial.println("Model ready. Starting inference loop.\n");
}

// ─── Loop ────────────────────────────────────────────────────────────────────

void loop() {
  const float input_scale      = input->params.scale;
  const int   input_zero_point = input->params.zero_point;

  // ── STEP 2: Window-mean accumulators ───────────────────────────────────────
  // Replaced the previous last-sample-only snapshot with a running sum so
  // the printed normalized values match what the model actually sees
  // (effectively the window mean). A healthy idle should show all 6
  // values within ±0.5. Any channel at ±2 or beyond is the problem.
  float sum_norm_ax = 0, sum_norm_ay = 0, sum_norm_az = 0;
  float sum_norm_gx = 0, sum_norm_gy = 0, sum_norm_gz = 0;

  // ── Collect one window of samples ──────────────────────────────────────────
  for (int i = 0; i < WINDOW_SIZE; i++) {
    unsigned long t0 = millis();

    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

    // Remove hardware bias
    float fax = ax - bias_ax;
    float fay = ay - bias_ay;
    float faz = az - bias_az;
    float fgx = gx - bias_gx;
    float fgy = gy - bias_gy;
    float fgz = gz - bias_gz;

    // Z-score normalise (all in raw LSB units)
    float norm_ax = (fax - raw_mean_ax) / raw_std_ax;
    float norm_ay = (fay - raw_mean_ay) / raw_std_ay;
    float norm_az = (faz - raw_mean_az) / raw_std_az;
    float norm_gx = (fgx - raw_mean_gx) / raw_std_gx;
    float norm_gy = (fgy - raw_mean_gy) / raw_std_gy;
    float norm_gz = (fgz - raw_mean_gz) / raw_std_gz;

    // Accumulate for window-mean debug (Step 2)
    sum_norm_ax += norm_ax; sum_norm_ay += norm_ay; sum_norm_az += norm_az;
    sum_norm_gx += norm_gx; sum_norm_gy += norm_gy; sum_norm_gz += norm_gz;

    // Quantise float → int8
    auto quantise = [&](float v) -> int8_t {
      int q = (int)roundf(v / input_scale) + input_zero_point;
      return (int8_t)constrain(q, -128, 127);
    };

    int base = i * NUM_CHANNELS;
    input->data.int8[base + 0] = quantise(norm_ax);
    input->data.int8[base + 1] = quantise(norm_ay);
    input->data.int8[base + 2] = quantise(norm_az);
    input->data.int8[base + 3] = quantise(norm_gx);
    input->data.int8[base + 4] = quantise(norm_gy);
    input->data.int8[base + 5] = quantise(norm_gz);

    // Pace to target sample rate, accounting for processing time
    long elapsed = millis() - t0;
    if (elapsed < SAMPLE_PERIOD_MS)
      delay(SAMPLE_PERIOD_MS - elapsed);
  }

  // Compute window means for the debug print
  float dbg_norm_ax = sum_norm_ax / WINDOW_SIZE;
  float dbg_norm_ay = sum_norm_ay / WINDOW_SIZE;
  float dbg_norm_az = sum_norm_az / WINDOW_SIZE;
  float dbg_norm_gx = sum_norm_gx / WINDOW_SIZE;
  float dbg_norm_gy = sum_norm_gy / WINDOW_SIZE;
  float dbg_norm_gz = sum_norm_gz / WINDOW_SIZE;

  // ── Inference ──────────────────────────────────────────────────────────────
  long t_start = millis();
  if (interpreter->Invoke() != kTfLiteOk) {
    Serial.println("Invoke() failed!"); return;
  }
  long t_infer = millis() - t_start;

  // ── Parse output ───────────────────────────────────────────────────────────
  int8_t best_val = -128;
  int    best_idx = 0;

  for (int i = 0; i < NUM_CLASSES; i++) {
    if (output->data.int8[i] > best_val) {
      best_val = output->data.int8[i];
      best_idx = i;
    }
  }

  float out_scale      = output->params.scale;
  int   out_zero_point = output->params.zero_point;
  float confidence     = (best_val - out_zero_point) * out_scale * 100.0f;

  // ── STEP 2 output ──────────────────────────────────────────────────────────
  // Window-mean normalized values. At rest all six should be within ±0.5.
  // Diagnosis guide:
  //   |norm_ay| >> 0.5  → gravity axis mismatch (fix Step 1 first)
  //   |norm_gx| or |norm_gz| >> 0.5  → gyro bias not cancelled; sensor noise
  //                                     pushing model toward Brake class
  Serial.println("──────────────────────────────────────────────");
  Serial.println("STEP 2: Window-mean normalized values (target: all within ±0.5 at rest)");
  Serial.printf("  Accel ax:%6.2f  ay:%6.2f  az:%6.2f\n",
                dbg_norm_ax, dbg_norm_ay, dbg_norm_az);
  Serial.printf("  Gyro  gx:%6.2f  gy:%6.2f  gz:%6.2f\n",
                dbg_norm_gx, dbg_norm_gy, dbg_norm_gz);

  // Flag any channel well outside the expected idle range
  bool any_bad = false;
  auto flag = [&](const char* name, float v) {
    if (fabsf(v) > 1.5f) {
      Serial.printf("  ⚠ %s = %.2f — FAR outside ±0.5, likely root cause\n", name, v);
      any_bad = true;
    } else if (fabsf(v) > 0.5f) {
      Serial.printf("  ⚠ %s = %.2f — outside ±0.5, worth investigating\n", name, v);
      any_bad = true;
    }
  };
  flag("ax", dbg_norm_ax); flag("ay", dbg_norm_ay); flag("az", dbg_norm_az);
  flag("gx", dbg_norm_gx); flag("gy", dbg_norm_gy); flag("gz", dbg_norm_gz);
  if (!any_bad) Serial.println("  ✓ All channels within ±0.5 — normalization looks healthy");
  Serial.println();

  // All class scores
  Serial.println("Scores:");
  for (int i = 0; i < NUM_CLASSES; i++) {
    float score = (output->data.int8[i] - out_zero_point) * out_scale * 100.0f;
    Serial.printf("  %s%-22s  %5.1f%%\n",
                  (i == best_idx) ? "▶ " : "  ",
                  CLASS_NAMES[i],
                  score);
  }

  Serial.println();
  Serial.printf("▶ %-22s  conf: %5.1f%%  infer: %ld ms\n",
                CLASS_NAMES[best_idx], confidence, t_infer);
  Serial.println("──────────────────────────────────────────────\n");

  // ── STEP 3 & 4: Retraining notes (no code action required here) ────────────
  //
  // STEP 3 — Clean bimodal gyro distributions before retraining:
  //   The training data has a spurious GYRO_X cluster at ~3.5 rad/s and a
  //   GYRO_Z cluster at ~-1.5 rad/s (visible in the channel histograms).
  //   These inflate std_gx / std_gz, causing the normalizer to amplify even
  //   tiny MPU6050 noise by ×20–×42, which the model mistakes for Brake.
  //
  //   Fix in the Python preprocessing pipeline:
  //     • Apply the existing filter_outliers pass with max_gyro_std set low
  //       enough to drop sessions containing those clusters.
  //     • Confirm the cleaned histograms are unimodal and centred near 0
  //       before retraining.
  //
  // STEP 4 — Validate MPU6050 signal distributions before deploying:
  //   After retraining (or as a quick sanity check before):
  //     • Record ~5 min of MPU6050 data across all manoeuvre classes.
  //     • Compare per-channel mean and std against the training stats above.
  //     • If any channel mean differs by more than 0.3 × its training std,
  //       or if the std ratio is outside 0.5–2.0, add a small MPU6050
  //       fine-tuning set or recollect training data with the target hardware.
}
