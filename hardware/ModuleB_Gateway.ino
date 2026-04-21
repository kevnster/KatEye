/*
  Module B — Gateway + ML Inference
  Hardware: ESP32 Wrover (PSRAM enabled)

  Receives INT8 sensor data from Module A via ESP-NOW.
  Fills a sliding-window ring buffer (112 samples).
  Runs TFLite Micro inference to classify driving behavior.
  Debounces aggressive events, constructs JSON, posts to Firebase.
*/

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/system_setup.h"
#include "tensorflow/lite/schema/schema_generated.h"

// *** Copy driving_cnn_model.h from the model repo into this folder ***
#include "driving_cnn_model_v3.h"

// ── Configuration ───────────────────────────────────────────────
#define NUM_CHANNELS      6
#define WINDOW_SIZE       112       // model input timesteps
#define NUM_CLASSES       9
#define INFERENCE_STRIDE  56        // run inference every 56 new samples (50% overlap → ~1 s)

#define DEBOUNCE_MS       2000      // ignore duplicate events within this window
#define BATCH_FLUSH_MS    15000     // flush buffered events to Firebase every 15 sec
#define MAX_BUFFERED_EVENTS 20      // max events to buffer before forced flush

// WiFi / Firebase — fill in for live demo, or leave blank for serial-only mode
#define WIFI_SSID         "Andy"
#define WIFI_PASSWORD     "12345678"
#define FIREBASE_URL      "https://kateye-default-rtdb.firebaseio.com/alerts.json"

// ── ESP-NOW packet (must match Module A) ────────────────────────
#define BATCH_SIZE        14
typedef struct __attribute__((packed)) {
    uint16_t seq;
    uint8_t  count;
    uint8_t  gps_fix;                    // 0 = no fix, 1 = valid lat/lng
    int32_t  lat_e7;                     // latitude  * 1e7
    int32_t  lng_e7;                     // longitude * 1e7
    int8_t   samples[BATCH_SIZE * NUM_CHANNELS];
} SensorPacket;

// ── Class labels ────────────────────────────────────────────────
static const char* const CLASS_NAMES[NUM_CLASSES] = {
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

// Which class indices are "aggressive" and warrant an alert
static const int AGGRESSIVE_CLASSES[] = { 1, 2, 3, 4 };
static const int NUM_AGGRESSIVE = 4;

// ── Ring buffer ─────────────────────────────────────────────────
static int8_t ringBuffer[WINDOW_SIZE * NUM_CHANNELS];
static int    ringHead         = 0;   // next write position (sample index 0..WINDOW_SIZE-1)
static int    totalSamplesRecv = 0;   // total samples received since boot
static int    samplesSinceInference = 0;

// Raw float buffer for JSON snapshot (stores last WINDOW_SIZE readings before preprocessing)
// We don't have raw floats on Module B (Module A sends INT8), so snapshot will use INT8 values.

// ── TFLite Micro globals ────────────────────────────────────────
namespace {
    const tflite::Model* tflModel         = nullptr;
    tflite::MicroInterpreter* interpreter = nullptr;
    TfLiteTensor* modelInput              = nullptr;
    TfLiteTensor* modelOutput             = nullptr;

    constexpr int kTensorArenaSize = 128 * 1024;
    uint8_t* tensorArena = nullptr;
}

// ── Debounce state ──────────────────────────────────────────────
unsigned long lastEventTime = 0;

// ── Latest location cached from Module A's packets ──────────────
static bool    haveGpsFix = false;
static int32_t lastLatE7  = 0;
static int32_t lastLngE7  = 0;

// ── Event batch buffer ─────────────────────────────────────────
struct BufferedEvent {
    const char* eventType;
    unsigned long localTime;   // millis() when detected
};
static BufferedEvent eventBuffer[MAX_BUFFERED_EVENTS];
static int eventCount = 0;
static unsigned long lastFlushTime = 0;

// ── Forward declarations ────────────────────────────────────────
void runInference();
void handleEvent(int classIdx, int8_t confidence);
void flushToFirebase();
void connectWiFi();

// ── ESP-NOW receive callback ────────────────────────────────────
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
    if (len != sizeof(SensorPacket)) {
        Serial.printf("[B] Unexpected packet size %d (expected %u) — dropping\n",
                      len, (unsigned)sizeof(SensorPacket));
        return;
    }

    const SensorPacket* pkt = (const SensorPacket*)data;

    // Cache latest location from Module A
    if (pkt->gps_fix) {
        haveGpsFix = true;
        lastLatE7  = pkt->lat_e7;
        lastLngE7  = pkt->lng_e7;
    }

    int count = pkt->count;
    if (count > BATCH_SIZE) count = BATCH_SIZE;

    // Push each sample into ring buffer
    for (int s = 0; s < count; s++) {
        int srcOffset = s * NUM_CHANNELS;
        int dstOffset = ringHead * NUM_CHANNELS;

        for (int ch = 0; ch < NUM_CHANNELS; ch++) {
            ringBuffer[dstOffset + ch] = pkt->samples[srcOffset + ch];
        }

        ringHead = (ringHead + 1) % WINDOW_SIZE;
        totalSamplesRecv++;
        samplesSinceInference++;
    }
}

