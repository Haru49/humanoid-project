#pragma once
#include <stdint.h>
#include "PlanarLimits.h"

// Supported single-cycle walking. Foot targets must be measured on this robot;
// this class neither invents targets nor writes motors. Arrival is joint-space
// feedback, not a contact measurement. Physical support remains operator-owned.
struct SupportedWalk {
  enum Phase {
    Stand, RightLift, RightForward, RightLand, TransferToRight,
    LeftLift, LeftForward, LeftLand, Finish, PhaseCount
  };
  struct Pose { uint16_t raw[4]; };
  Pose poses[PhaseCount];
  Phase phase=Stand;
  bool configured=false, running=false, arrivalTiming=false;
  uint32_t arrivalSince=0;

  bool configure(const Pose* measured) {
    if(running || !measured) return false;
    const int ids[]={12,13,22,23};
    // Atomic validation: no partially updated plan after an invalid pose.
    for(int p=0;p<PhaseCount;p++)
      for(int axis=0;axis<4;axis++)
        if(!PlanarLimits::accepts(ids[axis],measured[p].raw[axis])) return false;
    for(int p=0;p<PhaseCount;p++) poses[p]=measured[p];
    configured=true;
    return true;
  }
  bool begin() {
    if(!configured || running) return false;
    phase=Stand; running=true; arrivalTiming=false;
    return true;
  }
  const Pose* target() const { return running?&poses[phase]:nullptr; }
  // Returns true only at a phase boundary. The caller must send and verify
  // the next target; failed writes call cancel(). Finish requests final release.
  bool observe(bool jointsWithinTolerance, uint32_t now) {
    if(!running) return false;
    if(!jointsWithinTolerance) { arrivalTiming=false; return false; }
    if(!arrivalTiming) { arrivalTiming=true; arrivalSince=now; return false; }
    if(uint32_t(now-arrivalSince)<500) return false;
    arrivalTiming=false;
    if(phase==Finish) running=false;
    else phase=static_cast<Phase>(int(phase)+1);
    return true;
  }
  void cancel() { running=false; arrivalTiming=false; }
};
