import {it,expect,vi} from 'vitest';
// HTML UI transport is plain JS so the reference wireframe can import it.
// @ts-expect-error JS module is intentionally shared with the HTML entry.
import {createBackendClient} from './collectorClient.js';

it('CONNECT reaches the backend and command uses the confirmed session',async()=>{
  const live={sessionId:'session',snapshot:{},motion:{state:'idle'}};
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({token:'token'})}).mockResolvedValue({ok:true,json:async()=>live});
  const notify=vi.fn(),client=createBackendClient(notify,vi.fn(),{fetch});
  await client.post('connect');await client.command('SQUAT DOWN');
  expect(fetch.mock.calls[1][0]).toBe('/api/telemetry/connect');
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({command:'SQUAT DOWN',sessionId:'session'});
  expect(notify).toHaveBeenCalledWith(live);
});
it('does not claim success or retry a rejected command',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({token:'token'})}).mockResolvedValue({ok:false,status:400,json:async()=>({error:'port busy'})});
  const notify=vi.fn(),client=createBackendClient(notify,vi.fn(),{fetch});
  await expect(client.post('connect')).rejects.toThrow('port busy');expect(notify).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(2);
  await expect(client.command('SQUAT DOWN')).rejects.toThrow('未接続');
});
