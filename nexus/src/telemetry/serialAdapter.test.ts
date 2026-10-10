import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSerialAdapter } from './serialAdapter';

function fakePort(fail = false) {
  const commands: string[] = [];
  const port = {
    readable: new ReadableStream<Uint8Array>(),
    writable: new WritableStream<Uint8Array>({
      write(data) {
        if (fail) throw new Error('simulated USB write failure');
        commands.push(new TextDecoder().decode(data));
      },
    }),
    open: async () => undefined,
    close: async () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as SerialPort;
  return { port, commands };
}

afterEach(() => vi.unstubAllGlobals());

describe('serial motion command delivery', () => {
  it('recovers command transmission after a write failure and reconnect', async () => {
    const failed = fakePort(true);
    const recovered = fakePort();
    vi.stubGlobal('navigator', { serial: { requestPort: vi.fn()
      .mockResolvedValueOnce(failed.port).mockResolvedValueOnce(recovered.port) } });
    const adapter = createSerialAdapter();
    try {
      await adapter.connect();
      expect(await adapter.sendCalibration('SQUAT ARM DOWN')).toBe(false);
      await adapter.disconnect();
      await adapter.connect();
      expect(await adapter.sendCalibration('SQUAT ARM DOWN')).toBe(true);
      expect(recovered.commands).toEqual(['SQUAT ARM DOWN\n']);
    } finally { await adapter.disconnect(); }
  });

  it('does not transmit a queued command after disconnect', async () => {
    const active = fakePort();
    vi.stubGlobal('navigator', { serial: { requestPort: async () => active.port } });
    const adapter = createSerialAdapter();
    await adapter.connect();
    const pending = adapter.sendCalibration('SQUAT DOWN');
    await adapter.disconnect();
    expect(await pending).toBe(false);
    expect(active.commands).toEqual([]);
    expect(adapter.getSnapshot().feed.linkState).toBe('DISCONNECTED');
  });
});
