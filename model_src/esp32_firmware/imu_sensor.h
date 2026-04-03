#ifndef IMU_SENSOR_H
#define IMU_SENSOR_H

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

struct IMUReading {
    float accel_x;  // m/s^2
    float accel_y;  // m/s^2
    float accel_z;  // m/s^2
    float gyro_x;   // rad/s
    float gyro_y;   // rad/s
    float gyro_z;   // rad/s
};

class IMUSensor {
public:
    bool begin();
    IMUReading read();

private:
    Adafruit_MPU6050 mpu;
};

#endif // IMU_SENSOR_H
