/**
 * KatEye Data Collector Firmware
 *
 * Records labeled 10-second IMU sessions triggered from a web dashboard,
 * then uploads to Firebase for fine-tuning the driving events CNN model.
 *
 * State machine: IDLE → COUNTDOWN (3s) → RECORDING (10s, 560 samples) → UPLOADING → IDLE
 *
 * Hardware: ESP32 WROOM/Wrover + MPU6050 breakout
 *   - I2C: GPIO 21 (SDA), GPIO 22 (SCL)
 *   - LED: GPIO 2 (onboard)
 *   - Buzzer: GPIO 15 (via NPN transistor)
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "I2Cdev.h"
#include "MPU6050.h"
#include "data_collector_config.h"

// ── Class names (must match cnn_pipeline.py) ─────────────────────────────────
static const char* CLASS_NAMES[] = {
    "Accelerate",
    "Aggressive Accelerate",
    "Aggressive Brake",
    "Aggressive Left",
    "Aggressive Right",
    "Brake",
    "Idling",
    "Left",
    "Right",
};
static const int NUM_CLASSES = 9;

// ── State machine ────────────────────────────────────────────────────────────
enum State { STATE_IDLE, STATE_COUNTDOWN, STATE_RECORDING, STATE_UPLOADING };
State currentState = STATE_IDLE;

// ── Sensor ───────────────────────────────────────────────────────────────────
MPU6050 mpu;
float bias_ax, bias_ay, bias_az;
float bias_gx, bias_gy, bias_gz;

// ── Conversion factors ───────────────────────────────────────────────────────
// ±8g  → 4096 LSB/g  → m/s^2: raw / 4096.0 * 9.81
// ±500°/s → 65.5 LSB/(°/s) → rad/s: raw / 65.5 * (PI / 180.0)
static const float ACCEL_SCALE = 9.81f / 4096.0f;
static const float GYRO_SCALE  = (PI / 180.0f) / 65.5f;

// ── Sample buffer (PSRAM) ────────────────────────────────────────────────────
float (*samples)[NUM_CHANNELS] = nullptr;  // [NUM_SAMPLES][6]
volatile int sampleIndex = 0;

// ── Hardware timer ───────────────────────────────────────────────────────────
hw_timer_t *sampleTimer = nullptr;
volatile bool sampleReady = false;

// ── Recording state ──────────────────────────────────────────────────────────
int currentLabel = -1;
String currentLabelName = "";

// ── Timing ───────────────────────────────────────────────────────────────────
unsigned long lastPollMs = 0;
static const unsigned long POLL_INTERVAL_MS = 1000;

// ── Timer ISR — fires at 56 Hz ──────────────────────────────────────────────
void IRAM_ATTR onSampleTimer() {
    sampleReady = true;
}

// ── Calibration (from driving_classifier.ino:75-109) ─────────────────────────
void calibrateSensor(int gravity_axis = GRAVITY_AXIS,
                     int gravity_sign = GRAVITY_SIGN,
                     int num_samples  = 200) {
    Serial.println("\n-- Calibration --");
    Serial.println("Keep board PERFECTLY STILL. Starting in 3 s...");
    delay(3000);

    const float G_LSB = 4096.0f;  // LSB per g at ±8g range

    long sum_ax = 0, sum_ay = 0, sum_az = 0;
    long sum_gx = 0, sum_gy = 0, sum_gz = 0;

    for (int i = 0; i < num_samples; i++) {
        int16_t ax, ay, az, gx, gy, gz;
        mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
        sum_ax += ax; sum_ay += ay; sum_az += az;
        sum_gx += gx; sum_gy += gy; sum_gz += gz;
        delay(1000 / SAMPLE_RATE_HZ);
    }

    bias_ax = (float)sum_ax / num_samples;
    bias_ay = (float)sum_ay / num_samples;
    bias_az = (float)sum_az / num_samples;
    bias_gx = (float)sum_gx / num_samples;
    bias_gy = (float)sum_gy / num_samples;
    bias_gz = (float)sum_gz / num_samples;

    // Remove expected 1g from the gravity axis
    float* biases[3] = { &bias_ax, &bias_ay, &bias_az };
    *biases[gravity_axis] -= gravity_sign * G_LSB;

    Serial.printf("Biases -> ax:%.1f  ay:%.1f  az:%.1f  gx:%.1f  gy:%.1f  gz:%.1f\n",
                  bias_ax, bias_ay, bias_az, bias_gx, bias_gy, bias_gz);
    Serial.println("Calibration done.\n");
}

// ── WiFi helpers ─────────────────────────────────────────────────────────────
void connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.printf("Connecting to WiFi '%s'...\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
        delay(250);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nWiFi connected. IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\nWiFi connection failed!");
    }
}

void disconnectWiFi() {
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    Serial.println("WiFi disconnected.");
}

// ── RTDB helpers (HTTP REST API) ─────────────────────────────────────────────
bool rtdbSet(const String& path, const String& json) {
    if (WiFi.status() != WL_CONNECTED) return false;

    HTTPClient http;
    String url = String(RTDB_URL) + path + ".json";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    int code = http.PUT(json);
    http.end();

    if (code != 200) {
        Serial.printf("RTDB PUT %s failed: %d\n", path.c_str(), code);
        return false;
    }
    return true;
}

String rtdbGet(const String& path) {
    if (WiFi.status() != WL_CONNECTED) return "";

    HTTPClient http;
    String url = String(RTDB_URL) + path + ".json";
    http.begin(url);
    int code = http.GET();
    String payload = "";
    if (code == 200) {
        payload = http.getString();
    }
    http.end();
    return payload;
}

void setStatus(const char* status) {
    String path = String("/datacollect/devices/") + DEVICE_ID + "/status";
    rtdbSet(path, String("\"") + status + "\"");
}

void setProgress(int value) {
    String path = String("/datacollect/devices/") + DEVICE_ID + "/progress";
    rtdbSet(path, String(value));
}

void setCountdown(int value) {
    String path = String("/datacollect/devices/") + DEVICE_ID + "/countdown_remaining";
    rtdbSet(path, String(value));
}

void setError(const char* msg) {
    String path = String("/datacollect/devices/") + DEVICE_ID + "/last_error";
    rtdbSet(path, String("\"") + msg + "\"");
}

void clearCommand() {
    String path = String("/datacollect/devices/") + DEVICE_ID + "/command";
    rtdbSet(path, "{\"trigger\":false,\"label\":-1,\"label_name\":\"\"}");
}

// ── Firestore upload ─────────────────────────────────────────────────────────
bool uploadToFirestore() {
    // Build Firestore REST API URL
    String url = "https://firestore.googleapis.com/v1/projects/"
                 + String(FIREBASE_PROJECT_ID)
                 + "/databases/(default)/documents/recordings";

    // Build the document JSON in Firestore REST format
    JsonDocument doc;
    JsonObject fields = doc["fields"].to<JsonObject>();

    // Scalar fields
    fields["label"]["integerValue"]       = String(currentLabel);
    fields["label_name"]["stringValue"]   = currentLabelName;
    fields["device_id"]["stringValue"]    = DEVICE_ID;
    fields["sample_rate_hz"]["integerValue"] = String(SAMPLE_RATE_HZ);
    fields["num_samples"]["integerValue"] = String(NUM_SAMPLES);
    fields["duration_sec"]["integerValue"]= String(RECORDING_SECONDS);
    fields["accel_range_g"]["integerValue"]  = "8";
    fields["gyro_range_dps"]["integerValue"] = "500";
    fields["dlpf_hz"]["integerValue"]     = "21";
    fields["gravity_axis"]["integerValue"]= String(GRAVITY_AXIS);
    fields["gravity_sign"]["integerValue"]= String(GRAVITY_SIGN);
    fields["flagged"]["booleanValue"]     = false;
    fields["notes"]["stringValue"]        = "";

    // Timestamp (ISO 8601 — use a placeholder, Firestore will record createTime)
    fields["timestamp"]["stringValue"]    = "auto";

    // Calibration biases
    JsonObject cal = fields["calibration"]["mapValue"]["fields"].to<JsonObject>();
    cal["bias_ax"]["doubleValue"] = bias_ax;
    cal["bias_ay"]["doubleValue"] = bias_ay;
    cal["bias_az"]["doubleValue"] = bias_az;
    cal["bias_gx"]["doubleValue"] = bias_gx;
    cal["bias_gy"]["doubleValue"] = bias_gy;
    cal["bias_gz"]["doubleValue"] = bias_gz;

    // Sensor data arrays
    const char* chanNames[] = {"accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"};
    JsonObject data = fields["data"]["mapValue"]["fields"].to<JsonObject>();

    for (int ch = 0; ch < NUM_CHANNELS; ch++) {
        JsonArray values = data[chanNames[ch]]["arrayValue"]["values"].to<JsonArray>();
        for (int s = 0; s < NUM_SAMPLES; s++) {
            values.add<JsonObject>()["doubleValue"] = samples[s][ch];
        }
    }

    String jsonStr;
    serializeJson(doc, jsonStr);

    Serial.printf("Uploading to Firestore (%d bytes)...\n", jsonStr.length());

    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(30000);  // 30s timeout for large payload
    int code = http.POST(jsonStr);

    if (code == 200 || code == 201) {
        Serial.printf("Firestore upload OK: %d\n", code);
        http.end();
        return true;
    } else {
        Serial.printf("Firestore upload failed: %d\n", code);
        Serial.println(http.getString());
        http.end();
        return false;
    }
}

// ── Setup ────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    while (!Serial) delay(10);

    Serial.println("\n========================================");
    Serial.println("  KatEye Data Collector");
    Serial.println("========================================\n");

    // Pins
    pinMode(LED_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);

    // MPU6050 init (from driving_classifier.ino:117-140)
    Serial.println("Initializing MPU6050...");
    Wire.begin(21, 22);
    mpu.initialize();

    if (!mpu.testConnection())
        Serial.println("MPU6050 connection test failed (clone detected -- continuing).");
    else
        Serial.println("MPU6050 connected.");

    mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_8);   // ±8g  → 4096 LSB/g
    mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_500);   // ±500°/s → 65.5 LSB/(°/s)
    mpu.setDLPFMode(4);                                // 21 Hz DLPF (mode 4)

    // Calibrate
    calibrateSensor();

    // Allocate sample buffer in PSRAM (~13 KB)
    samples = (float(*)[NUM_CHANNELS])ps_malloc(NUM_SAMPLES * NUM_CHANNELS * sizeof(float));
    if (!samples) {
        Serial.println("PSRAM alloc failed! Falling back to heap.");
        samples = (float(*)[NUM_CHANNELS])malloc(NUM_SAMPLES * NUM_CHANNELS * sizeof(float));
        if (!samples) {
            Serial.println("Heap alloc also failed! Halting.");
            while (1) delay(1000);
        }
    }
    Serial.printf("Sample buffer allocated: %d bytes\n", NUM_SAMPLES * NUM_CHANNELS * (int)sizeof(float));

    // WiFi + RTDB initial state
    connectWiFi();
    setStatus("idle");
    setProgress(0);
    setCountdown(0);
    setError("");
    clearCommand();

    // Set connected flag
    String connPath = String("/datacollect/devices/") + DEVICE_ID + "/connected";
    rtdbSet(connPath, "true");

    Serial.println("\nReady. Waiting for commands...\n");
}

// ── Main loop ────────────────────────────────────────────────────────────────
void loop() {
    switch (currentState) {

    // ── IDLE: Poll RTDB for trigger command ──────────────────────────────
    case STATE_IDLE: {
        if (millis() - lastPollMs < POLL_INTERVAL_MS) break;
        lastPollMs = millis();

        String cmdPath = String("/datacollect/devices/") + DEVICE_ID + "/command";
        String cmdJson = rtdbGet(cmdPath);

        if (cmdJson.length() == 0 || cmdJson == "null") break;

        JsonDocument cmdDoc;
        DeserializationError err = deserializeJson(cmdDoc, cmdJson);
        if (err) break;

        bool trigger = cmdDoc["trigger"] | false;
        if (!trigger) break;

        currentLabel = cmdDoc["label"] | -1;
        currentLabelName = cmdDoc["label_name"] | "";

        if (currentLabel < 0 || currentLabel >= NUM_CLASSES) {
            Serial.printf("Invalid label: %d\n", currentLabel);
            setError("Invalid label");
            clearCommand();
            break;
        }

        Serial.printf("\n>> Trigger received: label=%d (%s)\n", currentLabel, currentLabelName.c_str());
        currentState = STATE_COUNTDOWN;
        break;
    }

    // ── COUNTDOWN: 3-2-1 with buzzer beeps ──────────────────────────────
    case STATE_COUNTDOWN: {
        setStatus("countdown");

        for (int i = COUNTDOWN_SECONDS; i >= 1; i--) {
            setCountdown(i);
            Serial.printf("  %d...\n", i);

            // LED flash + buzzer beep
            digitalWrite(LED_PIN, HIGH);
            digitalWrite(BUZZER_PIN, HIGH);
            delay(150);
            digitalWrite(BUZZER_PIN, LOW);
            digitalWrite(LED_PIN, LOW);
            delay(850);
        }
        setCountdown(0);

        currentState = STATE_RECORDING;
        break;
    }

    // ── RECORDING: Collect 560 samples at 56 Hz ─────────────────────────
    case STATE_RECORDING: {
        setStatus("recording");
        Serial.printf("Recording %d samples at %d Hz...\n", NUM_SAMPLES, SAMPLE_RATE_HZ);

        // Disconnect WiFi to prevent timer jitter
        disconnectWiFi();

        // Reset sample counter
        sampleIndex = 0;
        sampleReady = false;

        // Start hardware timer at 56 Hz (from ModuleA_Sensor.ino:111-113)
        sampleTimer = timerBegin(1000000);                    // 1 MHz tick
        timerAttachInterrupt(sampleTimer, &onSampleTimer);
        timerAlarm(sampleTimer, SAMPLE_PERIOD_US, true, 0);   // auto-reload

        // LED solid ON during recording
        digitalWrite(LED_PIN, HIGH);

        // Collect samples
        while (sampleIndex < NUM_SAMPLES) {
            if (sampleReady) {
                sampleReady = false;

                int16_t ax, ay, az, gx, gy, gz;
                mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

                // Convert to physical units (m/s^2, rad/s)
                samples[sampleIndex][0] = (ax - bias_ax) * ACCEL_SCALE;  // accel_x
                samples[sampleIndex][1] = (ay - bias_ay) * ACCEL_SCALE;  // accel_y
                samples[sampleIndex][2] = (az - bias_az) * ACCEL_SCALE;  // accel_z
                samples[sampleIndex][3] = (gx - bias_gx) * GYRO_SCALE;  // gyro_x
                samples[sampleIndex][4] = (gy - bias_gy) * GYRO_SCALE;  // gyro_y
                samples[sampleIndex][5] = (gz - bias_gz) * GYRO_SCALE;  // gyro_z

                sampleIndex++;

                // Print progress every 56 samples (1 second)
                if (sampleIndex % SAMPLE_RATE_HZ == 0) {
                    Serial.printf("  %d / %d samples\n", sampleIndex, NUM_SAMPLES);
                }
            }
        }

        // Stop timer
        timerDetachInterrupt(sampleTimer);
        timerEnd(sampleTimer);
        sampleTimer = nullptr;

        digitalWrite(LED_PIN, LOW);
        Serial.println("Recording complete.");

        currentState = STATE_UPLOADING;
        break;
    }

    // ── UPLOADING: Reconnect WiFi and POST to Firestore ─────────────────
    case STATE_UPLOADING: {
        connectWiFi();

        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("No WiFi for upload -- retrying...");
            delay(2000);
            break;
        }

        setStatus("uploading");
        setProgress(NUM_SAMPLES);

        bool ok = uploadToFirestore();

        if (ok) {
            setStatus("done");
            Serial.println("Upload complete!");

            // Success feedback: 2 short beeps
            for (int i = 0; i < 2; i++) {
                digitalWrite(BUZZER_PIN, HIGH);
                delay(100);
                digitalWrite(BUZZER_PIN, LOW);
                delay(100);
            }
        } else {
            setStatus("error");
            setError("Firestore upload failed");
            Serial.println("Upload failed!");

            // Error feedback: 1 long beep
            digitalWrite(BUZZER_PIN, HIGH);
            delay(500);
            digitalWrite(BUZZER_PIN, LOW);
        }

        // Reset for next recording
        clearCommand();
        delay(2000);
        setStatus("idle");
        setProgress(0);

        currentState = STATE_IDLE;
        Serial.println("\nReady. Waiting for commands...\n");
        break;
    }
    }
}
