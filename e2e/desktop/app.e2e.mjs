// End-to-end test in the real Tauri window: the packaged frontend, the real Rust backend,
// WebKitGTK, driven through tauri-driver. yt-dlp is replaced by fake-ytdlp.sh (YTDLP_PATH).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { remote } from 'webdriverio';

const root = resolve(import.meta.dirname, '../..');
const application = process.env.APP_BINARY ?? join(root, 'src-tauri/target/debug/light-scrap-vidz');
const driverBin = process.env.TAURI_DRIVER ?? join(homedir(), '.cargo/bin/tauri-driver');

const sandbox = mkdtempSync(join(tmpdir(), 'lsv-e2e-'));
const outDir = join(sandbox, 'downloads');
const env = {
  ...process.env,
  YTDLP_PATH: join(import.meta.dirname, 'fake-ytdlp.sh'),
  XDG_DATA_HOME: join(sandbox, 'data'),
  XDG_CONFIG_HOME: join(sandbox, 'config'),
  XDG_CACHE_HOME: join(sandbox, 'cache'),
  LANG: 'en_US.UTF-8',
};

let driver;
let browser;

const waitFor = (fn, message, timeout = 30_000) => browser.waitUntil(fn, { timeout, timeoutMsg: message });
// `contains` also matches every ancestor; webdriverio 10 refuses ambiguous selectors, and the
// deepest match (last in document order) is the element that really holds the text.
const byText = (tag, text) => browser.$(`(//${tag}[contains(normalize-space(.), "${text}")])[last()]`);

async function openFresh() {
  await browser.execute((dir) => {
    localStorage.clear();
    localStorage.setItem('light-scrap-vidz:language', 'en');
    localStorage.setItem('light-scrap-vidz:outputDir', dir);
  }, outDir);
  await browser.refresh();
  await (await browser.$('input[aria-label="Video URL"]')).waitForDisplayed({ timeout: 30_000 });
}

async function submit(url) {
  const input = await browser.$('input[aria-label="Video URL"]');
  await input.setValue(url);
  await browser.keys('Enter');
}

describe('the desktop app', () => {
  before(async () => {
    assert.ok(existsSync(application), `app binary not found: ${application}`);
    driver = spawn(driverBin, [], { env, stdio: ['ignore', 'inherit', 'inherit'] });
    await new Promise((r) => setTimeout(r, 2000));
    browser = await remote({
      hostname: '127.0.0.1',
      port: 4444,
      logLevel: 'warn',
      capabilities: { 'tauri:options': { application } },
    });
  });

  after(async () => {
    await browser?.deleteSession().catch(() => {});
    driver?.kill();
  });

  it('starts on the home screen', async () => {
    await openFresh();
    assert.ok(await (await byText('span', 'Supports:')).isDisplayed());
  });

  it('fetches a video through the real backend', async () => {
    await openFresh();
    await submit('https://www.youtube.com/watch?v=fake1');
    const title = await browser.$('h3');
    await title.waitForDisplayed({ timeout: 30_000 });
    // `getText()` is empty for line-clamped text in WebKitGTK; read the DOM instead.
    assert.equal(await title.getProperty('textContent'), 'Fake clip');
  });

  it('downloads a video and writes the file', async () => {
    await openFresh();
    await submit('https://www.youtube.com/watch?v=fake1');
    await (await browser.$('h3')).waitForDisplayed({ timeout: 30_000 });

    await (await byText('button', 'Download MP4')).click();

    await (await byText('div', 'Download complete')).waitForDisplayed({ timeout: 60_000 });
    await waitFor(() => existsSync(outDir) && readdirSync(outDir).length > 0, 'no file written');
    assert.deepEqual(readdirSync(outDir), ['Fake clip [fake1].mp4']);
  });

  it('explains why a download failed', async () => {
    await openFresh();
    await submit('https://www.youtube.com/watch?v=fail');
    await (await browser.$('h3')).waitForDisplayed({ timeout: 30_000 });

    await (await byText('button', 'Download MP4')).click();

    // Other alerts may be on screen (e.g. a missing ffmpeg on the runner).
    const alert = await browser.$('//*[@role="alert"][contains(., "private")]');
    await alert.waitForDisplayed({ timeout: 60_000 });
    assert.equal(await alert.getText(), 'This video is private.');
  });

  it('lists a finished download in Recent', async () => {
    await openFresh();
    await submit('https://www.youtube.com/watch?v=fake1');
    await (await browser.$('h3')).waitForDisplayed({ timeout: 30_000 });
    await (await byText('button', 'Download MP4')).click();
    await (await byText('div', 'Download complete')).waitForDisplayed({ timeout: 60_000 });

    await (await byText('button', 'Download another')).click();

    await (await byText('p', 'Fake clip')).waitForDisplayed({ timeout: 10_000 });
  });

  it('reaches 100% before completing', async () => {
    await openFresh();
    await submit('https://www.youtube.com/watch?v=fake1');
    await (await browser.$('h3')).waitForDisplayed({ timeout: 30_000 });
    // Watch the progress bar from the page, so the 100% is not missed between two polls.
    await browser.execute(() => {
      window.__seen = [];
      new MutationObserver(() => {
        const bar = document.querySelector('[role="progressbar"]');
        if (bar) window.__seen.push(bar.getAttribute('aria-valuenow'));
      }).observe(document.body, { subtree: true, attributes: true, childList: true });
    });

    await (await byText('button', 'Download MP4')).click();
    await (await byText('div', 'Download complete')).waitForDisplayed({ timeout: 60_000 });

    const seen = await browser.execute(() => window.__seen);
    assert.ok(seen.includes('100'), `the bar never showed 100%: ${JSON.stringify(seen)}`);
  });

  it('opens the exact file it produced', async () => {
    await openFresh();
    await submit('https://www.youtube.com/watch?v=fake1');
    await (await browser.$('h3')).waitForDisplayed({ timeout: 30_000 });
    await (await byText('button', 'Download MP4')).click();
    await (await byText('div', 'Download complete')).waitForDisplayed({ timeout: 60_000 });

    const path = await (await browser.$('bdi')).getProperty('textContent');

    assert.ok(path.endsWith('Fake clip [fake1].mp4'), path);
  });

  it('cancels a running download and leaves no partial file behind', async () => {
    await openFresh();
    await submit('https://www.youtube.com/watch?v=slow');
    await (await browser.$('h3')).waitForDisplayed({ timeout: 30_000 });
    await (await byText('button', 'Download MP4')).click();
    await (await byText('button', 'Cancel download')).waitForDisplayed({ timeout: 30_000 });
    await waitFor(
      () => readdirSync(outDir).some((f) => f.startsWith('.light-scrap-vidz-')),
      'the temp folder never appeared',
    );

    await (await byText('button', 'Cancel download')).click();

    await waitFor(
      () => !readdirSync(outDir).some((f) => f.startsWith('.light-scrap-vidz-')),
      'the temp folder survived the cancellation',
    );
    assert.ok(!readdirSync(outDir).some((f) => f.endsWith('.part')));
  });
});
