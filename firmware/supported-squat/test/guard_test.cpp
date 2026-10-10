#include "../src/SquatGuard.h"
#include "../src/PlanarLimits.h"
#include <cassert>
#include <cstdio>
int main(){
 const int ids[]={12,13,22,23},lo[]={367,119,666,20},hi[]={771,594,1002,378};
 for(int i=0;i<4;i++){assert(PlanarLimits::accepts(ids[i],lo[i]));assert(PlanarLimits::accepts(ids[i],hi[i]));assert(!PlanarLimits::accepts(ids[i],lo[i]-1));assert(!PlanarLimits::accepts(ids[i],hi[i]+1));}
 assert(!PlanarLimits::accepts(11,813));assert(!PlanarLimits::accepts(13,0));assert(!PlanarLimits::accepts(13,644));
 assert(SquatGuard::withinTolerance(295,312));assert(SquatGuard::withinTolerance(329,312));assert(!SquatGuard::withinTolerance(294,312));assert(!SquatGuard::withinTolerance(330,312));assert(!SquatGuard::withinTolerance(-1,312));assert(!SquatGuard::withinTolerance(1023,0));
 puts("Bounds and linear arrival tolerance passed");
}
