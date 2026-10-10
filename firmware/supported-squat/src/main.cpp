#include <Adafruit_BNO08x.h>
#include <Arduino.h>
#include <SCServo.h>
#include <Wire.h>
#include "SquatGuard.h"
#include "MotionProfile.h"
// Supported experiments; no EEPROM writes. Only left-forward uses yaw.
namespace {
constexpr const char* kFirmwareVersion="squat_firmware_link_watchdog_v34";
constexpr uint32_t kLinkTimeoutMs=3000;
bool heartbeatSeen=false;uint32_t lastHeartbeatMs=0;
constexpr uint8_t kAllIds[]={11,12,13,21,22,23};
constexpr uint8_t kIds[]={12,13,22,23};
constexpr const char* kNames[]={"LEFT_YAW","LEFT_PLANAR_UPPER","LEFT_PLANAR_KNEE","RIGHT_YAW","RIGHT_PLANAR_UPPER","RIGHT_PLANAR_KNEE"};
constexpr uint8_t kPlane=0x36,kKnees=0x24,kFull=0x3f;
constexpr uint8_t kImuAddress=0x4A;
constexpr int kImuInterruptPin=D3,kI2cSdaPin=D4,kI2cSclPin=D5;
constexpr uint32_t kImuReportIntervalUs=50000,kImuOutputIntervalMs=100;
Adafruit_BNO08x imu(-1);sh2_SensorValue_t imuEvent;SCSCL servo;SquatGuard guard;
bool imuReady=false;uint32_t lastImuOutputMs=0,lastImuInitAttemptMs=0,lastImuGoodMs=0;
uint32_t lastScanMs=0,lastStateMs=0;
struct Quaternion {float real,i,j,k;};struct EulerDegrees {float yaw,pitch,roll;};
constexpr Quaternion kLevelMountCorrection{0,1,0,0};
struct Reading {bool found=false;int pos=-1,voltage=-1,temp=-1,moving=-1,output=0;};
Reading readings[6];
String commandLine;bool overflow=false;
MotionProfile::Pose activeTarget;uint8_t owned=kPlane,phaseMask=0,motionMask=0;
bool kneesFirst=false,arrivalTiming=false;uint32_t arrivalSince=0;
int walkStage=-1,autoStepPhase=0;bool downResult=false,walkRight=false,walkRepeat=false;
void status(const char* value){Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\"}\n",(unsigned long)millis(),value);}
void reportState(){const char* names[]={"squat_state_idle","squat_state_armed_down","squat_state_moving_down","squat_state_down","squat_state_armed_up","squat_state_moving_up","squat_state_complete","squat_state_fault","squat_state_held"};status(names[guard.state]);}
void torque(uint8_t mask,int value){uint8_t ids[6],data[6],n=0;for(int i=0;i<6;i++)if(mask&(1u<<i)){ids[n]=kAllIds[i];data[n++]=value;}if(n)servo.syncWrite(ids,n,SCSCL_TORQUE_ENABLE,data,1);}
void abortMotion(const char* reason){walkStage=-1;walkRepeat=false;autoStepPhase=0;kneesFirst=false;arrivalTiming=false;guard.fail();torque(owned,0);status(reason);for(int i=0;i<6;i++)if(owned&(1u<<i)){servo.Error=0;servo.Err=0;int v=servo.readByte(kAllIds[i],SCSCL_TORQUE_ENABLE);char s[110];snprintf(s,sizeof(s),"squat_release_%s_id_%u",v==0&&servo.Error==0&&servo.Err==0?"confirmed":"UNCONFIRMED_cut_external_power",kAllIds[i]);status(s);}reportState();}
bool verifyTorque(uint8_t mask,int expected){for(int i=0;i<6;i++)if(mask&(1u<<i)){servo.Error=0;servo.Err=0;int v=servo.readByte(kAllIds[i],SCSCL_TORQUE_ENABLE);if(v!=expected||servo.Error||servo.Err){char line[160];snprintf(line,sizeof(line),"squat_fault_torque_id_%u_expected_%d_actual_%d_error_%d_protocol_%d",kAllIds[i],expected,v,servo.Error,servo.Err);abortMotion(line);return false;}}return true;}
bool writeGoals(const MotionProfile::Pose& pose,uint8_t mask,int duration=1500){
 for(int i=0;i<6;i++)if(mask&(1u<<i))if(!MotionProfile::accepts(i,pose.raw[i])){abortMotion("squat_fault_target_limit");return false;}
 uint8_t ids[6],n=0;uint16_t values[6],times[6],speeds[6];
 for(int i=0;i<6;i++)if(mask&(1u<<i)){ids[n]=kAllIds[i];values[n]=pose.raw[i];times[n]=duration;speeds[n++]=40;}
 servo.SyncWritePos(ids,n,values,times,speeds);
 for(int i=0;i<6;i++)if(mask&(1u<<i)){
  const int addresses[]={SCSCL_GOAL_POSITION_L,SCSCL_GOAL_TIME_L,SCSCL_GOAL_SPEED_L};const int expected[]={pose.raw[i],duration,40};
  for(int j=0;j<3;j++){servo.Error=0;servo.Err=0;int v=servo.readWord(kAllIds[i],addresses[j]);if(v!=expected[j]||servo.Error||servo.Err){char line[180];snprintf(line,sizeof(line),"squat_fault_goal_id_%u_register_%d_requested_%d_actual_%d_error_%d_protocol_%d",kAllIds[i],addresses[j],expected[j],v,servo.Error,servo.Err);abortMotion(line);return false;}}
  char s[100];snprintf(s,sizeof(s),"motion_goal_id_%u_requested_%u",kAllIds[i],pose.raw[i]);status(s);
 }
 return true;
}
bool reached(uint8_t mask){for(int i=0;i<6;i++)if(mask&(1u<<i))if(!readings[i].found||!SquatGuard::withinTolerance(readings[i].pos,activeTarget.raw[i]))return false;return true;}
bool startPose(const MotionProfile::Pose& pose,uint8_t mask,bool ordered,bool down){
 // Validate ALL stages before first command in handleCommand; each pose is also validated here.
 for(int i=0;i<6;i++)if(mask&(1u<<i))if(!MotionProfile::accepts(i,pose.raw[i])){abortMotion("squat_fault_target_limit");return false;}
 owned|=mask;torque(owned,0);if(!verifyTorque(owned,0))return false;
 activeTarget=pose;motionMask=mask;phaseMask=ordered?(mask&kKnees):mask;kneesFirst=ordered;arrivalTiming=false;downResult=down;
 guard.state=down?SquatGuard::MovingDown:SquatGuard::MovingUp;
 if(!writeGoals(pose,phaseMask))return false;
 torque(phaseMask,1);
 if(!verifyTorque(phaseMask,1)||!verifyTorque(owned&~phaseMask,0))return false;
 status(ordered?"motion_phase_knees_first":"motion_phase_all");reportState();return true;
}
void holdCurrentPose(){
 walkStage=-1;walkRepeat=false;autoStepPhase=0;
 if(guard.state==SquatGuard::Fault){status("squat_hold_rejected_fault_reset_first");return;}
 MotionProfile::Pose pose=activeTarget;
 for(int i=0;i<6;i++)if(owned&(1u<<i)){servo.Error=0;servo.Err=0;if(servo.FeedBack(kAllIds[i])==-1||servo.Error||servo.Err){abortMotion("squat_fault_hold_capture");return;}int raw=servo.ReadPos(-1);if(!MotionProfile::accepts(i,raw)){abortMotion("squat_fault_hold_position_limit");return;}pose.raw[i]=raw;}
 if(!writeGoals(pose,owned,0))return;
 activeTarget=pose;torque(owned,1);if(!verifyTorque(owned,1))return;
 kneesFirst=false;arrivalTiming=false;guard.state=SquatGuard::Held;status("squat_operator_stop_holding_current_pose");reportState();
}
bool linkFresh(){return heartbeatSeen&&uint32_t(millis()-lastHeartbeatMs)<kLinkTimeoutMs;}
void checkMotionLink(){
 if((guard.moving()||walkStage>=0||autoStepPhase||walkRepeat)&&!linkFresh()){
  status("motion_link_timeout_holding_current_pose");holdCurrentPose();
 }
}
bool scan() {
  int found=0;
  for(int i=0;i<6;i++) {
    auto& r=readings[i];
    servo.Error=0; servo.Err=0;
    const uint32_t started=millis();
    const int feedbackResult=servo.FeedBack(kAllIds[i]);
    const uint32_t readMs=millis()-started;
    const int deviceError=servo.Error, protocolError=servo.Err;
    r.found=feedbackResult!=-1 && deviceError==0 && protocolError==0;
    int speedRaw=0,currentRegisterRaw=0;
    if(r.found) {
      r.pos=servo.ReadPos(-1); r.voltage=servo.ReadVoltage(-1);
      r.temp=servo.ReadTemper(-1); r.moving=servo.ReadMove(-1);
      r.output=servo.ReadLoad(-1); // Signed motor output indication, not measured torque.
      speedRaw=servo.ReadSpeed(-1);
      currentRegisterRaw=servo.ReadCurrent(-1); // Raw register only; model support/units unverified.
      r.found=r.pos>=0 && r.pos<=1023 && (r.moving==0 || r.moving==1);
    }
    if(r.found) {
      found++;
      Serial.printf("{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,\"name\":\"%s\",\"found\":true,\"position_raw\":%d,\"voltage_v\":%.1f,\"temperature_c\":%d,\"moving\":%d,\"speed_raw\":%d,\"output_raw\":%d,\"current_register_raw\":%d,\"feedback_result\":%d,\"servo_error\":%d,\"protocol_error\":%d,\"read_ms\":%lu}\n",(unsigned long)millis(),kAllIds[i],kNames[i],r.pos,r.voltage/10.0,r.temp,r.moving,speedRaw,r.output,currentRegisterRaw,feedbackResult,deviceError,protocolError,(unsigned long)readMs);
    } else {
      Serial.printf("{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,\"name\":\"%s\",\"found\":false,\"feedback_result\":%d,\"servo_error\":%d,\"protocol_error\":%d,\"read_ms\":%lu,\"invalid_feedback_values\":%s}\n",(unsigned long)millis(),kAllIds[i],kNames[i],feedbackResult,deviceError,protocolError,(unsigned long)readMs,feedbackResult!=-1 && deviceError==0 && protocolError==0?"true":"false");
    }
  }
  Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\",\"found_count\":%d,\"expected_count\":6}\n",(unsigned long)millis(),found==6?"all_expected_servos_found":"servo_scan_incomplete",found);
  return found==6;
}
void reportServoLimits() {
  status(kFirmwareVersion);
  for(uint8_t id:kAllIds) {
    const uint8_t addresses[]={3,9,11,16,24}; // model, limits and minimum startup force
    for(uint8_t address:addresses) {
      servo.Error=0;
      const int value=servo.readWord(id,address);
      char line[100];
      snprintf(line,sizeof(line),"squat_config_id_%u_register_%u_value_%d_error_%d",id,address,value,servo.Error);
      status(line);
    }
    const uint8_t byteAddresses[]={19,21,22,23,26,27,37,38,39};
    for(uint8_t address:byteAddresses) {
      servo.Error=0;
      const int value=servo.readByte(id,address);
      char line[100];
      snprintf(line,sizeof(line),"squat_config_id_%u_register_%u_value_%d_error_%d",id,address,value,servo.Error);
      status(line);
    }
  }
}
MotionProfile::Pose walkPose(int stage){return walkRight?MotionProfile::right(stage):MotionProfile::left(stage);}
int walkStageCount(){return walkRight?MotionProfile::RightStageCount:MotionProfile::LeftStageCount;}
uint8_t walkMask(int stage){return walkRight&&stage<2?uint8_t(kFull&~((1u<<1)|(1u<<2))):kFull;}
void reportWalkStage(){char line[60];snprintf(line,sizeof(line),"walk_%s_stage_%d",walkRight?"right":"left",walkStage+1);status(line);}
void handleCommand(String cmd){
 cmd.trim();
 if(cmd=="HEARTBEAT"){heartbeatSeen=true;lastHeartbeatMs=millis();return;}
 if(cmd=="STATUS"){reportServoLimits();reportState();return;}
 if(cmd=="SQUAT STOP"){holdCurrentPose();return;}
 if(cmd=="SQUAT RELEASE"){abortMotion("squat_operator_release");return;}
 if(cmd=="SQUAT RESET"){if(guard.state!=SquatGuard::Complete&&guard.state!=SquatGuard::Fault){status("squat_reset_rejected_state");return;}if(verifyTorque(owned,0)){guard.state=SquatGuard::Idle;reportState();}return;}
 if(guard.moving()||guard.state==SquatGuard::Fault||walkStage>=0||autoStepPhase){status("motion_rejected_state");return;}
 const bool motionCommand=cmd=="WALK AUTO"||cmd=="WALK LEFT"||cmd=="WALK RIGHT"||cmd=="STEP AUTO"||cmd=="STEP LEFT"||cmd=="STEP RIGHT"||cmd=="SQUAT UP"||cmd=="SQUAT DOWN";
 if(motionCommand&&!linkFresh()){status("motion_rejected_link_heartbeat_required");return;}
 if(cmd=="WALK AUTO"){
  for(int n=0;n<MotionProfile::LeftStageCount;n++)if(!MotionProfile::valid(MotionProfile::left(n),kFull)){status("walk_rejected_target_limit");return;}
  for(int n=0;n<MotionProfile::RightStageCount;n++)if(!MotionProfile::valid(MotionProfile::right(n),kFull)){status("walk_rejected_target_limit");return;}
  walkRepeat=true;walkRight=false;walkStage=0;status("walk_auto_started");reportWalkStage();startPose(walkPose(0),walkMask(0),true,false);return;
 }
 if(cmd=="WALK LEFT"||cmd=="WALK RIGHT"){
  walkRepeat=false;
  walkRight=cmd=="WALK RIGHT";
  for(int n=0;n<walkStageCount();n++)if(!MotionProfile::valid(walkPose(n),kFull)){status("walk_rejected_target_limit");return;}
  walkStage=0;reportWalkStage();startPose(walkPose(0),walkMask(0),true,false);return;
 }
 if(cmd=="STEP AUTO"){autoStepPhase=1;status("step_auto_phase_initial_stand");startPose(MotionProfile::standing(),owned,true,false);return;}
 if(cmd=="SQUAT UP"){startPose(MotionProfile::standing(),owned,true,false);return;}
 if(cmd=="SQUAT DOWN"){startPose(MotionProfile::squat(),kPlane,false,true);return;}
 if(cmd=="STEP LEFT"||cmd=="STEP RIGHT"){startPose(MotionProfile::lift(cmd=="STEP LEFT"),kPlane,false,false);return;}
 status("squat_command_rejected");
}
void readCommands(){for(int n=0;n<64&&Serial.available();n++){char c=Serial.read();if(c=='\n'||c=='\r'){if(overflow)status("squat_command_overflow_rejected");else if(commandLine.length())handleCommand(commandLine);commandLine="";overflow=false;}else if(commandLine.length()<40&&!overflow)commandLine+=c;else{commandLine="";overflow=true;}}}
void finishMotion(){
 for(int i=0;i<6;i++)if(phaseMask&(1u<<i)){char s[140];snprintf(s,sizeof(s),"motion_result_id_%u_target_%u_actual_%d_valid_%d",kAllIds[i],activeTarget.raw[i],readings[i].pos,readings[i].found?1:0);status(s);}
 torque(owned,0);if(!verifyTorque(owned,0))return;arrivalTiming=false;kneesFirst=false;guard.state=downResult?SquatGuard::Down:SquatGuard::Complete;status("squat_target_reached_released");reportState();
 if(walkStage>=0){
  if(++walkStage==walkStageCount()){
   status(walkRight?"walk_right_complete_released":"walk_left_complete_released");
   if(walkRepeat){walkRight=!walkRight;walkStage=0;reportWalkStage();startPose(walkPose(0),walkMask(0),true,false);}
   else walkStage=-1;
  }
  else{reportWalkStage();startPose(walkPose(walkStage),walkMask(walkStage),true,false);}
  return;
 }
 if(autoStepPhase){autoStepPhase++;if(autoStepPhase==6){autoStepPhase=0;status("step_auto_complete_released");}else if(autoStepPhase==2||autoStepPhase==4){status(autoStepPhase==2?"step_auto_phase_left_lift":"step_auto_phase_right_lift");startPose(MotionProfile::lift(autoStepPhase==2),kPlane,false,false);}else{status("step_auto_phase_return");startPose(MotionProfile::standing(),owned,true,false);}}
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
    lastImuGoodMs = 0;
    status("imu_reset_detected_reenabling_reports");
    if (!imu.enableReport(SH2_ARVR_STABILIZED_RV, kImuReportIntervalUs)) {
      imuReady = false;
      status("imu_report_reenable_failed");
      return;
    }
  }
  if (!imu.getSensorEvent(&imuEvent)) return;
  if (imuEvent.sensorId != SH2_ARVR_STABILIZED_RV) return;
  // Receiving a valid report refreshes the watchdog even when output is throttled.
  lastImuGoodMs = millis();
  if (millis() - lastImuOutputMs < kImuOutputIntervalMs) return;

  lastImuOutputMs = millis();
  const auto& rotation = imuEvent.un.arvrStabilizedRV;
  printImuTelemetry(robotFrameEuler({rotation.real, rotation.i, rotation.j, rotation.k}),
                    rotation.accuracy);
}

