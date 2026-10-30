import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { loadNotify, saveNotify, sendDesktopNotification } from '@/lib/notify';

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(isPermissionGranted).mockResolvedValue(true);
  vi.mocked(requestPermission).mockResolvedValue('granted');
});

describe('sendDesktopNotification', () => {
  it('notifies when permission is already granted', async () => {
    await sendDesktopNotification('Done', 'a.mp4');

    expect(sendNotification).toHaveBeenCalledWith({ title: 'Done', body: 'a.mp4' });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('asks for permission first when it was not granted', async () => {
    vi.mocked(isPermissionGranted).mockResolvedValue(false);

    await sendDesktopNotification('Done', 'a.mp4');

    expect(requestPermission).toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalled();
  });

  it('stays silent when permission is refused', async () => {
    vi.mocked(isPermissionGranted).mockResolvedValue(false);
    vi.mocked(requestPermission).mockResolvedValue('denied');

    await sendDesktopNotification('Done', 'a.mp4');

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('stays silent when the user switched notifications off, without even asking', async () => {
    saveNotify(false);

    await sendDesktopNotification('Done', 'a.mp4');

    expect(isPermissionGranted).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('swallows a failure of the notification system', async () => {
    vi.mocked(isPermissionGranted).mockRejectedValue(new Error('no daemon'));

    await expect(sendDesktopNotification('Done', 'a.mp4')).resolves.toBeUndefined();
  });
});

describe('the notification switch', () => {
  it('is on until the user turns it off', () => {
    expect(loadNotify()).toBe(true);
    saveNotify(false);
    expect(loadNotify()).toBe(false);
    saveNotify(true);
    expect(loadNotify()).toBe(true);
  });
});
