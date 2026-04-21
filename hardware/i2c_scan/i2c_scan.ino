#include <Wire.h>

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin();
  Serial.println("I2C scan starting...");
}

void loop() {
  int found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("Device found at 0x%02X\n", addr);
      found++;
    }
  }
  if (found == 0) Serial.println("No I2C devices found.");

  // Read WHO_AM_I register (0x75) from 0x68 to identify the chip
  Wire.beginTransmission(0x68);
  Wire.write(0x75);
  if (Wire.endTransmission(false) == 0) {
    Wire.requestFrom((uint8_t)0x68, (uint8_t)1);
    if (Wire.available()) {
      uint8_t who = Wire.read();
      const char* chip = "UNKNOWN";
      if (who == 0x68) chip = "MPU-6050";
      else if (who == 0x70) chip = "MPU-6500";
      else if (who == 0x71) chip = "MPU-9250";
      else if (who == 0x73) chip = "MPU-9255";
      else if (who == 0x19) chip = "MPU-6886";
      Serial.printf("WHO_AM_I = 0x%02X → %s\n", who, chip);
    }
  }
  Serial.println("---");
  delay(3000);
}
