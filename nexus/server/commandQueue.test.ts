import {it,expect} from 'vitest';
import {createCommandQueue} from './commandQueue';

it('STOP bypasses queued moves and cancels them without affecting the next command',async()=>{
  const queue=createCommandQueue(),written: string[]=[];
  let finish!: ()=>void;
  const first=queue.send(()=>new Promise<void>(resolve=>{written.push('first');finish=resolve;}));
  await Promise.resolve();await Promise.resolve();
  const cancelled=queue.send(async()=>{written.push('old move');});
  const rejection=expect(cancelled).rejects.toThrow('cancelled');
  await queue.send(async()=>{written.push('STOP');},true);
  expect(written).toEqual(['first','STOP']);finish();await first;await rejection;
  await queue.send(async()=>{written.push('new move');});expect(written).toEqual(['first','STOP','new move']);
});
it('disconnect invalidates waiting commands and a failed write does not poison the queue',async()=>{
  const queue=createCommandQueue();
  const cancelled=queue.send(async()=>{throw new Error('Should not send');});queue.cancel();
  await expect(cancelled).rejects.toThrow('cancelled');
  await expect(queue.send(async()=>{throw new Error('write failed');})).rejects.toThrow('write failed');
  await expect(queue.send(async()=>undefined)).resolves.toBeUndefined();
});
