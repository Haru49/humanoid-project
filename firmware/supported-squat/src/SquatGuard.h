#pragma once
#include <stdint.h>
// Stable state IDs match the telemetry contract. Armed slots are retired.
struct SquatGuard {
 enum State {Idle,ArmedDown,MovingDown,Down,ArmedUp,MovingUp,Complete,Fault,Held};
 State state=Idle;
 static bool withinTolerance(int actual,int target,int tolerance=17){
  return actual>=0&&actual<=1023&&target>=0&&target<=1023&&tolerance>=0&&actual-target>=-tolerance&&actual-target<=tolerance;
 }
 bool moving() const{return state==MovingDown||state==MovingUp;}
 void fail(){state=Fault;}
};
