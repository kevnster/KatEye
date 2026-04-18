#ifndef PREPROCESSING_H
#define PREPROCESSING_H

#include <stdint.h>
#include <math.h>

// Per-channel z-score normalization constants (from training set)
// Channel order: ACCEL_X, ACCEL_Y, ACCEL_Z, GYRO_X, GYRO_Y, GYRO_Z
static const float CHANNEL_MEAN[6] = {
    0.090964f,   // ACCEL_X
    9.766457f,   // ACCEL_Y
    0.054432f,   // ACCEL_Z
   -0.000755f,   // GYRO_X
   -0.011453f,   // GYRO_Y
    0.000220f    // GYRO_Z
};

static const float CHANNEL_STD[6] = {
    1.002758f,   // ACCEL_X
    0.338983f,   // ACCEL_Y
    1.213156f,   // ACCEL_Z
    0.048697f,   // GYRO_X
    0.263639f,   // GYRO_Y
    0.023590f    // GYRO_Z
};

// INT8 quantization parameters (from TFLite model)
static const float INPUT_SCALE    = 0.044386f;
static const int   INPUT_ZP       = 4;

// Normalize a raw sensor value and quantize to INT8
// raw: sensor reading in SI units (m/s^2 or rad/s)
// ch:  channel index (0-5)
static inline int8_t preprocess(float raw, int ch) {
    float normalized = (raw - CHANNEL_MEAN[ch]) / CHANNEL_STD[ch];
    int32_t quantized = (int32_t)roundf(normalized / INPUT_SCALE) + INPUT_ZP;
    if (quantized < -128) quantized = -128;
    if (quantized >  127) quantized =  127;
    return (int8_t)quantized;
}

#endif // PREPROCESSING_H