bool i2cAddressResponds(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void tryInitializeImu() {
  lastImuInitAttemptMs = millis();
  if (!i2cAddressResponds(kImuAddress)) {
    status("imu_bno085_address_0x4a_not_found_retrying");
    return;
  }
  if (!imu.begin_I2C(kImuAddress, &Wire)) {
    status("imu_bno085_initialization_failed_retrying");
    return;
  }
  if (!imu.enableReport(SH2_ARVR_STABILIZED_RV, kImuReportIntervalUs)) {
    status("imu_report_enable_failed_retrying");
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
} // namespace
void setup(){Serial.begin(115200);delay(300);Serial1.begin(1000000,SERIAL_8N1,D7,D6);servo.pSerial=&Serial1;servo.IOTimeOut=10;status("supported_squat_boot_no_motion");status(kFirmwareVersion);Wire.setTimeOut(20);setupImu();reportState();}
void loop(){checkMotionLink();readCommands();if(!imuReady&&millis()-lastImuInitAttemptMs>=2000&&!guard.moving())tryInitializeImu();serviceImu();checkMotionLink();
 if(millis()-lastScanMs>=100){lastScanMs=millis();scan();checkMotionLink();if(guard.moving()){
  bool healthy=true;for(int i=0;i<6;i++)if((owned&(1u<<i))&&!readings[i].found)healthy=false;
  if(!healthy){abortMotion("motion_fault_feedback");return;}
  if(!reached(phaseMask))arrivalTiming=false;
  else if(!arrivalTiming){arrivalTiming=true;arrivalSince=millis();}
  else if(uint32_t(millis()-arrivalSince)>=500){
   if(kneesFirst){const uint8_t rest=motionMask&~kKnees;if(writeGoals(activeTarget,rest)){torque(rest,1);if(verifyTorque(motionMask,1)&&verifyTorque(owned&~motionMask,0)){kneesFirst=false;phaseMask=motionMask;arrivalTiming=false;status("motion_phase_upper_and_yaw");}}}
   else finishMotion();
  }
 }}
 if(millis()-lastStateMs>=500){lastStateMs=millis();reportState();
  if(guard.moving())for(int i=0;i<6;i++)if(phaseMask&(1u<<i)){char line[210];snprintf(line,sizeof(line),"squat_output_id_%u_target_%u_actual_%d_output_raw_%d_valid_%d_voltage_raw_%d_temperature_%d",kAllIds[i],activeTarget.raw[i],readings[i].pos,readings[i].output,readings[i].found?1:0,readings[i].voltage,readings[i].temp);status(line);}
 }
}
