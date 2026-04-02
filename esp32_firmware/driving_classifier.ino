#include <Arduino.h>
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/system_setup.h"
#include "tensorflow/lite/schema/schema_generated.h"

// Include your auto-generated model header
#include "driving_cnn_model.h"

// Globals
namespace {
  const tflite::Model* model = nullptr;
  tflite::MicroInterpreter* interpreter = nullptr;
  TfLiteTensor* input = nullptr;
  TfLiteTensor* output = nullptr;

  constexpr int kTensorArenaSize = 64 * 1024;
  
  // Define as a pointer instead of a static array
  uint8_t* tensor_arena = nullptr; 

  const char* const CLASS_NAMES[] = {
    "Accelerate", "Aggressive Accelerate", "Aggressive Brake", 
    "Aggressive Left", "Aggressive Right", "Brake", 
    "Idling", "Left", "Right"
  };
}

void setup() {
  Serial.begin(115200);
  while(!Serial); 
  Serial.println("Initializing Driving CNN Model...");

  // Dynamically allocate the memory in the external PSRAM chip
  tensor_arena = (uint8_t*)ps_malloc(kTensorArenaSize);
  if (tensor_arena == nullptr) {
    Serial.println("PSRAM allocation failed! Did you enable PSRAM in Tools?");
    while(1); // Trap the error here so it doesn't crash the loop
  }
  Serial.println("PSRAM allocation successful.");

  // 1. Map the model
  Serial.println("PSRAM allocation successful.");
  Serial.flush(); // Force the print to finish

  Serial.println("Attempting to map model...");
  Serial.flush();
  model = tflite::GetModel(driving_cnn_model); 

  Serial.println("Mapped Model successful.");
  Serial.flush();

  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.printf("1. Model schema mismatch.\n");
    while(1);
  }

  // 2. Setup the resolver
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

  Serial.println("2. Resolver setup successful.");

  // 3. Build the interpreter
  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize);
  interpreter = &static_interpreter;
  Serial.println("3. Intepreter built successful.");

  
  // 4. Allocate memory
  TfLiteStatus allocate_status = interpreter->AllocateTensors();
  if (allocate_status != kTfLiteOk) {
    Serial.println("AllocateTensors() failed!");
    while(1); // Trap the error here so it doesn't crash the loop!
  }
  Serial.println("4. Allocated tensors to interpreter successful.");

  // 5. Obtain pointers
  input = interpreter->input(0);
  output = interpreter->output(0);
  
  Serial.println("Model loaded successfully.");
}


void loop() {
  // --- SYNTHETIC DATA GENERATION ---
  // The model expects shape (1, 112, 6) = 672 readings per window
  
  // Simulate a static IMU reading (e.g., idling with 1G on the Y-axis)
  float raw_accel_x = 0.10;
  float raw_accel_y = 9.81; 
  float raw_accel_z = 0.00;
  float raw_gyro_x  = 0.00;
  float raw_gyro_y  = 0.00;
  float raw_gyro_z  = 0.00;

  // Fill the 112 window steps
  // 1D array indexing formula: [timestep * 6 + channel]
  for (int i = 0; i < 112; i++) {
    
    // Step 1: Z-score Normalization (Metrics derived from your header)
    float norm_ax = (raw_accel_x - 0.090964) / 1.002758;
    float norm_ay = (raw_accel_y - 9.766457) / 0.338983;
    float norm_az = (raw_accel_z - 0.054432) / 1.213156;
    float norm_gx = (raw_gyro_x - -0.000755) / 0.048697;
    float norm_gy = (raw_gyro_y - -0.011453) / 0.263639;
    float norm_gz = (raw_gyro_z - 0.000220) / 0.023590;

    // Step 2: Quantize to INT8 
    // Formula: int8_val = (float_val / 0.044386) + 4
    input->data.int8[i * 6 + 0] = (int8_t)((norm_ax / 0.044386) + 4);
    input->data.int8[i * 6 + 1] = (int8_t)((norm_ay / 0.044386) + 4);
    input->data.int8[i * 6 + 2] = (int8_t)((norm_az / 0.044386) + 4);
    input->data.int8[i * 6 + 3] = (int8_t)((norm_gx / 0.044386) + 4);
    input->data.int8[i * 6 + 4] = (int8_t)((norm_gy / 0.044386) + 4);
    input->data.int8[i * 6 + 5] = (int8_t)((norm_gz / 0.044386) + 4);
  }

  // --- INFERENCE EXECUTION ---
  long start_time = millis();
  if (interpreter->Invoke() != kTfLiteOk) {
    Serial.println("Invoke failed!");
    return;
  }
  long end_time = millis();

  // The output is a 1x9 INT8 tensor. We find the index of the highest probability.
  int8_t max_val = -128;
  int max_index = 0;

  for (int i = 0; i < 9; i++) {
    int8_t current_val = output->data.int8[i];
    if (current_val > max_val) {
      max_val = current_val;
      max_index = i;
    }
  }

  // Print results
  Serial.printf("Predicted Event: %s (Class %d) | Inference Time: %ld ms\n", 
                CLASS_NAMES[max_index], max_index, (end_time - start_time));

  delay(2000); // Run an inference every 2 seconds
}