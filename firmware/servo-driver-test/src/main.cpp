#include <Arduino.h>
#include <SCServo.h>

namespace {

struct ServoDefinition {
  uint8_t id;
  const char* name;
};

constexpr ServoDefinition kServos[] = {
    {11, "LEFT_YAW"},
    {12, "LEFT_PLANAR_UPPER"},
    {13, "LEFT_PLANAR_KNEE"},
    {21, "RIGHT_YAW"},
    {22, "RIGHT_PLANAR_UPPER"},
    {23, "RIGHT_PLANAR_KNEE"},
};

constexpr uint8_t kFactoryDefaultId = 1;
constexpr uint32_t kServoBaud = 1000000;
constexpr uint32_t kUsbBaud = 115200;
constexpr uint32_t kScanIntervalMs = 2000;
constexpr int kServoRxPin = D7;
constexpr int kServoTxPin = D6;

SCSCL servo;
uint32_t lastScanMs = 0;

void printStatus(const char* status, int foundCount = -1) {
  if (foundCount >= 0) {
    Serial.printf(
        "{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\","
        "\"found_count\":%d,\"expected_count\":%u}\n",
        static_cast<unsigned long>(millis()), status, foundCount,
        static_cast<unsigned>(sizeof(kServos) / sizeof(kServos[0])));
    return;
  }

  Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\"}\n",
                static_cast<unsigned long>(millis()), status);
}

void printServoTelemetry(const ServoDefinition& definition) {
  const int position = servo.ReadPos(-1);
  const int voltageRaw = servo.ReadVoltage(-1);
  const int temperatureC = servo.ReadTemper(-1);
  const int moving = servo.ReadMove(-1);

  Serial.printf(
      "{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,"
      "\"name\":\"%s\",\"found\":true,\"position_raw\":%d,"
      "\"voltage_v\":%.1f,\"temperature_c\":%d,\"moving\":%d}\n",
      static_cast<unsigned long>(millis()), definition.id, definition.name,
      position, voltageRaw / 10.0F, temperatureC, moving);
}

void scanServos() {
  int foundCount = 0;

  if (servo.Ping(kFactoryDefaultId) != -1) {
    printStatus("warning_factory_default_id_1_detected");
  }

  for (const ServoDefinition& definition : kServos) {
    if (servo.Ping(definition.id) == -1) {
      Serial.printf(
          "{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,"
          "\"name\":\"%s\",\"found\":false}\n",
          static_cast<unsigned long>(millis()), definition.id, definition.name);
      continue;
    }

    ++foundCount;
    if (servo.FeedBack(definition.id) == -1) {
      Serial.printf(
          "{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,"
          "\"name\":\"%s\",\"found\":true,\"feedback\":\"failed\"}\n",
          static_cast<unsigned long>(millis()), definition.id, definition.name);
      continue;
    }
    printServoTelemetry(definition);
  }

  printStatus(foundCount == 6 ? "all_expected_servos_found" : "servo_scan_incomplete",
              foundCount);
}

}  // namespace

void setup() {
  Serial.begin(kUsbBaud);
  delay(1500);

  Serial1.begin(kServoBaud, SERIAL_8N1, kServoRxPin, kServoTxPin);
  servo.pSerial = &Serial1;

  printStatus("read_only_all_servo_scan_armed_no_motion_or_writes");
}

void loop() {
  const uint32_t now = millis();
  if (now - lastScanMs < kScanIntervalMs) {
    return;
  }
  lastScanMs = now;
  scanServos();
}
