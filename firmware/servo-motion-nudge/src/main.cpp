#include <Arduino.h>
#include <SCServo.h>

namespace {
constexpr uint8_t kId = 11;
constexpr uint16_t kNeutral = 857;
constexpr uint16_t kOutward = 877;
constexpr uint16_t kInward = 837;
constexpr uint16_t kMoveTimeMs = 1000;
constexpr uint16_t kMoveSpeed = 50;
constexpr uint32_t kServoBaud = 1000000;
constexpr uint32_t kUsbBaud = 115200;
constexpr int kRx = D7;
constexpr int kTx = D6;
constexpr uint32_t kTelemetryIntervalMs = 2000;
SCSCL servo;
bool armed = false;
String line;
bool overflow=false;
uint32_t lastTelemetryMs = 0;

struct ServoDefinition { uint8_t id; const char* name; };
constexpr ServoDefinition kServos[] = {
    {11, "LEFT_YAW"}, {12, "LEFT_PLANAR_UPPER"}, {13, "LEFT_PLANAR_KNEE"},
    {21, "RIGHT_YAW"}, {22, "RIGHT_PLANAR_UPPER"}, {23, "RIGHT_PLANAR_KNEE"},
};

void status(const char* value) { Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\"}\n", static_cast<unsigned long>(millis()), value); }
bool telemetry(const ServoDefinition& definition) {
  if (servo.Ping(definition.id) == -1 || servo.FeedBack(definition.id) == -1) { Serial.printf("{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,\"name\":\"%s\",\"found\":false}\n", static_cast<unsigned long>(millis()), definition.id, definition.name); return false; }
  Serial.printf("{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,\"name\":\"%s\",\"found\":true,\"position_raw\":%d,\"voltage_v\":%.1f,\"temperature_c\":%d,\"moving\":%d}\n", static_cast<unsigned long>(millis()), definition.id, definition.name, servo.ReadPos(-1), servo.ReadVoltage(-1)/10.0F, servo.ReadTemper(-1), servo.ReadMove(-1));
  return true;
}
void reportAll() {
  int found = 0;
  for (const ServoDefinition& definition : kServos) if (telemetry(definition)) ++found;
  Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\",\"found_count\":%d,\"expected_count\":6}\n", static_cast<unsigned long>(millis()), found == 6 ? "all_expected_servos_found" : "servo_scan_incomplete", found);
}
void move(uint16_t target, const char* label) {
  if (!armed) { status("motion_rejected_not_armed"); return; }
  if (servo.WritePos(kId, target, kMoveTimeMs, kMoveSpeed) == -1) { status("motion_write_failed"); return; }
  armed = false;
  Serial.printf("{\"type\":\"motion_command\",\"ms\":%lu,\"id\":11,\"target_raw\":%u,\"duration_ms\":1000,\"label\":\"%s\"}\n", static_cast<unsigned long>(millis()), target, label);
  status("motion_command_sent_disarmed");
}
void command(String cmd) {
  cmd.trim();
  if (cmd == "STATUS") { reportAll(); status("motion_nudge_ready_id11_only"); return; }
  if (cmd == "ARM ID11") { if (servo.Ping(kId) == -1) status("motion_arm_rejected_id11_missing"); else { armed = true; status("motion_armed_id11_one_command_only"); } return; }
  if (cmd == "MOVE OUTWARD") { move(kOutward, "outward_plus_20"); return; }
  if (cmd == "MOVE INWARD") { move(kInward, "inward_minus_20"); return; }
  if (cmd == "MOVE NEUTRAL") { move(kNeutral, "neutral_857"); return; }
  if (cmd == "DISARM") { armed = false; status("motion_disarmed"); return; }
  status("motion_command_rejected");
}
void readInput() {
  while (Serial.available()) {
    char c=static_cast<char>(Serial.read());
    if(c=='\n'||c=='\r') {
      if(overflow) { armed=false;status("motion_command_overflow_rejected"); }
      else if(line.length()) command(line);
      line="";overflow=false;
    } else if(!overflow&&line.length()<40) line+=c;
    else { line="";overflow=true; }
  }
}
} // namespace
void setup() { Serial.begin(kUsbBaud); delay(1500); Serial1.begin(kServoBaud, SERIAL_8N1, kRx, kTx); servo.pSerial = &Serial1; status("motion_nudge_armed_no_motion_until_command"); }
void loop() { readInput(); if (millis() - lastTelemetryMs >= kTelemetryIntervalMs) { lastTelemetryMs = millis(); reportAll(); status("motion_nudge_ready_id11_only"); } }
