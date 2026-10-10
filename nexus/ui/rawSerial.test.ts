// @ts-nocheck
import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function poller(get) {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=html.slice(html.indexOf('setInterval(async()=>{'),html.indexOf('\n\nrenderJoints(); renderImu(); update3d(); renderStream(); renderActs();'));
  const context={rawSession:'session-a',rawAfter:null,rawBusy:false,rawLines:[],backend:{get},tab:'serial',paused:false,renderStream:vi.fn(),log:vi.fn(),setInterval:fn=>{context.poll=fn;}};
  runInNewContext(source,context);return context;
}
it('reload into a long-running session fetches only records after its current tail',async()=>{
  const get=vi.fn().mockResolvedValueOnce({seq:90000}).mockResolvedValueOnce([{seq:90001,received_ms:1000,raw:'live'}]).mockResolvedValueOnce([]);
  const context=poller(get);await context.poll();
  expect(get.mock.calls.map(args=>args[0])).toEqual(['records/latest?session=session-a','records?session=session-a&after=90000']);
  expect(context.rawLines.map(row=>row[1])).toEqual(['live']);expect(context.rawAfter).toBe(90001);
  await context.poll();expect(get).toHaveBeenLastCalledWith('records?session=session-a&after=90001');
});
it('a late tail response cannot overwrite the next session cursor',async()=>{
  let resolve;const get=vi.fn(()=>new Promise(done=>{resolve=done;}));const context=poller(get);
  const pending=context.poll();context.rawSession='session-b';context.rawAfter=null;resolve({seq:90000});await pending;
  expect(context.rawAfter).toBeNull();expect(context.rawLines).toEqual([]);expect(get).toHaveBeenCalledTimes(1);
});
it('a failed tail request retries initialization without replaying from zero',async()=>{
  const get=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({seq:100}).mockResolvedValueOnce([]);
  const context=poller(get);await context.poll();expect(context.rawAfter).toBeNull();expect(context.rawBusy).toBe(false);
  await context.poll();expect(get).toHaveBeenLastCalledWith('records?session=session-a&after=100');
});
