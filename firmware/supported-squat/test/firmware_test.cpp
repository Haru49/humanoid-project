// Execute the production firmware with a bus fake that can enable torque on goal writes.
#include "../src/main.cpp"
#include <cassert>
#include <cstdio>
void resetTest(){
 fakeNow=1000;servo=SCSCL();guard=SquatGuard();owned=kPlane;phaseMask=motionMask=0;kneesFirst=arrivalTiming=false;arrivalSince=0;walkStage=-1;autoStepPhase=0;downResult=false;walkRight=walkRepeat=false;activeTarget=MotionProfile::standing();
 imuReady=true;imu.events=true;imu.reset=false;lastImuGoodMs=1000;lastImuOutputMs=lastScanMs=lastStateMs=0;commandLine="";overflow=false;Serial.input.clear();Serial.output.clear();heartbeatSeen=false;lastHeartbeatMs=0;handleCommand("HEARTBEAT");
 for(int i=0;i<6;i++){servo.motors[kAllIds[i]].pos=MotionProfile::standing().raw[i];readings[i]=Reading();}
}
void tick(){fakeNow+=100;handleCommand("HEARTBEAT");loop();}
void atGoals(){for(auto id:kAllIds)if(servo.motors[id].torque)servo.motors[id].pos=servo.motors[id].goal;}
void complete(){for(int n=0;n<150&&guard.moving();n++){atGoals();tick();}assert(!guard.moving());}
void off(){for(int i=0;i<6;i++)if(owned&(1u<<i))assert(!servo.motors[kAllIds[i]].torque);}
void fault(){assert(guard.state==SquatGuard::Fault);off();assert(walkStage==-1&&autoStepPhase==0);}
void noYawGoals(){for(auto w:servo.writes)assert(w.address!=42||(w.id!=11&&w.id!=21));}
int main(){
 resetTest();setup();assert(servo.writes.empty());
 resetTest();handleCommand("STATUS");assert(servo.writes.empty());assert(Serial.output.find(kFirmwareVersion)!=std::string::npos);
 // Each plane operation works from boot; no preparation or starting-pose gate.
 for(const char* cmd:{"SQUAT DOWN","SQUAT UP","STEP LEFT","STEP RIGHT","STEP AUTO"}){
  resetTest();servo.motors[13].pos=200;imuReady=false;imu.events=false;
  handleCommand(cmd);assert(guard.moving());auto size=servo.writes.size();handleCommand("SQUAT UP");assert(servo.writes.size()==size);
  complete();off();noYawGoals();handleCommand("SQUAT UP");complete();off();
 }
 // Both knees must reach before any upper goal is written, even if writing a goal enables torque.
 resetTest();for(int i=0;i<6;i++)servo.motors[kAllIds[i]].pos=MotionProfile::squat().raw[i];
 handleCommand("SQUAT UP");assert(kneesFirst);
 for(auto w:servo.writes)assert(w.address!=42||(w.id==13||w.id==23));
 servo.motors[13].pos=312;for(int n=0;n<10;n++)tick();assert(kneesFirst&&servo.motors[12].torque==0);
 servo.motors[23].pos=153;for(int n=0;n<7;n++)tick();assert(!kneesFirst&&servo.motors[12].goal==597&&servo.motors[22].goal==886);complete();off();
 // Dwell restarts on exit; movement flags are not required. No time cutoff.
 resetTest();handleCommand("SQUAT DOWN");fakeNow+=10000;handleCommand("HEARTBEAT");loop();assert(guard.moving());atGoals();servo.motors[12].pos=744-18;tick();assert(!arrivalTiming);
 servo.motors[12].pos=744-17;tick();assert(arrivalTiming);for(int n=0;n<3;n++)tick();assert(guard.moving());servo.motors[12].pos=744-18;tick();assert(!arrivalTiming);complete();assert(guard.state==SquatGuard::Down);off();
 // Complete left plan is knee-first in all five stages; the last observed pose stays in place.
 resetTest();handleCommand("WALK LEFT");assert(owned==kFull&&walkStage==0);
 for(int stage=0;stage<MotionProfile::LeftStageCount;stage++){
  assert(walkStage==stage&&kneesFirst);int firstUpper=-1,firstKnee=-1;
  auto begin=servo.writes.size();
  for(int n=0;n<50&&walkStage==stage&&guard.moving();n++){atGoals();tick();}
  for(size_t i=begin;i<servo.writes.size();i++)if(servo.writes[i].address==42){if(servo.writes[i].id==12&&firstUpper<0)firstUpper=int(i);if(servo.writes[i].id==13&&firstKnee<0)firstKnee=int(i);}
  // The phase's knees were sent before 'begin'; a subsequent stage may also write knees.
  assert(firstUpper>=0);if(firstKnee>=0)assert(firstUpper<firstKnee);
 }
 assert(walkStage==-1&&guard.state==SquatGuard::Complete);off();
 for(int i=0;i<6;i++)assert(servo.motors[kAllIds[i]].pos==MotionProfile::left(4).raw[i]);
 auto size=servo.writes.size();for(int n=0;n<20;n++)tick();assert(servo.writes.size()==size);
 handleCommand("SQUAT UP");complete();for(int i=0;i<6;i++)assert(servo.motors[kAllIds[i]].pos==MotionProfile::standing().raw[i]);off();
 // STOP captures freshly read coordinates, holds all six after a yaw sequence, and cancels continuation.
 resetTest();handleCommand("WALK LEFT");atGoals();handleCommand("SQUAT STOP");assert(guard.state==SquatGuard::Held&&walkStage==-1);
 for(auto id:kAllIds){assert(servo.motors[id].goal==servo.motors[id].pos);assert(servo.motors[id].torque==1);assert(servo.motors[id].time==0);}
 size=servo.writes.size();for(int n=0;n<20;n++)tick();assert(servo.writes.size()==size);handleCommand("SQUAT UP");complete();off();
 resetTest();handleCommand("STEP AUTO");handleCommand("SQUAT STOP");assert(autoStepPhase==0&&guard.state==SquatGuard::Held);noYawGoals();handleCommand("SQUAT DOWN");complete();
 // Bad targets/readbacks and partial failures release all axes, including yaw.
 resetTest();auto invalid=MotionProfile::standing();invalid.raw[2]=0;assert(!writeGoals(invalid,kFull));fault();for(auto w:servo.writes)assert(w.address!=42);
 for(int id:{11,12,13,21,22,23}){
  resetTest();servo.badGoalId=id;handleCommand("WALK LEFT");complete();fault();
  resetTest();servo.badTorqueOnId=id;handleCommand("WALK LEFT");complete();fault();
  resetTest();handleCommand("WALK LEFT");servo.motors[id].online=false;tick();fault();
 }
 resetTest();handleCommand("WALK LEFT");servo.dropOff=true;handleCommand("SQUAT RELEASE");assert(guard.state==SquatGuard::Fault);assert(Serial.output.find("UNCONFIRMED_cut_external_power")!=std::string::npos);
 servo.dropOff=false;handleCommand("SQUAT RELEASE");fault();handleCommand("SQUAT RESET");assert(guard.state==SquatGuard::Idle);handleCommand("SQUAT DOWN");complete();off();
 // Cancel the automatic plan at every stage, including during upper/yaw motion.
 for(int stopStage=0;stopStage<MotionProfile::LeftStageCount;stopStage++)for(bool upper:{false,true}){
  resetTest();handleCommand("WALK LEFT");
  for(int n=0;n<120&&walkStage<stopStage;n++){atGoals();tick();}
  assert(walkStage==stopStage);
  if(upper){for(int n=0;n<20&&kneesFirst;n++){atGoals();tick();}assert(!kneesFirst);}
  handleCommand("SQUAT STOP");assert(guard.state==SquatGuard::Held&&walkStage==-1);
  auto writes=servo.writes.size();for(int n=0;n<20;n++)tick();assert(servo.writes.size()==writes);
 }
 // 500ms dwell remains correct when millis wraps; scan throttling also wraps.
 resetTest();fakeNow=UINT32_MAX-300;handleCommand("HEARTBEAT");handleCommand("SQUAT DOWN");complete();assert(guard.state==SquatGuard::Down);off();
 resetTest();handleCommand("SQUAT DOWN");complete();
 // Support pair remains untouched through BOTH right stages 1 and 2.
 resetTest();servo.motors[12].pos=600;servo.motors[13].pos=350;handleCommand("WALK RIGHT");
 assert(phaseMask==(1u<<5));
 for(int n=0;n<100&&walkStage<2;n++){atGoals();tick();}
 assert(walkStage==2&&servo.motors[13].pos==350&&servo.motors[12].pos==600);
 // Stage 3 starts with the measured stable knee target, never the old 346.
 bool stage3=false;
 for(auto w:servo.writes){
  if(w.address==42&&w.id==13){assert(w.value==331);stage3=true;}
  if(!stage3)assert(!((w.id==12||w.id==13)&&((w.address==42)||(w.address==40&&w.value==1))));
 }
 assert(stage3);
 // Right step uses its own five-pose trial plan and preserves the left plan.
 resetTest();handleCommand("WALK RIGHT");assert(walkRight&&owned==kFull);
 auto writes=servo.writes.size();handleCommand("WALK LEFT");assert(servo.writes.size()==writes&&walkRight);
 for(int stage=0;stage<MotionProfile::RightStageCount;stage++){
  assert(walkStage==stage&&kneesFirst);
  for(int i=0;i<6;i++)assert(activeTarget.raw[i]==MotionProfile::right(stage).raw[i]);
  for(int n=0;n<50&&walkStage==stage&&guard.moving();n++){atGoals();tick();}
 }
 assert(guard.state==SquatGuard::Complete&&walkStage==-1);off();
 assert(Serial.output.find("walk_right_complete_released")!=std::string::npos);
 for(int i=0;i<6;i++)assert(servo.motors[kAllIds[i]].pos==MotionProfile::standing().raw[i]);
 for(int stage=0;stage<5;stage++){
  resetTest();handleCommand("WALK RIGHT");
  for(int n=0;n<150&&walkStage<stage;n++){atGoals();tick();}
  assert(walkStage==stage);handleCommand("SQUAT STOP");assert(walkStage==-1&&guard.state==SquatGuard::Held);
  writes=servo.writes.size();for(int n=0;n<20;n++)tick();assert(servo.writes.size()==writes);
 }
 for(int id:{11,12,13,21,22,23}){
  resetTest();servo.badGoalId=id;handleCommand("WALK RIGHT");complete();fault();
 }
 resetTest();handleCommand("SQUAT DOWN");complete();
 // Continuous walking alternates completed five-stage plans, never overlaps them.
 resetTest();handleCommand("WALK AUTO");assert(walkRepeat&&!walkRight&&walkStage==0);
 for(int step=0;step<4;step++){
  assert(walkRight==bool(step%2));
  const bool side=walkRight;
  for(int n=0;n<150&&walkRight==side;n++){atGoals();tick();}
  assert(walkRepeat&&walkRight!=side&&walkStage==0&&guard.moving());
 }
 handleCommand("SQUAT STOP");assert(!walkRepeat&&walkStage==-1&&guard.state==SquatGuard::Held);
 writes=servo.writes.size();for(int n=0;n<20;n++)tick();assert(servo.writes.size()==writes);
 resetTest();handleCommand("WALK AUTO");handleCommand("SQUAT RELEASE");fault();assert(!walkRepeat);
 resetTest();handleCommand("WALK AUTO");servo.badGoalId=22;complete();fault();assert(!walkRepeat);
 resetTest();handleCommand("WALK LEFT");complete();assert(!walkRepeat&&walkStage==-1);
 // IMU and rich servo output continue after completion.
 Serial.output.clear();for(int n=0;n<10;n++)tick();assert(Serial.output.find("imu_telemetry")!=std::string::npos);assert(Serial.output.find("output_raw")!=std::string::npos);
 // Motion requires a fresh heartbeat; read-only STATUS and RELEASE remain available.
 resetTest();heartbeatSeen=false;handleCommand("WALK AUTO");assert(servo.writes.empty()&&!guard.moving());
 assert(Serial.output.find("motion_rejected_link_heartbeat_required")!=std::string::npos);
 handleCommand("STATUS");assert(servo.writes.empty());handleCommand("HEARTBEAT");assert(servo.writes.empty());
 // USB loss, silent collector failure and a stalled target all stop every active plan.
 for(const char* cmd:{"WALK AUTO","WALK LEFT","WALK RIGHT","STEP AUTO","STEP LEFT","STEP RIGHT","SQUAT DOWN","SQUAT UP"}){
  resetTest();handleCommand(cmd);assert(guard.moving());
  lastHeartbeatMs=millis();fakeNow=lastHeartbeatMs+kLinkTimeoutMs-100;loop();assert(guard.moving());
  fakeNow=lastHeartbeatMs+kLinkTimeoutMs;loop();assert(guard.state==SquatGuard::Held&&!walkRepeat&&walkStage==-1&&autoStepPhase==0);
  for(int i=0;i<6;i++)if(owned&(1u<<i)){assert(servo.motors[kAllIds[i]].goal==servo.motors[kAllIds[i]].pos);assert(servo.motors[kAllIds[i]].torque==1);}
  auto count=servo.writes.size();handleCommand("HEARTBEAT");for(int n=0;n<50;n++)tick();assert(servo.writes.size()==count);
  handleCommand("SQUAT UP");assert(guard.moving());complete();off();
 }
 // Heartbeat at an already expired link cannot continue the old plan.
 resetTest();handleCommand("WALK AUTO");fakeNow=lastHeartbeatMs+kLinkTimeoutMs;
 for(char c:std::string("HEARTBEAT\n"))Serial.input.push_back(c);
 loop();assert(guard.state==SquatGuard::Held&&!walkRepeat);
 // HOLD failures use the existing release/fault path; no restart on heartbeat.
 resetTest();handleCommand("WALK AUTO");servo.motors[13].online=false;fakeNow=lastHeartbeatMs+kLinkTimeoutMs;loop();fault();
 resetTest();handleCommand("WALK AUTO");servo.motors[13].pos=0;fakeNow=lastHeartbeatMs+kLinkTimeoutMs;loop();fault();
 // Read-only traffic and malformed heartbeat suffixes do not renew the lease.
 resetTest();handleCommand("WALK AUTO");fakeNow=lastHeartbeatMs+kLinkTimeoutMs;handleCommand("STATUS");loop();assert(guard.state==SquatGuard::Held);
 resetTest();handleCommand("WALK AUTO");auto hb=lastHeartbeatMs;
 for(char c:std::string(41,'x')+"HEARTBEAT\r\n")Serial.input.push_back(c);
 readCommands();assert(lastHeartbeatMs==hb&&Serial.output.find("squat_command_overflow_rejected")!=std::string::npos);
 // An overlong line cannot execute its trailing STOP, and the next line recovers.
 resetTest();handleCommand("WALK AUTO");auto count=servo.writes.size();
 for(char c:std::string(41,'x')+"SQUAT STOP\n")Serial.input.push_back(c);
 readCommands();assert(servo.writes.size()==count&&guard.moving());
 for(char c:std::string("SQUAT STOP\n"))Serial.input.push_back(c);
 readCommands();assert(guard.state==SquatGuard::Held);
 // Lease arithmetic remains correct across millis() wrap.
 resetTest();fakeNow=UINT32_MAX-1000;handleCommand("HEARTBEAT");handleCommand("WALK AUTO");
 fakeNow=uint32_t(lastHeartbeatMs+kLinkTimeoutMs);loop();assert(guard.state==SquatGuard::Held);
 puts("Firmware integration: new targets, knee ordering, 5-stage left plan, dwell, STOP, failures, repeat and telemetry passed");
}
