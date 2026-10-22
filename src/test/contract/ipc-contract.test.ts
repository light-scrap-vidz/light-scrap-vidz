import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { EVENT_COMPLETE, EVENT_ERROR, EVENT_PROGRESS } from '@/lib/events';

/** The frontend and the Rust backend are written by hand on both sides. These tests read
 * the Rust sources so that a rename or a removed field fails here, not at runtime. */
const rust = (file: string) => readFileSync(resolve(__dirname, '../../../src-tauri/src', file), 'utf8');
const front = (file: string) => readFileSync(resolve(__dirname, '../../', file), 'utf8');

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
    const invoked = [...front('lib/tauri-commands.ts').matchAll(/invoke(?:<[^>]*>)?\('(\w+)'/g)].map(
      (m) => m[1],
    );

    expect(invoked.length).toBeGreaterThan(5);
    for (const command of invoked) expect(handlers).toContain(command);
  });

  it('registers no command the frontend never calls', () => {
    const handlers = [
      ...(/generate_handler!\[([^\]]*)\]/.exec(rust('lib.rs'))?.[1] ?? '').matchAll(/(\w+),/g),
    ].map((m) => m[1]);
    const invoked = [...front('lib/tauri-commands.ts').matchAll(/invoke(?:<[^>]*>)?\('(\w+)'/g)].map(
      (m) => m[1],
    );

    expect(handlers.filter((h) => !invoked.includes(h))).toEqual([]);
  });

  it('matches the progress payload fields', () => {
    expect(structFields(runner, 'ProgressPayload')).toEqual(
      ['current_item', 'download_id', 'eta', 'filename', 'percent', 'speed', 'total_items'].sort(),
    );
  });

  it('matches the completion and error payload fields', () => {
    expect(structFields(runner, 'CompletePayload')).toEqual(['download_id', 'filepath']);
    expect(structFields(runner, 'ErrorPayload')).toEqual(['download_id', 'message']);
  });

  it('does not send the unused formats list to the frontend', () => {
    expect(rust('commands/fetch_info.rs')).toMatch(/skip_serializing\)\](?:\s*#\[[^\]]*\])*\s+pub formats/);
  });

  it('matches the video and playlist info fields', () => {
    expect(structFields(rust('commands/fetch_info.rs'), 'VideoInfoResponse')).toEqual(
      ['duration', 'extractor', 'formats', 'id', 'thumbnail', 'title', 'uploader', 'webpage_url'].sort(),
    );
    expect(structFields(rust('commands/fetch_playlist_info.rs'), 'PlaylistInfoResponse')).toEqual(
      ['entries', 'kind', 'playlist_count', 'title', 'uploader'],
    );
  });
});
