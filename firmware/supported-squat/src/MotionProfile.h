#pragma once
#include <stdint.h>
struct MotionProfile {
 struct Pose {uint16_t raw[6];};
 enum {LeftStageCount=5,RightStageCount=5};
 // Measured boundary points are not targets. Use 10 raw inside planar extremes;
 // omit the right knee's unverified wraparound region entirely.
 // Yaw bounds are a trial envelope around observed poses, NOT measured stops.
 static bool accepts(int axis,int raw){
  const int lo[]={699,367,119,260,666,20};
  const int hi[]={962,771,594,481,1002,378};
  return axis>=0&&axis<6&&raw>=lo[axis]&&raw<=hi[axis];
 }
 static bool valid(const Pose& p,uint8_t mask){for(int i=0;i<6;i++)if((mask&(1u<<i))&&!accepts(i,p.raw[i]))return false;return true;}
 static Pose standing(){return {{813,597,312,389,886,153}};}
 // Observed ID22=1022 exceeds previous accepted servo goals. Command 1000,
 // rather than silently accepting arbitrary clamped readbacks.
 static Pose squat(){return {{813,744,462,389,1000,277}};}
 // Lift candidates retained; standing/support ID22 has -8 raw trial compensation.
 static Pose lift(bool leftLeg){return leftLeg?Pose{{813,671,387,389,886,153}}:Pose{{813,597,312,389,947,215}};}
 static Pose left(int n){const Pose poses[]={{{944,673,380,470,947,198}},{{952,669,273,471,964,181}},{{950,588,340,471,908,156}},{{807,594,309,411,962,198}},{{816,594,327,385,902,157}}};return n>=0&&n<LeftStageCount?poses[n]:standing();}
 // Trial intermediates: paired squat displacement ratios, not raw axis swapping.
 // Stage 3 is the operator-measured right-forward stable pose. Stage 5 uses
 // the calibrated standing command; other right stages remain unverified.
 static Pose right(int n){
  const Pose poses[]={
   {{710,597,312,275,949,209}},
   {{709,597,312,270,946,121}},
   {{709,588,331,270,910,155}},
   {{785,665,357,394,892,151}},
   standing()
  };
  return n>=0&&n<RightStageCount?poses[n]:standing();
 }
};
