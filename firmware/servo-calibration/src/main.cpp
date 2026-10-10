#include <Arduino.h>
#include <SCServo.h>

namespace {

struct ServoDefinition { uint8_t id; const char* name; };
constexpr ServoDefinition kServos[] = {
    {11, "LEFT_YAW"}, {12, "LEFT_PLANAR_UPPER"}, {13, "LEFT_PLANAR_KNEE"},
    {21, "RIGHT_YAW"}, {22, "RIGHT_PLANAR_UPPER"}, {23, "RIGHT_PLANAR_KNEE"},
};
constexpr uint32_t kServoBaud = 1000000;
constexpr uint32_t kUsbBaud = 115200;
constexpr uint32_t kFeedbackIntervalMs = 200;
constexpr uint32_t kIdleHeartbeatIntervalMs = 2000;
constexpr int kServoRxPin = D7;
constexpr int kServoTxPin = D6;

enum class Group : uint8_t { None, LeftYaw, RightYaw, LeftPlanarPair, RightPlanarPair };
enum class State : uint8_t { SafeIdle, GroupSelected, ReleaseArmed, GroupReleased };

SCSCL servo;
Group selectedGroup = Group::None;
State calibrationState = State::SafeIdle;
uint32_t lastFeedbackMs = 0;
uint32_t lastIdleHeartbeatMs = 0;
String inputLine;

const char* groupName(Group group) {
  switch (group) {
    case Group::LeftYaw: return "LEFT_YAW";
    case Group::RightYaw: return "RIGHT_YAW";
    case Group::LeftPlanarPair: return "LEFT_PLANAR_PAIR";
    case Group::RightPlanarPair: return "RIGHT_PLANAR_PAIR";
    default: return "NONE";
  }
}

const char* stateName(State state) {
  switch (state) {
    case State::SafeIdle: return "safe_idle";
    case State::GroupSelected: return "group_selected";
    case State::ReleaseArmed: return "release_armed";
    case State::GroupReleased: return "group_released";
  }
  return "unknown";
}

uint8_t groupIds(Group group, uint8_t out[2]) {
  switch (group) {
    case Group::LeftYaw: out[0] = 11; return 1;
    case Group::RightYaw: out[0] = 21; return 1;
    case Group::LeftPlanarPair: out[0] = 12; out[1] = 13; return 2;
    case Group::RightPlanarPair: out[0] = 22; out[1] = 23; return 2;
    default: return 0;
  }
}

const ServoDefinition* definitionFor(uint8_t id) {
  for (const ServoDefinition& definition : kServos) if (definition.id == id) return &definition;
  return nullptr;
}

void printStatus(const char* status) {
  Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\"}\n",
                static_cast<unsigned long>(millis()), status);
}

void printState() {
  uint8_t ids[2]; const uint8_t count = groupIds(selectedGroup, ids);
  Serial.printf("{\"type\":\"calibration_state\",\"ms\":%lu,\"state\":\"%s\",\"group\":\"%s\",\"ids\":[",
                static_cast<unsigned long>(millis()), stateName(calibrationState), groupName(selectedGroup));
  for (uint8_t i = 0; i < count; ++i) Serial.printf("%s%u", i == 0 ? "" : ",", ids[i]);
  Serial.println("]}");
}

bool readAndPrint(uint8_t id, const char* type = "calibration_telemetry") {
  const ServoDefinition* definition = definitionFor(id);
  if (definition == nullptr || servo.Ping(id) == -1 || servo.FeedBack(id) == -1) {
    Serial.printf("{\"type\":\"%s\",\"ms\":%lu,\"id\":%u,\"found\":false}\n", type,
                  static_cast<unsigned long>(millis()), id);
    return false;
  }
  Serial.printf("{\"type\":\"%s\",\"ms\":%lu,\"id\":%u,\"name\":\"%s\",\"found\":true,\"position_raw\":%d,\"voltage_v\":%.1f,\"temperature_c\":%d}\n",
                type, static_cast<unsigned long>(millis()), id, definition->name,
                servo.ReadPos(-1), servo.ReadVoltage(-1) / 10.0F, servo.ReadTemper(-1));
  return true;
}

void reportAllServos() {
  int found = 0;
  for (const ServoDefinition& definition : kServos) {
    if (readAndPrint(definition.id, "servo_telemetry")) ++found;
  }
  Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\",\"found_count\":%d,\"expected_count\":6}\n",
                static_cast<unsigned long>(millis()), found == 6 ? "all_expected_servos_found" : "servo_scan_incomplete", found);
}

Group parseGroup(const String& text) {
  if (text == "LEFT_YAW") return Group::LeftYaw;
  if (text == "RIGHT_YAW") return Group::RightYaw;
  if (text == "LEFT_PLANAR_PAIR") return Group::LeftPlanarPair;
  if (text == "RIGHT_PLANAR_PAIR") return Group::RightPlanarPair;
  return Group::None;
}

