#pragma once
#include "MotionProfile.h"
// The only active left-forward calibration is the post-reindex measurement.
struct LeftForwardPlan {
 enum {AxisCount=6,StageCount=MotionProfile::LeftStageCount};
 typedef MotionProfile::Pose Pose;
 static uint8_t id(int axis){const uint8_t ids[]={11,12,13,21,22,23};return axis>=0&&axis<6?ids[axis]:0;}
 static Pose observed(int stage){return MotionProfile::left(stage);}
 static bool targetsValid(const Pose* poses,int& badStage,int& badAxis){
  badStage=badAxis=-1;if(!poses)return false;
  for(int stage=0;stage<StageCount;stage++)for(int axis=0;axis<6;axis++)if(!MotionProfile::accepts(axis,poses[stage].raw[axis])){badStage=stage;badAxis=axis;return false;}
  return true;
 }
};
