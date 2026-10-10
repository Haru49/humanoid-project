#pragma once
#include "MotionProfile.h"
struct PlanarLimits {
 static bool accepts(int id,int raw){switch(id){case 12:return MotionProfile::accepts(1,raw);case 13:return MotionProfile::accepts(2,raw);case 22:return MotionProfile::accepts(4,raw);case 23:return MotionProfile::accepts(5,raw);default:return false;}}
};
