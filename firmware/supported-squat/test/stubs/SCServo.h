#pragma once
#include "Arduino.h"
#include <cassert>
#include <vector>
constexpr int SCSCL_TORQUE_ENABLE=40,SCSCL_GOAL_POSITION_L=42,SCSCL_GOAL_TIME_L=44,SCSCL_GOAL_SPEED_L=46;
struct SCSCL {
 FakeSerial* pSerial=nullptr;int IOTimeOut=10,Error=0,Err=0,selected=0;
 struct Motor {int pos=0,goal=700,time=1500,speed=40,torque=0,moving=0,voltage=60,temp=20,output=0;bool online=true;};
 Motor motors[24];
 int badGoalId=-1,badTorqueOnId=-1,failReadId=-1,dropGoalId=-1;
 bool dropOff=false; bool clamp13=true; bool goalEnablesTorque=true; uint32_t operationMs=1;
 struct Write {int id,address,value;};std::vector<Write> writes;
 void tick(){fakeNow+=operationMs;Error=0;}
 int FeedBack(int id){tick();selected=id;return motors[id].online?1:-1;}
 int Ping(int id){tick();return motors[id].online?1:-1;}
 int WritePos(int id,uint16_t pos,uint16_t time,uint16_t speed){uint8_t ids[]={uint8_t(id)};SyncWritePos(ids,1,&pos,&time,&speed);return 1;}
 int ReadPos(int){return motors[selected].pos;} int ReadVoltage(int){return motors[selected].voltage;}
 int ReadTemper(int){return motors[selected].temp;} int ReadMove(int){return motors[selected].moving;}
 int ReadLoad(int){return motors[selected].output;}
 int ReadSpeed(int){return motors[selected].moving?40:0;}
 int ReadCurrent(int){return 0;}
 int readByte(int id,int){tick();return id==failReadId?-1:motors[id].torque;}
 int readWord(int id,int addr){tick();if(id==failReadId)return -1;auto& m=motors[id];if(addr==42)return id==badGoalId?333:m.goal;if(addr==44)return m.time;return m.speed;}
 void syncWrite(uint8_t* ids,int n,int addr,uint8_t* data,int){for(int i=0;i<n;i++){int id=ids[i];writes.push_back({id,addr,data[i]});if(!(data[i]&&id==badTorqueOnId)&&!(dropOff&&!data[i]))motors[id].torque=data[i];if(data[i])motors[id].moving=1;}}
 void SyncWritePos(uint8_t* ids,int n,uint16_t* pos,uint16_t* time,uint16_t* speed){for(int i=0;i<n;i++){int id=ids[i];writes.push_back({id,42,pos[i]});if(id==dropGoalId)continue;motors[id].goal=clamp13&&id==13&&pos[i]==0?20:pos[i];motors[id].time=time[i];motors[id].speed=speed[i];if(goalEnablesTorque&&id!=badTorqueOnId)motors[id].torque=1;}}
};
