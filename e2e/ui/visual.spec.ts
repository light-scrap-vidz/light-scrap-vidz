import { test, expect, emit, lastDownloadId, VIDEO, PLAYLIST } from './app';

/** Pixel regression for refactors of the styling. Baselines are not committed (font
 * rendering differs per machine): run once with VISUAL=1 --update-snapshots before the
 * change, then with VISUAL=1 after it. */
test.skip(!process.env.VISUAL, 'set VISUAL=1 to compare screenshots');

const URL_BOX = 'input[aria-label="Video URL"]';
const shot = async (page: import('@playwright/test').Page, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
};

const entry = (i: number, platform: string) => ({
  id: `e${i}`, url: `https://example.com/${i}`, title: `History item ${i}`, thumbnail: '',
  platform, filepath: `/x/${i}.mp4`, downloaded_at: 1_700_000_000_000, quality: 'best',
});

test.beforeEach(async ({ app, backend }) => {
  await app.addInitScript(() => {
    localStorage.setItem('light-scrap-vidz:outputDir', '/home/me/Videos');
    localStorage.setItem('light-scrap-vidz:history', JSON.stringify([]));
  });
  await backend.set({
    fetch_video_info: () => ({
      id: 'abc', title: 'A test clip with a rather long title to check the clamping', thumbnail: '',
      duration: 212, uploader: 'Someone', webpage_url: 'https://www.youtube.com/watch?v=abc', extractor: 'youtube',
    }),
    fetch_playlist_info: () => ({
      kind: 'playlist', title: 'A test playlist', uploader: 'Someone', playlist_count: 2,
      entries: [{ id: 'a', title: 'First video', url: 'https://youtu.be/a' }, { id: 'b', title: 'Second video', url: 'https://youtu.be/b' }],
    }),
    start_download: () => undefined,
  });
});

test('home, empty', async ({ app }) => {
  await app.goto('/');
  await shot(app, 'home-empty');
});

test('home, with history and queue tab', async ({ app }) => {
  await app.addInitScript((items) => localStorage.setItem('light-scrap-vidz:history', JSON.stringify(items)), [
    entry(1, 'youtube'), entry(2, 'tiktok'), entry(3, 'instagram'), entry(4, 'unknown'),
  ]);
  await app.goto('/');
  await shot(app, 'home-history');
  await app.getByRole('button', { name: /Queue/ }).click();
  await shot(app, 'home-queue');
});

test('fetched video and playlist', async ({ app }) => {
  await app.goto('/');
  await app.fill(URL_BOX, 'https://www.youtube.com/watch?v=abc');
  await app.press(URL_BOX, 'Enter');
  await expect(app.getByRole('heading')).toBeVisible();
  await shot(app, 'fetched-video');
  await app.getByRole('button', { name: 'Audio · MP3' }).click();
  await shot(app, 'fetched-video-audio');
  await app.getByLabel('Back').click();
  await app.fill(URL_BOX, 'https://www.youtube.com/playlist?list=PL1');
  await app.press(URL_BOX, 'Enter');
  await expect(app.getByRole('heading', { name: PLAYLIST.title })).toBeVisible();
  await shot(app, 'fetched-playlist');
  await app.getByText('First video').click();
  await shot(app, 'fetched-playlist-selected');
});

test('downloading, error and complete', async ({ app }) => {
  await app.goto('/');
  await app.fill(URL_BOX, 'https://www.youtube.com/watch?v=abc');
  await app.press(URL_BOX, 'Enter');
  await expect(app.getByRole('heading')).toBeVisible();
  await app.getByRole('button', { name: 'Download MP4' }).click();
  const id = await lastDownloadId(app);
  await emit(app, 'download://progress', { download_id: id, percent: 42, speed: '1.0MiB/s', eta: '00:05', filename: 'clip.mp4', current_item: 2, total_items: 5 });
  await expect(app.getByText('42')).toBeVisible();
  await shot(app, 'downloading');
  await emit(app, 'download://complete', { download_id: id, filepath: '/home/me/Videos/clip.mp4' });
  await expect(app.getByText('Download complete')).toBeVisible();
  await shot(app, 'complete');
  await app.getByRole('button', { name: 'Download another' }).click();

  await app.fill(URL_BOX, 'https://www.youtube.com/watch?v=abc');
  await app.press(URL_BOX, 'Enter');
  await app.getByRole('button', { name: 'Download MP4' }).click();
  await emit(app, 'download://error', { download_id: await lastDownloadId(app), message: 'ERROR: This video is private' });
  await expect(app.getByRole('alert')).toBeVisible();
  await shot(app, 'download-error');
});

test('settings panel', async ({ app }) => {
  await app.goto('/');
  await app.getByLabel('Settings').click();
  await expect(app.getByText('Default folder')).toBeVisible();
  await shot(app, 'settings');
});

void VIDEO;
