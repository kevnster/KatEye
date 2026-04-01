// ESP32 + MPU6050
// Runs INT8-quantized 1D CNN via TensorFlow Lite for Microcontrollers
// Data:  
//     - 112 timesteps x 6 channels @ 56 Hz (2-second window)
//     - {accx, accy, accz, gyrox, gyroy, gyroz}
// Output: 9 driving event classes

// https://github.com/tanakamasayuki/Arduino_TensorFlowLite_ESP32
#include <TensorFlowLite_ESP32.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"

#include "driving_cnn_model.h"
#include "preprocessing.h"
#include "imu_sensor.h"

static const int WINDOW_SIZE    = 112;
static const int HOP_SIZE       = 56;
static const int N_CHANNELS     = 6;
static const int N_CLASSES      = 9;
static const int SAMPLE_INTERVAL_US = 17857;  // 1/56 Hz in microseconds

static const char* CLASS_NAMES[N_CLASSES] = {
    "Accelerate",
    "Aggressive Accelerate",
    "Aggressive Brake",
    "Aggressive Left",
    "Aggressive Right",
    "Brake",
    "Idling",
    "Left",
    "Right"
};

// Tensor arena — start at 64 KB, tune with arena_used_bytes()        
static const int ARENA_SIZE = 64 * 1024;
static uint8_t tensor_arena[ARENA_SIZE] __attribute__((aligned(16)));

// Globals                                                             
static const tflite::Model*       model       = nullptr;
static tflite::MicroInterpreter*  interpreter = nullptr;
static TfLiteTensor*              input_tensor  = nullptr;
static TfLiteTensor*              output_tensor = nullptr;

static IMUSensor imu;

// Circular buffer for raw sensor readings
static float sensor_buf[WINDOW_SIZE][N_CHANNELS];
static int   write_idx     = 0;
static int   sample_count  = 0;

static unsigned long last_sample_us = 0;

// setup()                                                             //
void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }
    Serial.println("\n=== Driving Behavior Classifier ===");

    // --- IMU ---
    Wire.begin();
    if (!imu.begin()) {
        Serial.println("FATAL: IMU init failed — halting");
        while (true) { delay(1000); }
    }

    // --- Load TFLite model ---
    model = tflite::GetModel(driving_cnn_model);
    if (model->version() != TFLITE_SCHEMA_VERSION) {
        Serial.printf("ERROR: Model schema v%d != expected v%d\n",
                       model->version(), TFLITE_SCHEMA_VERSION);
        while (true) { delay(1000); }
    }
    Serial.println("Model loaded OK");

    static tflite::MicroMutableOpResolver<7> resolver;
    resolver.AddConv2D();           // Conv1D is lowered to Conv2D internally
    resolver.AddMaxPool2D();
    resolver.AddFullyConnected();
    resolver.AddSoftmax();
    resolver.AddReshape();
    resolver.AddQuantize();
    resolver.AddDequantize();

    // --- Interpreter ---

    tflite::MicroInterpreter static_interpreter(
        model, resolver, tensor_arena, ARENA_SIZE, nullptr, nullptr);
    interpreter = &static_interpreter;

    if (interpreter->AllocateTensors() != kTfLiteOk) {
        Serial.println("FATAL: AllocateTensors() failed — arena too small?");
        while (true) { delay(1000); }
    }

    input_tensor  = interpreter->input(0);
    output_tensor = interpreter->output(0);

    // --- Verify tensor shapes ---
    Serial.printf("Input  : shape [%d, %d, %d], type %s\n",
        input_tensor->dims->data[0],
        input_tensor->dims->data[1],
        input_tensor->dims->data[2],
        TfLiteTypeGetName(input_tensor->type));
    Serial.printf("Output : shape [%d, %d], type %s\n",
        output_tensor->dims->data[0],
        output_tensor->dims->data[1],
        TfLiteTypeGetName(output_tensor->type));

    if (input_tensor->type != kTfLiteInt8) {
        Serial.println("ERROR: Expected INT8 input tensor");
        while (true) { delay(1000); }
    }

    Serial.printf("Arena used: %zu / %d bytes\n",
        interpreter->arena_used_bytes(), ARENA_SIZE);
    Serial.println("Ready — collecting samples...\n");

    last_sample_us = micros();
}

// loop() — 56 Hz sampling + sliding-window inference                
void loop() {
    unsigned long now_us = micros();

    if (now_us - last_sample_us < (unsigned long)SAMPLE_INTERVAL_US) return;
    last_sample_us = now_us;   // Issue 3 fix: re-anchor each sample

    // --- Read and buffer IMU ---
    IMUReading r = imu.read();
    sensor_buf[write_idx][0] = r.accel_x;
    sensor_buf[write_idx][1] = r.accel_y;
    sensor_buf[write_idx][2] = r.accel_z;
    sensor_buf[write_idx][3] = r.gyro_x;
    sensor_buf[write_idx][4] = r.gyro_y;
    sensor_buf[write_idx][5] = r.gyro_z;
    write_idx = (write_idx + 1) % WINDOW_SIZE;
    sample_count++;

    if (sample_count < WINDOW_SIZE) return;

    // --- Linearize circular buffer into input tensor ---
    int8_t* input_data = input_tensor->data.int8;
    for (int t = 0; t < WINDOW_SIZE; t++) {
        int buf_idx = (write_idx + t) % WINDOW_SIZE;
        for (int ch = 0; ch < N_CHANNELS; ch++) {
            input_data[t * N_CHANNELS + ch] = preprocess(sensor_buf[buf_idx][ch], ch);
        }
    }

    // --- Inference ---
    unsigned long t0 = micros();
    if (interpreter->Invoke() != kTfLiteOk) {
        Serial.println("ERROR: Invoke() failed");
        sample_count = WINDOW_SIZE - HOP_SIZE;
        return;
    }
    unsigned long dt = micros() - t0;

    // --- Argmax ---
    int8_t* output_data = output_tensor->data.int8;
    int    best_idx = 0;
    int8_t best_val = output_data[0];
    for (int i = 1; i < N_CLASSES; i++) {
        if (output_data[i] > best_val) {
            best_val = output_data[i];
            best_idx = i;
        }
    }

    // Confidence Level
    static const int8_t CONFIDENCE_THRESHOLD = -50;
    if (best_val < CONFIDENCE_THRESHOLD) {
        Serial.printf("[%6lu ms] LOW CONFIDENCE (best=%d) — skipping\n",
            millis(), best_val);
    } else {
        Serial.printf("[%6lu ms] %-25s  score=%d  inference=%lu us\n",
            millis(), CLASS_NAMES[best_idx], best_val, dt);
    }

    // --- Slide window ---
    sample_count = WINDOW_SIZE - HOP_SIZE;
}
