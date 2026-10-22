import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { HistoryList } from '@/components/HistoryList';
import { UrlInput } from '@/components/UrlInput';
import { DownloadButton } from '@/components/DownloadButton';
import { FolderPicker } from '@/components/FolderPicker';
import { QueuePanel } from '@/components/QueuePanel';
import { SettingsSheet } from '@/components/SettingsSheet';
import { AppHeader } from '@/components/views/AppHeader';
import type { HistoryEntry, QueueItem } from '@/types';

vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

/** Hover feedback lives in `index.css` (`:hover` cannot be exercised in jsdom). These tests
 * check that every control carries a class and that every class has a rule, so a control
 * can no longer lose its feedback — or point at a rule that does not exist — unnoticed. */
const css = readFileSync(resolve(import.meta.dirname, '../../index.css'), 'utf8');
const hasRule = (cls: string) => new RegExp(`\\.${cls}:hover`).test(css);

const entry: HistoryEntry = {
  id: 'e1',
  url: 'https://youtu.be/a',
  title: 'Rick Astley',
  thumbnail: '',
  platform: 'youtube',
  filepath: '/x/rick.mp4',
  downloaded_at: Date.now(),
  quality: 'best',
};
const queued: QueueItem = {
  id: 'q1',
  url: 'https://youtu.be/q',
  outputDir: '/x',
  quality: 'best',
  audioOnly: false,
  playlistEnd: null,
  cookiesBrowser: null,
  status: 'pending',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVersion).mockResolvedValue('1.0.0');
  vi.mocked(check).mockResolvedValue(null);
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('hover feedback classes', () => {
  it('defines a :hover rule for every hover class', () => {
    for (const cls of [
      'lsv-hover-icon',
      'lsv-hover-link',
      'lsv-hover-lift',
      'lsv-hover-outline',
      'lsv-hover-danger',
      'lsv-hover-row',
      'lsv-hover-accent',
      'lsv-hover-accent-bg',
      'lsv-hover-muted',
      'lsv-hover-fill',
    ]) {
      expect(hasRule(cls), cls).toBe(true);
    }
  });

  it('defines the focus rule shared by the text fields', () => {
    expect(css).toMatch(/\.lsv-field:focus-within/);
  });

  it('keeps no inline mouse handler on the controls', () => {
    const { container } = render(
      <>
        <AppHeader showBack backDisabled={false} onBack={vi.fn()} onOpenSettings={vi.fn()} />
        <UrlInput onSubmit={vi.fn()} isLoading={false} />
        <DownloadButton onDownload={vi.fn()} />
        <FolderPicker value="/x" onChange={vi.fn()} />
        <HistoryList entries={[entry]} onClear={vi.fn()} />
        <QueuePanel items={[queued]} onAddUrls={vi.fn()} onRemoveItem={vi.fn()} onClearDone={vi.fn()} onClearAll={vi.fn()} />
      </>,
    );
    expect(container.innerHTML).not.toMatch(/onmouse/i);
  });

  it.each([
    ['the back button', () => screen.getByLabelText('Back'), 'lsv-hover-icon'],
    ['the settings button', () => screen.getByLabelText('Settings'), 'lsv-hover-icon'],
    ['the paste button', () => screen.getByLabelText('Paste from clipboard'), 'lsv-hover-outline'],
    ['the fetch button', () => screen.getByLabelText('Fetch info'), 'lsv-hover-lift'],
    ['the download button', () => screen.getByRole('button', { name: /Download MP4/ }), 'lsv-hover-lift'],
    ['the folder picker', () => screen.getByLabelText('Choose output folder'), 'lsv-hover-accent'],
    ['the reveal button', () => screen.getByLabelText('Reveal in folder'), 'lsv-hover-accent-bg'],
    ['the queue remove button', () => screen.getByLabelText('Remove from queue'), 'lsv-hover-muted'],
  ])('%s carries its hover class', (_name, find, cls) => {
    render(
      <>
        <AppHeader showBack backDisabled={false} onBack={vi.fn()} onOpenSettings={vi.fn()} />
        <UrlInput onSubmit={vi.fn()} isLoading={false} />
        <DownloadButton onDownload={vi.fn()} />
        <FolderPicker value="/x" onChange={vi.fn()} />
        <HistoryList entries={[entry]} onClear={vi.fn()} />
        <QueuePanel items={[queued]} onAddUrls={vi.fn()} onRemoveItem={vi.fn()} onClearDone={vi.fn()} onClearAll={vi.fn()} />
      </>,
    );
    expect(find()).toHaveClass(cls);
  });

  it('marks the history row so hover is suppressed while loading', () => {
    render(<HistoryList entries={[entry]} onClear={vi.fn()} isLoading />);
    expect(screen.getByRole('button', { name: /Rick Astley/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('gives the settings update button its hover class', async () => {
    render(
      <SettingsSheet
        open
        onClose={vi.fn()}
        outputDir="/x"
        onOutputDirChange={vi.fn()}
        cookiesBrowser={null}
        onCookiesBrowserChange={vi.fn()}
        detectedBrowsers={[]}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Check for updates' })).toHaveClass('lsv-hover-outline');
  });
});
