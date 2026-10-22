import { test, expect, emit, calls, lastDownloadId, VIDEO, PLAYLIST } from './app';

const URL_BOX = 'input[aria-label="Video URL"]';

test.beforeEach(async ({ app }) => {
  await app.addInitScript(() => localStorage.setItem('light-scrap-vidz:outputDir', '/home/me/Videos'));
});

async function fetchVideo(app: import('@playwright/test').Page, url = 'https://www.youtube.com/watch?v=abc') {
  await app.goto('/');
  await app.fill(URL_BOX, url);
  await app.press(URL_BOX, 'Enter');
  await expect(app.getByRole('heading', { name: VIDEO.title })).toBeVisible();
}

test('home shows the supported platforms and an empty history', async ({ app, backend }) => {
  await backend.set({});
  await app.goto('/');
  await expect(app.getByText('Supports:')).toBeVisible();
  await expect(app.getByText('No downloads yet')).toBeVisible();
});

test('fetches a video, downloads it and shows the finished file', async ({ app, backend }) => {
  await backend.set({
    fetch_video_info: () => ({
      id: 'abc', title: 'A test clip', thumbnail: '', duration: 212, uploader: 'Someone',
      webpage_url: 'https://www.youtube.com/watch?v=abc', extractor: 'youtube',
    }),
    start_download: () => undefined,
  });
  await fetchVideo(app);

  await app.getByRole('button', { name: 'Download MP4' }).click();
  await expect(app.getByRole('button', { name: 'Cancel download' })).toBeVisible();
  const id = await lastDownloadId(app);

  await emit(app, 'download://progress', { download_id: id, percent: 42, speed: '1.0MiB/s', eta: '00:05', filename: 'clip.mp4', current_item: null, total_items: null });
  await expect(app.getByText('42')).toBeVisible();

  await emit(app, 'download://complete', { download_id: id, filepath: '/home/me/Videos/clip.mp4' });
  await expect(app.getByText('Download complete')).toBeVisible();
  await expect(app.getByText('/home/me/Videos/clip.mp4')).toBeVisible();

  // The history shows it without a restart.
  await app.getByRole('button', { name: 'Download another' }).click();
  await expect(app.getByText('A test clip')).toBeVisible();
});

test('shows why a download failed and lets the user retry', async ({ app, backend }) => {
  await backend.set({
    fetch_video_info: () => ({
      id: 'abc', title: 'A test clip', thumbnail: '', duration: 212, uploader: 'Someone',
      webpage_url: 'https://www.youtube.com/watch?v=abc', extractor: 'youtube',
    }),
    start_download: () => undefined,
  });
  await fetchVideo(app);
  await app.getByRole('button', { name: 'Download MP4' }).click();
  await expect(app.getByRole('button', { name: 'Cancel download' })).toBeVisible();

  await emit(app, 'download://error', { download_id: await lastDownloadId(app), message: 'ERROR: This video is private' });

  await expect(app.getByRole('alert')).toHaveText('This video is private.');
  await expect(app.getByRole('button', { name: 'Download MP4' })).toBeEnabled();
});

test('cancelling stops the backend download', async ({ app, backend }) => {
  await backend.set({
    fetch_video_info: () => ({
      id: 'abc', title: 'A test clip', thumbnail: '', duration: 212, uploader: 'Someone',
      webpage_url: 'https://www.youtube.com/watch?v=abc', extractor: 'youtube',
    }),
    start_download: () => undefined,
    cancel_download: () => undefined,
  });
  await fetchVideo(app);
  await app.getByRole('button', { name: 'Download MP4' }).click();
  const id = await lastDownloadId(app);

  await app.getByRole('button', { name: 'Cancel download' }).click();

  await expect.poll(() => calls(app, 'cancel_download')).toEqual([{ downloadId: id }]);
});

test('a failed lookup is explained on the home screen', async ({ app, backend }) => {
  await backend.set({ fetch_video_info: () => new Error('ERROR: This video is private') });
  await app.goto('/');
  await app.fill(URL_BOX, 'https://youtu.be/x');
  await app.press(URL_BOX, 'Enter');
  await expect(app.getByText('This video is private.')).toBeVisible();
});

test('a playlist can be queued entry by entry', async ({ app, backend }) => {
  await backend.set({ fetch_playlist_info: () => ({
    kind: 'playlist', title: 'A test playlist', uploader: 'Someone', playlist_count: 2,
    entries: [{ id: 'a', title: 'First video', url: 'https://youtu.be/a' }, { id: 'b', title: 'Second video', url: 'https://youtu.be/b' }],
  }), start_download: () => undefined });
  await app.goto('/');
  await app.fill(URL_BOX, 'https://www.youtube.com/playlist?list=PL1');
  await app.press(URL_BOX, 'Enter');
  await expect(app.getByRole('heading', { name: PLAYLIST.title })).toBeVisible();

  await app.getByText('First video').click();
  await app.getByRole('button', { name: /Download 1 selected/ }).click();

  await expect.poll(async () => (await calls(app, 'start_download')).length).toBe(1);
  expect(((await calls(app, 'start_download')) as { url: string }[])[0].url).toBe('https://youtu.be/a');
});