// ── Setup ───────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("Module B — Gateway + ML Inference");

    // --- Allocate tensor arena in PSRAM ---
    tensorArena = (uint8_t*)ps_malloc(kTensorArenaSize);
    if (!tensorArena) {
        Serial.println("PSRAM allocation failed! Enable PSRAM in Tools menu.");
        while (1) delay(1000);
    }
    Serial.println("PSRAM: 64 KB tensor arena allocated.");

    // --- Load TFLite model ---
    tflModel = tflite::GetModel(driving_cnn_model);
    if (tflModel->version() != TFLITE_SCHEMA_VERSION) {
        Serial.println("Model schema version mismatch!");
        while (1) delay(1000);
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

    static tflite::MicroInterpreter staticInterpreter(
        tflModel, resolver, tensorArena, kTensorArenaSize);
    interpreter = &staticInterpreter;

    if (interpreter->AllocateTensors() != kTfLiteOk) {
        Serial.println("AllocateTensors() failed!");
        while (1) delay(1000);
    }

    modelInput  = interpreter->input(0);
    modelOutput = interpreter->output(0);
    Serial.printf("Model loaded. Input: %d elements, Output: %d classes\n",
                  modelInput->bytes, NUM_CLASSES);

    // --- WiFi first (so ESP-NOW inherits the AP channel) ---
    WiFi.mode(WIFI_STA);
    if (strlen(WIFI_SSID) > 0) {
        connectWiFi();
    }
    Serial.printf("WiFi channel: %d\n", WiFi.channel());

    // --- ESP-NOW (uses the same channel as WiFi) ---
    if (esp_now_init() != ESP_OK) {
        Serial.println("ESP-NOW init failed — halting.");
        while (1) delay(1000);
    }
    esp_now_register_recv_cb(onDataRecv);
    Serial.println("ESP-NOW: listening for Module A...");

    memset(ringBuffer, 0, sizeof(ringBuffer));
    Serial.println("Ready. Waiting for sensor data...");
}

// ── Loop ────────────────────────────────────────────────────────
void loop() {
    // Wait until we have a full window AND enough new samples for the stride
    if (totalSamplesRecv >= WINDOW_SIZE && samplesSinceInference >= INFERENCE_STRIDE) {
        runInference();
        samplesSinceInference = 0;
    }

    // Flush buffered events to Firebase periodically
    if (eventCount > 0) {
        unsigned long now = millis();
        if (eventCount >= MAX_BUFFERED_EVENTS || now - lastFlushTime >= BATCH_FLUSH_MS) {
            flushToFirebase();
        }
    }

    delay(5);
}