bool validMark(const String& label) {
  return label == "NEUTRAL" || label == "LIMIT_DIRECTION_A" || label == "LIMIT_DIRECTION_B" || label == "RETURN_NEUTRAL";
}

void mark(const String& label) {
  if (calibrationState != State::GroupReleased || !validMark(label)) { printStatus("calibration_mark_rejected"); return; }
  uint8_t ids[2]; const uint8_t count = groupIds(selectedGroup, ids);
  int positions[2];
  for (uint8_t i = 0; i < count; ++i) if (servo.FeedBack(ids[i]) == -1) { printStatus("calibration_mark_rejected_feedback_failed"); return; } else positions[i] = servo.ReadPos(-1);
  Serial.printf("{\"type\":\"calibration_mark\",\"ms\":%lu,\"group\":\"%s\",\"label\":\"%s\",\"positions\":{",
                static_cast<unsigned long>(millis()), groupName(selectedGroup), label.c_str());
  for (uint8_t i = 0; i < count; ++i) {
    const ServoDefinition* definition = definitionFor(ids[i]);
    Serial.printf("%s\"%s\":%d", i == 0 ? "" : ",", definition->name, positions[i]);
  }
  Serial.println("}}");
}

void hold() {
  if (calibrationState != State::GroupReleased) { printStatus("calibration_hold_rejected"); return; }
  uint8_t ids[2]; const uint8_t count = groupIds(selectedGroup, ids);
  bool ok = true;
  for (uint8_t i = 0; i < count; ++i) if (servo.EnableTorque(ids[i], 1) == -1) ok = false;
  printStatus(ok ? "calibration_hold_applied" : "calibration_hold_partially_failed");
  selectedGroup = Group::None; calibrationState = State::SafeIdle; printState();
}

void release() {
  if (calibrationState != State::ReleaseArmed) { printStatus("calibration_release_rejected_not_armed"); return; }
  uint8_t ids[2]; const uint8_t count = groupIds(selectedGroup, ids);
  bool ok = true;
  for (uint8_t i = 0; i < count; ++i) if (servo.EnableTorque(ids[i], 0) == -1) ok = false;
  if (!ok) { printStatus("calibration_release_failed"); return; }
  calibrationState = State::GroupReleased; printState();
}

void handleCommand(String command) {
  command.trim();
  if (command == "STATUS") { reportAllServos(); printState(); return; }
  if (command.startsWith("SELECT ") && calibrationState != State::GroupReleased) {
    Group group = parseGroup(command.substring(7));
    if (group == Group::None) { printStatus("calibration_select_rejected"); return; }
    selectedGroup = group; calibrationState = State::GroupSelected; printState(); return;
  }
  if (command == "ARM RELEASE" && calibrationState == State::GroupSelected) { calibrationState = State::ReleaseArmed; printState(); return; }
  if (command == "RELEASE") { release(); return; }
  if (command.startsWith("MARK ")) { mark(command.substring(5)); return; }
  if (command == "HOLD") { hold(); return; }
  if (command == "DONE" && calibrationState == State::SafeIdle) { printStatus("calibration_complete"); return; }
  printStatus("calibration_command_rejected");
}

void readCommands() {
  while (Serial.available()) {
    const char character = static_cast<char>(Serial.read());
    if (character == '\n' || character == '\r') {
      if (inputLine.length() > 0) { handleCommand(inputLine); inputLine = ""; }
    } else if (inputLine.length() < 64) inputLine += character;
    else { inputLine = ""; printStatus("calibration_command_rejected_too_long"); }
  }
}
}  // namespace

void setup() {
  Serial.begin(kUsbBaud); delay(1500);
  Serial1.begin(kServoBaud, SERIAL_8N1, kServoRxPin, kServoTxPin); servo.pSerial = &Serial1;
  printStatus("calibration_monitor_armed_no_torque_writes");
  reportAllServos(); printState();
}

void loop() {
  readCommands();
  if (calibrationState == State::GroupReleased && millis() - lastFeedbackMs >= kFeedbackIntervalMs) {
    lastFeedbackMs = millis(); uint8_t ids[2]; const uint8_t count = groupIds(selectedGroup, ids);
    for (uint8_t i = 0; i < count; ++i) readAndPrint(ids[i]);
  }
  // A GUI often opens the USB port after the ESP32 has already booted. Keep a
  // harmless heartbeat so it can identify this firmware without any torque or
  // position write. Bus scans happen only after an explicit STATUS request.
  if (calibrationState != State::GroupReleased && millis() - lastIdleHeartbeatMs >= kIdleHeartbeatIntervalMs) {
    lastIdleHeartbeatMs = millis();
    printStatus("calibration_monitor_armed_no_torque_writes");
    printState();
  }
}
