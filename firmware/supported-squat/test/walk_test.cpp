#include "../src/SupportedWalk.h"
#include <cassert>
#include <cstdio>
int main() {
  SupportedWalk walk;
  assert(!walk.begin() && !walk.target());
  SupportedWalk::Pose poses[SupportedWalk::PhaseCount];
  // Synthetic fixtures test control logic; these are not walking coordinates.
  for(auto& pose:poses) pose={{597,312,894,153}};
  poses[3].raw[2]=1023;
  assert(!walk.configure(poses) && !walk.configured);
  poses[3].raw[2]=894;
  assert(walk.configure(poses) && walk.begin());
  assert(!walk.begin() && !walk.configure(poses));
  uint32_t now=0xfffffff0u;
  for(int phase=0;phase<SupportedWalk::PhaseCount;phase++) {
    assert(int(walk.phase)==phase && walk.target());
    assert(!walk.observe(true,now));
    assert(!walk.observe(true,now+499));
    assert(!walk.observe(false,now+500));
    assert(!walk.observe(true,now+600));
    assert(walk.observe(true,now+1100));
    now+=1200;
  }
  assert(!walk.running && !walk.target() && !walk.observe(true,now+10000));
  for(int stopPhase=0;stopPhase<SupportedWalk::PhaseCount;stopPhase++) {
    assert(walk.begin());
    for(int phase=0;phase<stopPhase;phase++) {
      assert(!walk.observe(true,now));
      assert(walk.observe(true,now+500)); now+=600;
    }
    walk.cancel();
    assert(!walk.target() && !walk.observe(true,now+10000));
  }
  puts("SupportedWalk: missing/invalid plan, ordered phases, dwell reset, clock rollover, cancellation and single cycle passed");
}