// ── Inference ───────────────────────────────────────────────────
void runInference() {
    // Copy ring buffer into model input tensor in chronological order.
    // ringHead points to the OLDEST sample (it's the next write position).
    int readPos = ringHead;  // oldest sample
    for (int t = 0; t < WINDOW_SIZE; t++) {
        int srcOffset = readPos * NUM_CHANNELS;
        int dstOffset = t * NUM_CHANNELS;
        for (int ch = 0; ch < NUM_CHANNELS; ch++) {
            modelInput->data.int8[dstOffset + ch] = ringBuffer[srcOffset + ch];
        }
        readPos = (readPos + 1) % WINDOW_SIZE;
    }

    // Run inference
    unsigned long t0 = millis();
    if (interpreter->Invoke() != kTfLiteOk) {
        Serial.println("Invoke() failed!");
        return;
    }
    unsigned long dt = millis() - t0;

    // Find argmax
    int8_t maxVal = -128;
    int    maxIdx = 0;
    for (int i = 0; i < NUM_CLASSES; i++) {
        int8_t v = modelOutput->data.int8[i];
        if (v > maxVal) {
            maxVal = v;
            maxIdx = i;
        }
    }

    Serial.printf("[B] Predicted: %-24s (class %d, conf=%+4d, %lu ms)\n",
                  CLASS_NAMES[maxIdx], maxIdx, maxVal, dt);

    // Debug: print all class scores
    Serial.print("    Scores: ");
    for (int i = 0; i < NUM_CLASSES; i++) {
        Serial.printf("%s=%+4d  ", CLASS_NAMES[i], modelOutput->data.int8[i]);
    }
    Serial.println();

    // Idle override: check if recent samples show low motion
    // Dequantize last 20 accel samples and compute variance from gravity
    static const float INPUT_SCALE      = 0.057339f;
    static const int32_t INPUT_ZERO_POINT = -4;
    static const float ACCEL_MEAN[] = { -0.015198f, 9.767265f, 0.049241f };
    static const float ACCEL_STD[]  = { 1.012651f, 0.338397f, 1.206693f };

    float gyroEnergy = 0;
    float accelVar = 0;
    const int CHECK_LEN = 20;
    int startPos = (ringHead - CHECK_LEN + WINDOW_SIZE) % WINDOW_SIZE;
    for (int s = 0; s < CHECK_LEN; s++) {
        int pos = (startPos + s) % WINDOW_SIZE;
        // Check gyro channels (3,4,5) — dequantize to normalized value
        for (int ch = 3; ch < 6; ch++) {
            float norm = ((float)ringBuffer[pos * NUM_CHANNELS + ch] - INPUT_ZERO_POINT) * INPUT_SCALE;
            gyroEnergy += norm * norm;
        }
        // Check accel deviation from expected idle
        for (int ch = 0; ch < 3; ch++) {
            float norm = ((float)ringBuffer[pos * NUM_CHANNELS + ch] - INPUT_ZERO_POINT) * INPUT_SCALE;
            float raw = norm * ACCEL_STD[ch] + ACCEL_MEAN[ch];
            float expected = ACCEL_MEAN[ch];  // idle = mean
            float diff = raw - expected;
            accelVar += diff * diff;
        }
    }
    gyroEnergy /= CHECK_LEN;
    accelVar /= CHECK_LEN;

    bool isIdle = (gyroEnergy < 0.5f && accelVar < 2.0f);
    if (isIdle) {
        Serial.println("[B] >>> Idle detected (low motion), skipping alert");
        return;
    }

    // Check if it's an aggressive event
    for (int i = 0; i < NUM_AGGRESSIVE; i++) {
        if (maxIdx == AGGRESSIVE_CLASSES[i]) {
            handleEvent(maxIdx, maxVal);
            break;
        }
    }
}

