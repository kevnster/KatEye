/*
  GPS Demo — HiLetgo GY-NEO6MV2 (NEO-6M) on ESP32

  Wiring:
    GPS VCC  → 3.3V
    GPS GND  → GND
    GPS TX   → ESP32 GPIO 25
    GPS RX   → ESP32 GPIO 26   (optional — only for config)
  (GPIO 16/17 are reserved for PSRAM on WROVER, so we use UART2 remapped.)

  Library:
    Install "TinyGPSPlus" by Mikal Hart via Arduino Library Manager.

  Serial Monitor: 115200 baud. Stand near a window — cold fix can take minutes.
*/

#include <TinyGPSPlus.h>

#define GPS_RX_PIN 25   // ESP32 pin that receives from GPS TX
#define GPS_TX_PIN 26   // ESP32 pin that transmits to GPS RX
#define GPS_BAUD   9600 // NEO-6M default

TinyGPSPlus gps;
HardwareSerial GPSSerial(2);

unsigned long lastPrint = 0;

void setup() {
  Serial.begin(115200);
  GPSSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("GPS demo starting. Waiting for fix...");
}

void loop() {
  while (GPSSerial.available()) {
    gps.encode(GPSSerial.read());
  }

  if (millis() - lastPrint >= 1000) {
    lastPrint = millis();

    if (gps.charsProcessed() < 10) {
      Serial.println("No GPS data. Check wiring (TX↔RX swap?) and baud.");
      return;
    }

    Serial.print("Sats: ");
    Serial.print(gps.satellites.isValid() ? gps.satellites.value() : 0);

    if (gps.location.isValid()) {
      Serial.print("  Lat: ");
      Serial.print(gps.location.lat(), 6);
      Serial.print("  Lng: ");
      Serial.print(gps.location.lng(), 6);
    } else {
      Serial.print("  (no fix yet)");
    }

    if (gps.altitude.isValid()) {
      Serial.print("  Alt: ");
      Serial.print(gps.altitude.meters(), 1);
      Serial.print("m");
    }

    if (gps.time.isValid()) {
      Serial.printf("  UTC: %02d:%02d:%02d",
        gps.time.hour(), gps.time.minute(), gps.time.second());
    }

    Serial.println();
  }
}
