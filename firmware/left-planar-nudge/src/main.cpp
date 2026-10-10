#error "Retired: pre-remount ID13 targets. Use supported-squat; see ADR 0014."
#include <Arduino.h>
#include <SCServo.h>
namespace {
constexpr uint8_t kIds[] = {12,13}; constexpr uint16_t kNeutral[] = {595,0}; constexpr uint16_t kA[] = {692,114};
constexpr uint32_t kTelemetryMs=2000; SCSCL servo; bool armed=false; String line; bool overflow=false; uint32_t last=0;
struct Def{uint8_t id;const char* name;}; constexpr Def kAll[]={{11,"LEFT_YAW"},{12,"LEFT_PLANAR_UPPER"},{13,"LEFT_PLANAR_KNEE"},{21,"RIGHT_YAW"},{22,"RIGHT_PLANAR_UPPER"},{23,"RIGHT_PLANAR_KNEE"}};
void st(const char*s){Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\"}\n",(unsigned long)millis(),s);} bool one(const Def&d){if(servo.Ping(d.id)==-1||servo.FeedBack(d.id)==-1){Serial.printf("{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,\"name\":\"%s\",\"found\":false}\n",(unsigned long)millis(),d.id,d.name);return false;}Serial.printf("{\"type\":\"servo_telemetry\",\"ms\":%lu,\"id\":%u,\"name\":\"%s\",\"found\":true,\"position_raw\":%d,\"voltage_v\":%.1f,\"temperature_c\":%d,\"moving\":%d}\n",(unsigned long)millis(),d.id,d.name,servo.ReadPos(-1),servo.ReadVoltage(-1)/10.f,servo.ReadTemper(-1),servo.ReadMove(-1));return true;}void all(){int n=0;for(auto&d:kAll)if(one(d))++n;Serial.printf("{\"type\":\"status\",\"ms\":%lu,\"status\":\"%s\",\"found_count\":%d,\"expected_count\":6}\n",(unsigned long)millis(),n==6?"all_expected_servos_found":"servo_scan_incomplete",n);}
void move(const uint16_t*p,const char*l){if(!armed){st("motion_rejected_not_armed");return;}uint16_t t[]={1500,1500},s[]={40,40};servo.SyncWritePos((uint8_t*)kIds,2,(uint16_t*)p,t,s);armed=false;Serial.printf("{\"type\":\"motion_command\",\"ms\":%lu,\"ids\":[12,13],\"targets\":[%u,%u],\"duration_ms\":1500,\"label\":\"%s\"}\n",(unsigned long)millis(),p[0],p[1],l);st("motion_command_sent_disarmed");}
void cmd(String c){c.trim();if(c=="STATUS"){all();st("left_planar_nudge_ready");}else if(c=="ARM LEFT_PAIR"){armed=true;st("motion_armed_left_pair_one_command_only");}else if(c=="MOVE A")move(kA,"a_25_percent");else if(c=="MOVE NEUTRAL")move(kNeutral,"neutral");else if(c=="DISARM"){armed=false;st("motion_disarmed");}else st("motion_command_rejected");}
void input(){
 while(Serial.available()){
  char c=Serial.read();
  if(c=='\n'||c=='\r'){
   if(overflow){armed=false;st("motion_command_overflow_rejected");}
   else if(line.length())cmd(line);
   line="";overflow=false;
  }else if(!overflow&&line.length()<40)line+=c;
  else{line="";overflow=true;}
 }
}
}void setup(){Serial.begin(115200);delay(1500);Serial1.begin(1000000,SERIAL_8N1,D7,D6);servo.pSerial=&Serial1;st("left_planar_nudge_armed_no_motion_until_command");}void loop(){input();if(millis()-last>=kTelemetryMs){last=millis();all();st("left_planar_nudge_ready");}}
