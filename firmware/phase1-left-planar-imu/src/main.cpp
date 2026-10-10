#error "Retired: pre-remount ID13 targets. Use supported-squat; see ADR 0014."
#include <Adafruit_BNO08x.h>
#include <Arduino.h>
#include <SCServo.h>
#include <Wire.h>

// Phase 1: supported planar-linkage repeatability test.
//
// SAFETY CONTRACT
// - No servo position command is sent during boot.
// - Only one planar pair can move at a time, and only to the constants below.
// - Every movement needs a fresh ARM command then one MOVE command.
// - Arming is rejected unless all six known servos and the IMU are online.
// - This firmware never drives yaw joints (11 or 21).

namespace {
constexpr uint32_t kUsbBaud = 115200;
constexpr uint32_t kServoBaud = 1000000;
constexpr int kServoRxPin = D7;
constexpr int kServoTxPin = D6;

constexpr uint8_t kLeftPairIds[] = {12, 13};
constexpr uint16_t kLeftNeutral[] = {595, 0};
// Halfway from manual neutral (595, 0) to candidate A (788, 228).
// This is an observed candidate inside the manually explored space, not a
// mechanical endpoint. Do not edit these values from a UI.
constexpr uint16_t kLeftCandidateA50[] = {692, 114};
constexpr uint8_t kRightPairIds[] = {22, 23};
constexpr uint16_t kRightNeutral[] = {899, 158};
// Halfway from manual neutral (899, 158) to candidate A (631, 371).
constexpr uint16_t kRightCandidateA50[] = {765, 265};
constexpr uint16_t kMoveDurationMs = 1500;
constexpr uint16_t kMoveSpeed = 40;

constexpr uint8_t kImuAddress = 0x4A;
constexpr int kI2cSdaPin = D4;
constexpr int kI2cSclPin = D5;
constexpr int kImuInterruptPin = D3;
constexpr uint32_t kImuReportIntervalUs = 50000;  // BNO085 at 20 Hz.
constexpr uint32_t kImuOutputIntervalMs = 100;    // USB output at 10 Hz.
constexpr uint32_t kImuInitRetryIntervalMs = 2000;
constexpr uint32_t kServoScanIntervalMs = 2000;

struct ServoDefinition {
  uint8_t id;
  const char* name;
};

constexpr ServoDefinition kAllServos[] = {
    {11, "LEFT_YAW"}, {12, "LEFT_PLANAR_UPPER"}, {13, "LEFT_PLANAR_KNEE"},
    {21, "RIGHT_YAW"}, {22, "RIGHT_PLANAR_UPPER"}, {23, "RIGHT_PLANAR_KNEE"},
};

struct Quaternion {
  float real;
  float i;
  float j;
  float k;
};

struct EulerDegrees {
  float yaw;
  float pitch;
  float roll;
};

enum class PlanarPair : uint8_t { NONE, LEFT, RIGHT };

// Verified on the assembled robot: the inverted, in-plane-swapped IMU mount.
constexpr Quaternion kLevelMountCorrection{0.0F, 1.0F, 0.0F, 0.0F};

SCSCL servo;
Adafruit_BNO08x imu(-1);
sh2_SensorValue_t imuEvent;
bool imuReady = false;
PlanarPair armedPair = PlanarPair::NONE;
String commandLine;
bool commandOverflow=false;
uint32_t lastServoScanMs = 0;
uint32_t lastImuOutputMs = 0;
uint32_t lastImuInitAttemptMs = 0;

void status(const char* value) {
  Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\"}\n",
                static_cast<unsigned long>(millis()), value);
}

Quaternion multiply(const Quaternion& left, const Quaternion& right) {
  return {
      left.real * right.real - left.i * right.i - left.j * right.j - left.k * right.k,
      left.real * right.i + left.i * right.real + left.j * right.k - left.k * right.j,
      left.real * right.j - left.i * right.k + left.j * right.real + left.k * right.i,
      left.real * right.k + left.i * right.j - left.j * right.i + left.k * right.real,
  };
}

EulerDegrees quaternionToEuler(const Quaternion& q) {
  const float norm = sq(q.real) + sq(q.i) + sq(q.j) + sq(q.k);
  const float safeNorm = norm > 0.0F ? norm : 1.0F;
  const float sinPitch = constrain(-2.0F * (q.i * q.k - q.j * q.real) / safeNorm,
                                   -1.0F, 1.0F);
  return {
      static_cast<float>(atan2f(2.0F * (q.i * q.j + q.k * q.real),
                                sq(q.i) - sq(q.j) - sq(q.k) + sq(q.real)) * RAD_TO_DEG),
      static_cast<float>(asinf(sinPitch) * RAD_TO_DEG),
      static_cast<float>(atan2f(2.0F * (q.j * q.k + q.i * q.real),
                                -sq(q.i) - sq(q.j) + sq(q.k) + sq(q.real)) * RAD_TO_DEG),
  };
}

