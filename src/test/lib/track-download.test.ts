import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { trackDownload } from '@/lib/track-download';

const mockListen = vi.mocked(listen);

let handlers: Record<string, (e: { payload: unknown }) => void>;
let unlisten: ReturnType<typeof vi.fn>;

beforeEach(() => {
  handlers = {};
  unlisten = vi.fn();
  mockListen.mockImplementation(((event: string, handler: unknown) => {
    handlers[event] = handler as (e: { payload: unknown }) => void;
    return Promise.resolve(unlisten);
  }) as typeof listen);
});

describe('trackDownload', () => {
  const setup = async () => {
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const stop = await trackDownload('mine', { onProgress, onComplete, onError });
    return { onProgress, onComplete, onError, stop };
  };

  it('forwards the events of its own download', async () => {
    const { onProgress, onComplete, onError } = await setup();

    handlers['download://progress']({ payload: { download_id: 'mine', percent: 5 } });
    handlers['download://complete']({ payload: { download_id: 'mine', filepath: '/a' } });
    handlers['download://error']({ payload: { download_id: 'mine', message: 'boom' } });

    expect(onProgress).toHaveBeenCalledWith({ download_id: 'mine', percent: 5 });
    expect(onComplete).toHaveBeenCalledWith({ download_id: 'mine', filepath: '/a' });
    expect(onError).toHaveBeenCalledWith({ download_id: 'mine', message: 'boom' });
  });

  it('ignores the events of other downloads', async () => {
    const { onProgress, onComplete, onError } = await setup();

    handlers['download://progress']({ payload: { download_id: 'other', percent: 5 } });
    handlers['download://complete']({ payload: { download_id: 'other', filepath: '/a' } });
    handlers['download://error']({ payload: { download_id: 'other', message: 'x' } });

    expect(onProgress).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('stops listening to all three events', async () => {
    const { stop } = await setup();

    stop();

    expect(unlisten).toHaveBeenCalledTimes(3);
  });
});
