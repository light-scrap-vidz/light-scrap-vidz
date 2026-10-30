import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { EVENT_COMPLETE, EVENT_ERROR, EVENT_PROGRESS } from '@/lib/events';

/** The frontend and the Rust backend are written by hand on both sides. These tests read
 * the Rust sources so that a rename or a removed field fails here, not at runtime. */
const rust = (file: string) =>
  readFileSync(resolve(import.meta.dirname, '../../../src-tauri/src', file), 'utf8');
const front = (file: string) => readFileSync(resolve(import.meta.dirname, '../../', file), 'utf8');

function structFields(source: string, name: string): string[] {
  const body = new RegExp(`pub struct ${name} \\{([^}]*)\\}`).exec(source)?.[1] ?? '';
  return [...body.matchAll(/pub (\w+):/g)].map((m) => m[1]).sort();
}

describe('IPC contract with the Rust backend', () => {
  const runner = rust('commands/download_runner.rs');

  it('uses the event names the backend emits', () => {
    const consts = Object.fromEntries(
      [...runner.matchAll(/pub const EVENT_(\w+): &str = "([^"]+)";/g)].map((m) => [m[1], m[2]]),
    );
    expect(consts).toEqual({
      PROGRESS: EVENT_PROGRESS,
      COMPLETE: EVENT_COMPLETE,
      ERROR: EVENT_ERROR,
    });
  });

  it('only invokes commands the backend registers', () => {
    const handlers = [
      ...(/generate_handler!\[([^\]]*)\]/.exec(rust('lib.rs'))?.[1] ?? '').matchAll(/(\w+),/g),
    ].map((m) => m[1]);
    const invoked = [
      ...front('lib/tauri-commands.ts').matchAll(/invoke(?:<[^>]*>)?\('(\w+)'/g),
    ].map((m) => m[1]);

    expect(invoked.length).toBeGreaterThan(5);
    for (const command of invoked) expect(handlers).toContain(command);
  });

  it('registers no command the frontend never calls', () => {
    const handlers = [
      ...(/generate_handler!\[([^\]]*)\]/.exec(rust('lib.rs'))?.[1] ?? '').matchAll(/(\w+),/g),
    ].map((m) => m[1]);
    const invoked = [
      ...front('lib/tauri-commands.ts').matchAll(/invoke(?:<[^>]*>)?\('(\w+)'/g),
    ].map((m) => m[1]);

    expect(handlers.filter((h) => !invoked.includes(h))).toEqual([]);
  });

  it('matches the progress payload fields', () => {
    expect(structFields(runner, 'ProgressPayload')).toEqual(
      [
        'current_item',
        'download_id',
        'downloaded',
        'eta',
        'filename',
        'indeterminate',
        'percent',
        'speed',
        'stage',
        'total_items',
      ].sort(),
    );
  });

  it('matches the completion and error payload fields', () => {
    expect(structFields(runner, 'CompletePayload')).toEqual(['download_id', 'filepath']);
    expect(structFields(runner, 'ErrorPayload')).toEqual(['download_id', 'message']);
  });

  it('does not even decode the unused formats list', () => {
    expect(rust('commands/fetch_info.rs')).not.toMatch(/pub formats|FormatInfo/);
  });

  it('matches the video and playlist info fields', () => {
    expect(structFields(rust('commands/fetch_info.rs'), 'VideoInfoResponse')).toEqual(
      ['duration', 'extractor', 'id', 'thumbnail', 'title', 'uploader', 'webpage_url'].sort(),
    );
    expect(structFields(rust('commands/fetch_playlist_info.rs'), 'PlaylistInfoResponse')).toEqual([
      'entries',
      'kind',
      'playlist_count',
      'title',
      'uploader',
    ]);
  });

  it('accepts exactly the browsers the interface can offer', () => {
    const backend = [
      ...(
        /BROWSERS: &\[&str\] = &\[([^\]]*)\]/.exec(rust('ytdlp/validate.rs'))?.[1] ?? ''
      ).matchAll(/"(\w+)"/g),
    ].map((m) => m[1]);
    const frontend = [
      ...(/BROWSERS = \[([^\]]*)\]/.exec(front('lib/cookies.ts'))?.[1] ?? '').matchAll(/'(\w+)'/g),
    ].map((m) => m[1]);

    expect(backend.length).toBeGreaterThan(3);
    expect(frontend).toEqual(backend);
  });

  it('serves thumbnails through the scheme the frontend asks for, and the CSP allows it', () => {
    const scheme = /register_asynchronous_uri_scheme_protocol\("(\w+)"/.exec(rust('lib.rs'))?.[1];
    const asked = /convertFileSrc\(remoteUrl, '(\w+)'\)/.exec(front('lib/tauri-commands.ts'))?.[1];
    const conf = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../src-tauri/tauri.conf.json'), 'utf8'),
    );

    expect(scheme).toBeDefined();
    expect(asked).toBe(scheme);
    expect(conf.app.security.csp).toContain(`img-src 'self' data: ${scheme}:`);
  });

  it('keeps the webview away from third-party hosts', () => {
    const conf = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../src-tauri/tauri.conf.json'), 'utf8'),
    );

    expect(conf.app.security.csp).not.toMatch(
      /https:|http:\/\/(?!ipc\.localhost|thumb\.localhost)/,
    );
    expect(conf.app.security.csp).not.toContain('unsafe-inline');
    expect(conf.app.security.csp).not.toContain('ws://');
    expect(conf.app.security.devCsp).toContain('ws://localhost:1420');
  });

  it('grants the webview only the permissions it uses', () => {
    const caps = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../src-tauri/capabilities/default.json'),
        'utf8',
      ),
    );
    const ids = caps.permissions.map((p: string | { identifier: string }) =>
      typeof p === 'string' ? p : p.identifier,
    );

    expect(ids).not.toContain('process:default'); // would allow the webview to exit the app
    expect(ids).not.toContain('dialog:default'); // save, ask, message, confirm: all unused
    expect(ids).toContain('dialog:allow-open');
    expect(ids).toContain('process:allow-restart');
    expect(ids.some((id: string) => id.startsWith('opener'))).toBe(false); // links are never opened from the webview
  });

  it('matches the dependency report fields', () => {
    expect(structFields(rust('commands/dependencies.rs'), 'DependencyStatus')).toEqual([
      'ffmpeg',
      'js_runtime',
    ]);
  });
});
