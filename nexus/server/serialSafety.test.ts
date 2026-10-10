import {describe,it,expect,vi,afterEach} from 'vitest';
import {createMotionTracker,writeAndDrain} from './serialSafety';
import type {SafetyPort} from './serialSafety';

afterEach(()=>vi.useRealTimers());
describe('serial shutdown safety',()=>{
  it('waits for write and drain, preserves the complete STOP line',async()=>{
    let written: ((error?: Error|null)=>void)|undefined,drained: ((error?: Error|null)=>void)|undefined;
    const port: SafetyPort={isOpen:true,write:vi.fn((_data,cb)=>{written=cb;}),drain:vi.fn(cb=>{drained=cb;})};
    let finished=false;const pending=writeAndDrain(port,'SQUAT STOP').then(()=>{finished=true;});
    expect(port.write).toHaveBeenCalledWith('SQUAT STOP\n',expect.any(Function));expect(port.drain).not.toHaveBeenCalled();
    written!();await Promise.resolve();expect(finished).toBe(false);
    drained!();await pending;expect(finished).toBe(true);
  });
  it('bounds unresponsive writes and ignores late callbacks',async()=>{
    vi.useFakeTimers();let written: ((error?: Error|null)=>void)|undefined;
    const port: SafetyPort={isOpen:true,write:vi.fn((_data,cb)=>{written=cb;}),drain:vi.fn()};
    const pending=expect(writeAndDrain(port,'SQUAT STOP')).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(1000);await pending;
    written!();expect(port.drain).not.toHaveBeenCalled();
  });
  it('bounds drain and rejects closed ports and write failures',async()=>{
    vi.useFakeTimers();
    const port: SafetyPort={isOpen:true,write:(_data,cb)=>cb(),drain:vi.fn()};
    const pending=expect(writeAndDrain(port,'SQUAT STOP')).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(1000);await pending;
    port.isOpen=false;await expect(writeAndDrain(port,'SQUAT STOP')).rejects.toThrow('closed');
    port.isOpen=true;port.write=(_data,cb)=>cb(new Error('USB gone'));
    await expect(writeAndDrain(port,'SQUAT STOP')).rejects.toThrow('USB gone');
  });
  it('keeps AUTO active through arrival/release and requires confirmation after STOP',()=>{
    const tracker=createMotionTracker();expect(tracker.needsStop()).toBe(false);
    tracker.sent('WALK AUTO');
    for(const value of ['squat_target_reached_released','squat_state_complete','walk_left_complete_released','walk_right_complete_released'])tracker.status(value);
    expect(tracker.needsStop()).toBe(true);tracker.sent('SQUAT STOP');expect(tracker.needsStop()).toBe(true);
    tracker.status('squat_state_held');expect(tracker.needsStop()).toBe(false);
  });
  it('keeps single multi-stage plans pending until their terminal marker',()=>{
    for(const [command,terminal] of [['WALK LEFT','walk_left_complete_released'],['WALK RIGHT','walk_right_complete_released'],['STEP AUTO','step_auto_complete_released']]){
      const tracker=createMotionTracker();tracker.sent(command);tracker.status('squat_target_reached_released');tracker.status('squat_state_complete');
      expect(tracker.needsStop()).toBe(true);tracker.status(terminal);expect(tracker.needsStop()).toBe(false);
    }
  });
  it('avoids energizing idle/completed poses on disconnect and tracks unsolicited motion',()=>{
    const tracker=createMotionTracker();tracker.sent('STATUS');tracker.status('squat_state_idle');expect(tracker.needsStop()).toBe(false);
    tracker.sent('SQUAT DOWN');tracker.status('squat_target_reached_released');expect(tracker.needsStop()).toBe(false);
    tracker.status('squat_state_moving_up');expect(tracker.needsStop()).toBe(true);
    tracker.status('squat_state_fault');expect(tracker.needsStop()).toBe(false);
    tracker.sent('WALK AUTO');tracker.reset();expect(tracker.needsStop()).toBe(false);
  });
});
