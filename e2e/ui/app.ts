import { test as base, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const VIDEO = {
  id: 'abc',
  title: 'A test clip',
  thumbnail: '',
  duration: 212,
  uploader: 'Someone',
  webpage_url: 'https://www.youtube.com/watch?v=abc',
  extractor: 'youtube',
};

export const PLAYLIST = {
  kind: 'playlist',
  title: 'A test playlist',
  uploader: 'Someone',
  playlist_count: 2,
  entries: [
    { id: 'a', title: 'First video', url: 'https://youtu.be/a' },
    { id: 'b', title: 'Second video', url: 'https://youtu.be/b' },
  ],
};

type Handlers = Record<string, (args: Record<string, unknown>) => unknown>;

/** Opens the app with the Tauri runtime replaced by a scriptable mock. */
export const test = base.extend<{ app: Page; backend: { set: (h: Handlers) => Promise<void> } }>({
  app: async ({ page }, provide) => {
    await page.addInitScript({ path: fileURLToPath(new URL('./tauri-mock.js', import.meta.url)) });
    await page.addInitScript(() => {
      if (!localStorage.getItem('light-scrap-vidz:language')) {
        localStorage.setItem('light-scrap-vidz:language', 'en');
      }
    });
    await provide(page);
  },
  backend: async ({ app }, provide) => {
    // Handlers are functions, which cannot cross the page boundary: they are passed as source
    // and installed right after the mock, so call `set` before `app.goto`.
    await provide({
      set: async (h) => {
        const sources = Object.fromEntries(Object.entries(h).map(([k, f]) => [k, f.toString()]));
        await app.addInitScript((src) => {
          const w = window as unknown as { __lsv: { handlers: Record<string, unknown> } };
          for (const [k, s] of Object.entries(src)) w.__lsv.handlers[k] = new Function(`return (${s})`)();
        }, sources);
      },
    });
  },
});

export { expect };

export const emit = (page: Page, event: string, payload: unknown) =>
  page.evaluate(([e, p]) => (window as unknown as { __lsv: { emit: (e: string, p: unknown) => void } }).__lsv.emit(e as string, p), [event, payload]);

export const calls = (page: Page, cmd: string) =>
  page.evaluate(
    (c) => (window as unknown as { __lsv: { calls: { cmd: string; args: unknown }[] } }).__lsv.calls.filter((x) => x.cmd === c).map((x) => x.args),
    cmd,
  );

export const lastDownloadId = async (page: Page) => {
  const all = (await calls(page, 'start_download')) as { downloadId: string }[];
  return all[all.length - 1].downloadId;
};