EulerDegrees robotFrameEuler(const Quaternion& sensorOrientation) {
  const EulerDegrees levelCorrected =
      quaternionToEuler(multiply(sensorOrientation, kLevelMountCorrection));
  // Real four-direction tilt test: forward/back was the corrected roll;
  // robot right/left was the corrected pitch.
  return {levelCorrected.yaw, levelCorrected.roll, levelCorrected.pitch};
}

void printImuTelemetry(const EulerDegrees& robotAngles, uint8_t accuracy) {
  Serial.printf(
      "{\"type\":\"imu_telemetry\",\"ms\":%lu,\"found\":true,"
      "\"report\":\"arvr_stabilized_rotation_vector\",\"frame\":\"robot\","
      "\"mount_profile\":\"inverted_xy_swapped\",\"yaw_is_relative\":true,"
      "\"yaw_deg\":%.2f,\"pitch_deg\":%.2f,\"roll_deg\":%.2f,"
      "\"accuracy\":%u,\"int_pin_low\":%s}\n",
      static_cast<unsigned long>(millis()), robotAngles.yaw, robotAngles.pitch,
      robotAngles.roll, accuracy,
      digitalRead(kImuInterruptPin) == LOW ? "true" : "false");
}

void serviceImu() {
  if (!imuReady) return;
  if (imu.wasReset()) {
    status("imu_reset_detected_reenabling_reports");
    if (!imu.enableReport(SH2_ARVR_STABILIZED_RV, kImuReportIntervalUs)) {
      imuReady = false;
      status("imu_report_reenable_failed_motion_locked");
      return;
    }
  }
  if (!imu.getSensorEvent(&imuEvent)) return;
  if (imuEvent.sensorId != SH2_ARVR_STABILIZED_RV) return;
  if (millis() - lastImuOutputMs < kImuOutputIntervalMs) return;

  lastImuOutputMs = millis();
  const auto& rotation = imuEvent.un.arvrStabilizedRV;
  printImuTelemetry(robotFrameEuler({rotation.real, rotation.i, rotation.j, rotation.k}),
                    rotation.accuracy);
}

bool reportServo(const ServoDefinition& definition) {
  if (servo.Ping(definition.id) == -1 || servo.FeedBack(definition.id) == -1) {
    Serial.printf("{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,"
                  "\"name\":\"%s\",\"found\":false}\n",
                  static_cast<unsigned long>(millis()), definition.id, definition.name);
    return false;
  }

  Serial.printf(
      "{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,"
      "\"name\":\"%s\",\"found\":true,\"position_raw\":%d,"
      "\"voltage_v\":%.1f,\"temperature_c\":%d,\"moving\":%d}\n",
      static_cast<unsigned long>(millis()), definition.id, definition.name,
      servo.ReadPos(-1), servo.ReadVoltage(-1) / 10.0F, servo.ReadTemper(-1),
      servo.ReadMove(-1));
  return true;
}

int reportAllServos() {
  int found = 0;
  for (const ServoDefinition& definition : kAllServos) {
    if (reportServo(definition)) ++found;
  }
  Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\","
                "\"found_count\":%d,\"expected_count\":6}\n",
                static_cast<unsigned long>(millis()),
                found == 6 ? "all_expected_servos_found" : "servo_scan_incomplete", found);
  return found;
}

bool prerequisitesHealthy() {
  if (!imuReady) {
    status("motion_arm_rejected_imu_not_ready");
    return false;
  }
  if (reportAllServos() != 6) {
    status("motion_arm_rejected_servo_scan_incomplete");
    return false;
  }
  return true;
}

const uint8_t* pairIds(PlanarPair pair) {
  return pair == PlanarPair::LEFT ? kLeftPairIds : kRightPairIds;
}

const uint16_t* pairNeutral(PlanarPair pair) {
  return pair == PlanarPair::LEFT ? kLeftNeutral : kRightNeutral;
}

const uint16_t* pairCandidateA50(PlanarPair pair) {
  return pair == PlanarPair::LEFT ? kLeftCandidateA50 : kRightCandidateA50;
}

const char* pairLabel(PlanarPair pair) {
  return pair == PlanarPair::LEFT ? "left" : "right";
}