// ── Event handling + debounce ───────────────────────────────────
void handleEvent(int classIdx, int8_t confidence) {
    unsigned long now = millis();
    if (now - lastEventTime < DEBOUNCE_MS) {
        Serial.printf("[B] >>> %s (debounced, skipping)\n", CLASS_NAMES[classIdx]);
        return;
    }
    lastEventTime = now;

    Serial.printf("[B] >>> ALERT: %s (buffered %d/%d)\n",
                  CLASS_NAMES[classIdx], eventCount + 1, MAX_BUFFERED_EVENTS);

    // Buffer the event
    if (eventCount < MAX_BUFFERED_EVENTS) {
        eventBuffer[eventCount].eventType = CLASS_NAMES[classIdx];
        eventBuffer[eventCount].localTime = now;
        eventCount++;
    }
}

// ── Firebase batch flush ────────────────────────────────────────
void flushToFirebase() {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[B] No WiFi — skipping flush.");
        return;
    }

    // Dequantization constants
    static const float INPUT_SCALE       = 0.057339f;
    static const int32_t INPUT_ZERO_POINT = -4;
    static const float MEAN[]    = { -0.015198f, 9.767265f, 0.049241f, -0.001093f, 0.018368f, -0.000407f };
    static const float STD_DEV[] = { 1.012651f, 0.338397f, 1.206693f,  0.048699f,  0.264260f, 0.023646f };
    static const char* CHAN_NAMES[] = { "accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z" };

    // Build batch JSON
    JsonDocument doc;
    doc["device_id"] = "kateye-01";
    doc["timestamp"][".sv"] = "timestamp";  // Firebase server timestamp
    doc["event_count"] = eventCount;

    // Latest known location (from Module A's GPS)
    if (haveGpsFix) {
        JsonObject loc = doc["location"].to<JsonObject>();
        loc["lat"] = lastLatE7 / 1e7;
        loc["lng"] = lastLngE7 / 1e7;
    } else {
        doc["location"] = (const char*)nullptr;
    }

    // List of events in this batch
    JsonArray events = doc["events"].to<JsonArray>();
    for (int e = 0; e < eventCount; e++) {
        JsonObject ev = events.add<JsonObject>();
        ev["type"] = eventBuffer[e].eventType;
        ev["offset_ms"] = eventBuffer[e].localTime - eventBuffer[0].localTime;
    }

    // One snapshot from current ring buffer for context
    const int SNAPSHOT_LEN = 20;
    JsonObject snapshot = doc["snapshot"].to<JsonObject>();
    for (int ch = 0; ch < NUM_CHANNELS; ch++) {
        JsonArray arr = snapshot[CHAN_NAMES[ch]].to<JsonArray>();
        int startPos = (ringHead - SNAPSHOT_LEN + WINDOW_SIZE) % WINDOW_SIZE;
        for (int s = 0; s < SNAPSHOT_LEN; s++) {
            int pos = (startPos + s) % WINDOW_SIZE;
            int8_t q = ringBuffer[pos * NUM_CHANNELS + ch];
            float norm = ((float)q - INPUT_ZERO_POINT) * INPUT_SCALE;
            float raw  = norm * STD_DEV[ch] + MEAN[ch];
            arr.add(serialized(String(raw, 3)));
        }
    }

    String jsonStr;
    serializeJson(doc, jsonStr);

    HTTPClient http;
    http.begin(FIREBASE_URL);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(jsonStr);

    if (code > 0) {
        Serial.printf("[B] Firebase batch: %d (%d events)\n", code, eventCount);
    } else {
        Serial.printf("[B] Firebase error: %s\n", http.errorToString(code).c_str());
    }
    http.end();

    eventCount = 0;
    lastFlushTime = millis();
}

// ── WiFi helper ─────────────────────────────────────────────────
void connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.print("[B] WiFi connecting");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
        delay(250);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println(" OK");
        // Re-set ESP-NOW channel to match AP
        // (ESP-NOW works on whatever channel STA is using)
    } else {
        Serial.println(" FAILED");
    }
}
