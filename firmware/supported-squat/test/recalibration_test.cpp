#include "../src/MotionProfile.h"
#include <cassert>
int main(){
 const int standing[]={813,597,312,389,886,153};const int squat[]={813,744,462,389,1000,277};
 for(int i=0;i<6;i++){assert(MotionProfile::standing().raw[i]==standing[i]);assert(MotionProfile::squat().raw[i]==squat[i]);}
 assert(MotionProfile::valid(MotionProfile::standing(),63));assert(MotionProfile::valid(MotionProfile::squat(),63));
 assert(MotionProfile::valid(MotionProfile::lift(true),63));assert(MotionProfile::valid(MotionProfile::lift(false),63));
}
