/*
  Module A — Sensor Node
  Hardware: ESP32 Wrover + MPU-6050 (Adafruit breakout)

  Reads accelerometer + gyroscope at 56 Hz using a hardware timer.
  Preprocesses to INT8 (z-score normalize → quantize).
  Batches samples and streams to Module B via ESP-NOW.
*/

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#include "imu_sensor.h"
#include "preprocessing.h"

// ── Configuration ───────────────────────────────────────────────
#define SAMPLE_RATE_HZ    56
#define SAMPLE_PERIOD_US  (1000000 / SAMPLE_RATE_HZ)   // ~17857 µs
#define BATCH_SIZE        14          // samples per ESP-NOW packet

// WiFi SSID — used ONLY to discover the AP channel so ESP-NOW matches Module B
#define WIFI_SSID         "Andy"

// ── ESP-NOW packet ──────────────────────────────────────────────
// Header (4 bytes) + payload (14 × 6 = 84 bytes) = 88 bytes  (max 250)
typedef struct __attribute__((packed)) {
    uint16_t seq;                               // rolling sequence number
    uint8_t  count;                             // samples in this packet (≤ BATCH_SIZE)
    uint8_t  _pad;                              // alignment padding
    int8_t   samples[BATCH_SIZE * NUM_CHANNELS]; // INT8 preprocessed data
} SensorPacket;

// ── Globals ─────────────────────────────────────────────────────
IMUSensor imu;

// Replace broadcast with Module B's actual MAC if you want unicast.
// Broadcast works fine for a two-device demo.
uint8_t peerAddr[] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

volatile bool sampleReady = false;
hw_timer_t *sampleTimer   = NULL;

SensorPacket txPacket;
uint16_t     seqCounter   = 0;
uint8_t      batchIndex   = 0;

// ── Timer ISR — fires at 56 Hz ─────────────────────────────────
void IRAM_ATTR onSampleTimer() {
    sampleReady = true;
}

// ── ESP-NOW send callback (optional debug) ──────────────────────
void onDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
    // Could toggle an LED here for visual feedback
}

// ── Setup ───────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("Module A — Sensor Node (56 Hz → ESP-NOW)");

    // --- IMU ---
    Wire.begin();
    if (!imu.begin()) {
        Serial.println("IMU init failed — halting.");
        while (1) delay(1000);
    }

    // --- Discover AP channel so ESP-NOW matches Module B ---
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    uint8_t apChannel = 1;  // fallback
    Serial.print("Scanning for AP...");
    int n = WiFi.scanNetworks();
    for (int i = 0; i < n; i++) {
        if (strcmp(WiFi.SSID(i).c_str(), WIFI_SSID) == 0) {
            apChannel = WiFi.channel(i);
            Serial.printf(" found \"%s\" on channel %d\n", WIFI_SSID, apChannel);
            break;
        }
    }
    WiFi.scanDelete();
    if (apChannel == 1 && n > 0) {
        Serial.println(" AP not found, defaulting to channel 1");
    }

    esp_wifi_set_channel(apChannel, WIFI_SECOND_CHAN_NONE);

    // --- ESP-NOW ---
    if (esp_now_init() != ESP_OK) {
        Serial.println("ESP-NOW init failed — halting.");
        while (1) delay(1000);
    }
    esp_now_register_send_cb(onDataSent);

    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, peerAddr, 6);
    peer.channel = 0;  // 0 = use current channel
    peer.encrypt = false;
    if (esp_now_add_peer(&peer) != ESP_OK) {
        Serial.println("Failed to add ESP-NOW peer — halting.");
        while (1) delay(1000);
    }

    // --- Hardware timer at 56 Hz ---
    sampleTimer = timerBegin(1000000);                    // 1 MHz tick
    timerAttachInterrupt(sampleTimer, &onSampleTimer);
    timerAlarm(sampleTimer, SAMPLE_PERIOD_US, true, 0);   // auto-reload

    memset(&txPacket, 0, sizeof(txPacket));
    Serial.println("Sampling at 56 Hz. Streaming...");
}

// ── Loop ────────────────────────────────────────────────────────
void loop() {
    if (!sampleReady) return;
    sampleReady = false;

    // 1. Read raw sensor data (m/s², rad/s)
    IMUReading r = imu.read();
    float raw[NUM_CHANNELS] = { r.accel_x, r.accel_y, r.accel_z,
                                 r.gyro_x,  r.gyro_y,  r.gyro_z };

    // 2. Preprocess → INT8 and store in batch buffer
    int offset = batchIndex * NUM_CHANNELS;
    for (int ch = 0; ch < NUM_CHANNELS; ch++) {
        txPacket.samples[offset + ch] = preprocess(raw[ch], ch);
    }
    batchIndex++;

    // 3. When batch is full, transmit
    if (batchIndex >= BATCH_SIZE) {
        txPacket.seq   = seqCounter++;
        txPacket.count = batchIndex;

        esp_now_send(peerAddr, (uint8_t *)&txPacket, sizeof(txPacket));

        batchIndex = 0;

        // Debug print once per second (~4 packets/sec)
        static uint16_t printDiv = 0;
        if (++printDiv >= 4) {
            Serial.printf("[A] seq=%u  last sample: ax=%+.2f ay=%+.2f az=%+.2f  gx=%+.3f gy=%+.3f gz=%+.3f\n",
                          txPacket.seq, r.accel_x, r.accel_y, r.accel_z,
                          r.gyro_x, r.gyro_y, r.gyro_z);
            printDiv = 0;
        }
    }
}
