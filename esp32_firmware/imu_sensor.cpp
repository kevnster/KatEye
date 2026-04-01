#include "imu_sensor.h"
#include <Wire.h>

bool IMUSensor::begin() {
    if (!mpu.begin()) {
        Serial.println("ERROR: MPU6050 not found");
        return false;
    }

    // Ranges chosen for headroom during aggressive driving events
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);

    // 21 Hz bandwidth — anti-aliasing for 56 Hz sample rate
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

    Serial.println("MPU6050 initialized");
    Serial.println("  Accel range : +/- 8g");
    Serial.println("  Gyro range  : +/- 500 deg/s");
    Serial.println("  Filter BW   : 21 Hz");

    return true;
}

IMUReading IMUSensor::read() {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    IMUReading r;
    r.accel_x = a.acceleration.x;  // m/s^2
    r.accel_y = a.acceleration.y;   // m/s^2
    r.accel_z = a.acceleration.z;   // m/s^2
    r.gyro_x  = g.gyro.x;          // rad/s
    r.gyro_y  = g.gyro.y;           // rad/s
    r.gyro_z  = g.gyro.z;           // rad/s
    return r;
}
