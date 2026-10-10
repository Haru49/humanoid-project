#include "../src/LeftForwardPlan.h"
#include <cassert>
int main(){
 LeftForwardPlan::Pose poses[5];const int expected[5][6]={{944,673,380,470,947,198},{952,669,273,471,964,181},{950,588,340,471,908,156},{807,594,309,411,962,198},{816,594,327,385,902,157}};
 for(int n=0;n<5;n++){poses[n]=LeftForwardPlan::observed(n);for(int i=0;i<6;i++)assert(poses[n].raw[i]==expected[n][i]);}
 int stage,axis;assert(LeftForwardPlan::targetsValid(poses,stage,axis));
 poses[4].raw[5]=911;assert(!LeftForwardPlan::targetsValid(poses,stage,axis));assert(stage==4&&axis==5);poses[4]=LeftForwardPlan::observed(4);
 poses[2].raw[2]=644;assert(!LeftForwardPlan::targetsValid(poses,stage,axis));assert(stage==2&&axis==2);
 poses[2]=LeftForwardPlan::observed(2);poses[1].raw[0]=1000;assert(!LeftForwardPlan::targetsValid(poses,stage,axis));assert(stage==1&&axis==0);
}
