/** USB write/drain is bounded; a dead link must not hang shutdown. */
export interface SafetyPort {
  isOpen: boolean;
  write(data: string, callback: (error?: Error | null) => void): unknown;
  drain(callback: (error?: Error | null) => void): unknown;
}

export function writeAndDrain(port: SafetyPort, command: string, timeoutMs=1000): Promise<void> {
  return new Promise((resolve,reject)=>{
    let finished=false;
    const finish=(error?: Error|null)=>{
      if(finished)return;
      finished=true;clearTimeout(timer);
      if(error)reject(error);else resolve();
    };
    const timer=setTimeout(()=>finish(new Error(`${command}: serial write/drain timeout`)),timeoutMs);
    try {
      if(!port.isOpen){finish(new Error('Serial port closed'));return;}
      port.write(command+'\n',error=>{
        if(finished)return;
        if(error){finish(error);return;}
        try{port.drain(finish);}catch(error){finish(error as Error);}
      });
    } catch(error){finish(error as Error);}
  });
}

/** Keep multi-stage plans pending across their transient complete reports. */
export function createMotionTracker() {
  let requested=false,plan='';
  return {
    sent(command: string) {
      if(/^(WALK|STEP) (AUTO|LEFT|RIGHT)$/.test(command)||/^SQUAT (DOWN|UP)$/.test(command)){
        requested=true;plan=command;
      }
      // STOP/RELEASE transmission alone does not establish device confirmation.
    },
    status(value: string) {
      if(['squat_state_held','squat_state_fault'].includes(value)){requested=false;plan='';}
      else if((plan==='WALK LEFT'&&value==='walk_left_complete_released')||
        (plan==='WALK RIGHT'&&value==='walk_right_complete_released')||
        (plan==='STEP AUTO'&&value==='step_auto_complete_released')||
        (/^(SQUAT (UP|DOWN)|STEP (LEFT|RIGHT))$/.test(plan)&&value==='squat_target_reached_released')){requested=false;plan='';}
      else if(!plan&&['squat_state_idle','squat_state_complete','squat_state_down'].includes(value))requested=false;
      else if(['squat_state_moving_down','squat_state_moving_up'].includes(value))requested=true;
    },
    needsStop(){return requested;},
    reset(){requested=false;plan='';},
  };
}
