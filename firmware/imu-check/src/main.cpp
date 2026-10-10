#include <Adafruit_BNO08x.h>
#include <Arduino.h>
#include <Wire.h>

// Wiring on the Servo Driver Board for XIAO:
//   BNO085 3.3V -> 3V3, GND -> GND, SDA -> D4, SCL -> D5, IO4/INT -> D3.
// This firmware is intentionally USB/IMU-only. It includes no servo library,
// never opens the servo UART, and cannot send a movement command.
constexpr uint8_t kImuAddress = 0x4A;
constexpr int kI2cSdaPin = D4;
constexpr int kI2cSclPin = D5;
constexpr int kImuInterruptPin = D3;
constexpr uint32_t kReportIntervalUs = 50000;  // 20 Hz
constexpr uint32_t kStatusIntervalMs = 2000;
constexpr uint32_t kTelemetryIntervalMs = 100;

Adafruit_BNO08x imu(-1);
sh2_SensorValue_t sensorValue;
bool imuReady = false;
uint32_t lastStatusMs = 0;
uint32_t lastTelemetryMs = 0;

struct EulerDegrees {
  float yaw;
  float pitch;
  float roll;
};

struct Quaternion {
  float real;
  float i;
  float j;
  float k;
};

// The BNO085 is mounted upside down because that is the only mechanically
// viable installation. This removes the 180-degree static roll offset.
//
constexpr Quaternion kSensorToRobotMount{0.0F, 1.0F, 0.0F, 0.0F};

bool i2cAddressResponds(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void printStatus(const char* status) {
  Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\"}\n",
                static_cast<unsigned long>(millis()), status);
}

void printI2cScan() {
  bool foundTarget = false;
  uint8_t foundCount = 0;
  Serial.print("{\"type\":\"imu_i2c_scan\",\"ms\":");
  Serial.print(millis());
  Serial.print(",\"addresses\":[");

  for (uint8_t address = 0x08; address < 0x78; ++address) {
    if (!i2cAddressResponds(address)) continue;
    if (foundCount > 0) Serial.print(',');
    Serial.printf("\"0x%02X\"", address);
    ++foundCount;
    if (address == kImuAddress) foundTarget = true;
  }

  Serial.printf("],\"bno085_address_0x4a_found\":%s,\"count\":%u}\n",
                foundTarget ? "true" : "false", foundCount);
}

EulerDegrees quaternionToEuler(float real, float i, float j, float k) {
  const float norm = sq(real) + sq(i) + sq(j) + sq(k);
  const float safeNorm = norm > 0.0F ? norm : 1.0F;
  const float sinPitch = constrain(-2.0F * (i * k - j * real) / safeNorm, -1.0F, 1.0F);

  EulerDegrees result{};
  result.yaw = atan2f(2.0F * (i * j + k * real), sq(i) - sq(j) - sq(k) + sq(real)) * RAD_TO_DEG;
  result.pitch = asinf(sinPitch) * RAD_TO_DEG;
  result.roll = atan2f(2.0F * (j * k + i * real), -sq(i) - sq(j) + sq(k) + sq(real)) * RAD_TO_DEG;
  return result;
}

Quaternion multiply(const Quaternion& left, const Quaternion& right) {
  return {
      left.real * right.real - left.i * right.i - left.j * right.j - left.k * right.k,
      left.real * right.i + left.i * right.real + left.j * right.k - left.k * right.j,
      left.real * right.j - left.i * right.k + left.j * right.real + left.k * right.i,
      left.real * right.k + left.i * right.j - left.j * right.i + left.k * right.real,
  };
}

EulerDegrees levelCorrectedToRobotFrame(const EulerDegrees& levelCorrected) {
  // Manual four-direction validation on the actual robot established that
  // this physical installation is also turned by 90 degrees in its mounting
  // plane: robot forward/back changes the level-corrected roll, while robot
  // right/left changes the level-corrected pitch.  The values below are the
  // names NEXUS and later control code should use.
  //
  // Pitch and roll are intentionally validated from real motion rather than
  // inferred from a board photo. Yaw is left as a relative heading; this ARVR
  // report does not provide an absolute magnetic compass heading.
  return {
      levelCorrected.yaw,
      levelCorrected.roll,
      levelCorrected.pitch,
  };
}

void enableReports() {
  if (!imu.enableReport(SH2_ARVR_STABILIZED_RV, kReportIntervalUs)) {
    printStatus("imu_report_enable_failed");
    return;
  }
  printStatus("imu_rotation_vector_enabled_20hz");
}

void printTelemetry(const EulerDegrees& robotAngles, const EulerDegrees& sensorAngles,
                    uint8_t accuracy) {
  Serial.printf(
      "{\"type\":\"imu_telemetry\",\"ms\":%lu,\"found\":true,\"report\":\"arvr_stabilized_rotation_vector\",\"frame\":\"robot\",\"mount_profile\":\"inverted_xy_swapped\",\"yaw_is_relative\":true,\"yaw_deg\":%.2f,\"pitch_deg\":%.2f,\"roll_deg\":%.2f,\"sensor_yaw_deg\":%.2f,\"sensor_pitch_deg\":%.2f,\"sensor_roll_deg\":%.2f,\"accuracy\":%u,\"int_pin_low\":%s}\n",
      static_cast<unsigned long>(millis()), robotAngles.yaw, robotAngles.pitch,
      robotAngles.roll, sensorAngles.yaw, sensorAngles.pitch, sensorAngles.roll, accuracy,
      digitalRead(kImuInterruptPin) == LOW ? "true" : "false");
}

void setup() {
  Serial.begin(115200);
  delay(300);
  printStatus("imu_check_boot_no_servo_commands");

  pinMode(kImuInterruptPin, INPUT_PULLUP);
  Wire.begin(kI2cSdaPin, kI2cSclPin, 100000);
  printI2cScan();

  if (!i2cAddressResponds(kImuAddress)) {
    printStatus("imu_bno085_not_found_at_0x4a");
    return;
  }

  if (!imu.begin_I2C(kImuAddress, &Wire)) {
    printStatus("imu_bno085_initialization_failed");
    return;
  }

  imuReady = true;
  printStatus("imu_bno085_initialized");
  enableReports();
}

void loop() {
  if (!imuReady) {
    if (millis() - lastStatusMs >= kStatusIntervalMs) {
      lastStatusMs = millis();
      printI2cScan();
      printStatus("imu_waiting_for_bno085_at_0x4a");
    }
    return;
  }

  if (imu.wasReset()) {
    printStatus("imu_reset_detected_reenabling_reports");
    enableReports();
  }

  if (!imu.getSensorEvent(&sensorValue)) return;
  if (sensorValue.sensorId != SH2_ARVR_STABILIZED_RV) return;
  if (millis() - lastTelemetryMs < kTelemetryIntervalMs) return;

  lastTelemetryMs = millis();
  const auto& rotation = sensorValue.un.arvrStabilizedRV;
  const Quaternion sensorOrientation{rotation.real, rotation.i, rotation.j, rotation.k};
  const Quaternion levelCorrectedOrientation = multiply(sensorOrientation, kSensorToRobotMount);
  const EulerDegrees levelCorrected = quaternionToEuler(
      levelCorrectedOrientation.real, levelCorrectedOrientation.i,
      levelCorrectedOrientation.j, levelCorrectedOrientation.k);
  printTelemetry(levelCorrectedToRobotFrame(levelCorrected),
                 quaternionToEuler(sensorOrientation.real, sensorOrientation.i,
                                   sensorOrientation.j, sensorOrientation.k),
                 rotation.accuracy);
}