void sendArmedPair(const uint16_t* targets, const char* label) {
  if (armedPair == PlanarPair::NONE) {
    status("motion_rejected_planar_pair_not_armed");
    return;
  }
  if (!prerequisitesHealthy()) {
    armedPair = PlanarPair::NONE;
    return;
  }

  const uint8_t* selectedIds = pairIds(armedPair);
  uint8_t ids[] = {selectedIds[0], selectedIds[1]};
  uint16_t targetCopy[] = {targets[0], targets[1]};
  uint16_t durations[] = {kMoveDurationMs, kMoveDurationMs};
  uint16_t speeds[] = {kMoveSpeed, kMoveSpeed};
  servo.SyncWritePos(ids, 2, targetCopy, durations, speeds);
  const char* selectedLabel = pairLabel(armedPair);
  armedPair = PlanarPair::NONE;
  Serial.printf(
      "{\"type\":\"motion_command\",\"ms\":%lu,\"ids\":[%u,%u],"
      "\"targets\":[%u,%u],\"duration_ms\":%u,\"label\":\"%s_%s\"}\n",
      static_cast<unsigned long>(millis()), ids[0], ids[1], targets[0], targets[1],
      kMoveDurationMs, selectedLabel, label);
  status("phase1_motion_sent_auto_disarmed");
}

void handleCommand(String command) {
  command.trim();
  if (command == "STATUS") {
    reportAllServos();
    status(imuReady ? "phase1_left_planar_imu_ready" : "phase1_imu_not_ready_motion_locked");
    return;
  }
  if (command == "ARM LEFT_PAIR" || command == "ARM RIGHT_PAIR") {
    const PlanarPair requestedPair =
        command == "ARM LEFT_PAIR" ? PlanarPair::LEFT : PlanarPair::RIGHT;
    armedPair = prerequisitesHealthy() ? requestedPair : PlanarPair::NONE;
    status(armedPair == PlanarPair::NONE
               ? "phase1_planar_pair_not_armed"
               : requestedPair == PlanarPair::LEFT
                     ? "phase1_left_pair_armed_one_command_only"
                     : "phase1_right_pair_armed_one_command_only");
    return;
  }
  if (command == "MOVE A") {
    if (armedPair == PlanarPair::NONE) {
      status("motion_rejected_planar_pair_not_armed");
    } else {
      sendArmedPair(pairCandidateA50(armedPair), "candidate_a_50_percent");
    }
    return;
  }
  if (command == "MOVE NEUTRAL") {
    if (armedPair == PlanarPair::NONE) {
      status("motion_rejected_planar_pair_not_armed");
    } else {
      sendArmedPair(pairNeutral(armedPair), "neutral");
    }
    return;
  }
  if (command == "DISARM") {
    armedPair = PlanarPair::NONE;
    status("phase1_motion_disarmed");
    return;
  }
  status("phase1_motion_command_rejected");
}

void readCommands() {
  while (Serial.available()) {
    const char character = static_cast<char>(Serial.read());
    if (character == '\n' || character == '\r') {
      if (commandOverflow) {
        armedPair = PlanarPair::NONE;
        status("phase1_motion_command_overflow_rejected");
      } else if (commandLine.length() > 0) handleCommand(commandLine);
      commandLine = "";
      commandOverflow = false;
    } else if (!commandOverflow && commandLine.length() < 40) {
      commandLine += character;
    } else {
      commandLine = "";
      commandOverflow = true;
    }
  }
}

bool i2cAddressResponds(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void tryInitializeImu() {
  lastImuInitAttemptMs = millis();
  if (!i2cAddressResponds(kImuAddress)) {
    status("imu_bno085_address_0x4a_not_found_retrying_motion_locked");
    return;
  }
  if (!imu.begin_I2C(kImuAddress, &Wire)) {
    status("imu_bno085_initialization_failed_retrying_motion_locked");
    return;
  }
  if (!imu.enableReport(SH2_ARVR_STABILIZED_RV, kImuReportIntervalUs)) {
    status("imu_report_enable_failed_retrying_motion_locked");
    return;
  }
  imuReady = true;
  status("imu_bno085_initialized_robot_frame");
}

void setupImu() {
  pinMode(kImuInterruptPin, INPUT_PULLUP);
  Wire.begin(kI2cSdaPin, kI2cSclPin, 100000);
  // BNO085 may still be booting when the XIAO resets. A retry in loop() makes
  // this recoverable rather than permanently locking motion until reflash.
  delay(500);
  tryInitializeImu();
}
}  // namespace

void setup() {
  Serial.begin(kUsbBaud);
  delay(300);
  status("phase1_planar_boot_no_motion_until_explicit_arm");
  setupImu();
  Serial1.begin(kServoBaud, SERIAL_8N1, kServoRxPin, kServoTxPin);
  servo.pSerial = &Serial1;
}

void loop() {
  readCommands();
  if (!imuReady && millis() - lastImuInitAttemptMs >= kImuInitRetryIntervalMs) {
    tryInitializeImu();
  }
  serviceImu();
  if (millis() - lastServoScanMs >= kServoScanIntervalMs) {
    lastServoScanMs = millis();
    reportAllServos();
    status(imuReady ? "phase1_left_planar_imu_ready" : "phase1_imu_not_ready_motion_locked");
  }
}
