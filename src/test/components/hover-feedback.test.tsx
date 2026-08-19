import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryList } from '@/components/HistoryList';
import { UrlInput } from '@/components/UrlInput';
import { SettingsButton } from '@/components/SettingsButton';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import type { HistoryEntry } from '@/types';

// `SettingsButton` interroge la version et l'updater dès le montage.
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));

/**
 * Le survol des contrôles est câblé à la main (styles inline plutôt que `:hover`
 * CSS, pour rester cohérent avec le reste du thème). Ces tests vérifient que le
 * retour visuel s'applique bien et — surtout — qu'il se retire, sinon un contrôle
 * reste allumé après le passage de la souris.
 */

/** Survole `el`, puis le quitte, en relevant le style à chaque étape. */
function hoverCycle(el: HTMLElement, property: keyof CSSStyleDeclaration) {
  const before = el.style[property] as string;
  fireEvent.mouseEnter(el);
  const during = el.style[property] as string;
  fireEvent.mouseLeave(el);
  const after = el.style[property] as string;
  return { before, during, after };
}

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'entry-1',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Rick Astley',
  thumbnail: '',
  platform: 'youtube',
  filepath: '/home/me/Downloads/rick.mp4',
  downloaded_at: Date.now(),
  quality: 'best',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVersion).mockResolvedValue('0.2.14');
  vi.mocked(check).mockResolvedValue(null);
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('HistoryList — retour visuel au survol', () => {
  it('éclaire la bordure de la ligne survolée puis la rend', () => {
    render(<HistoryList entries={[entry()]} onClear={vi.fn()} />);
    const row = screen.getByText('Rick Astley').closest('div[style*="border-radius"]') as HTMLElement;

    const { during, after } = hoverCycle(row, 'borderColor');

    expect(during).not.toBe(after);
    expect(after).toBe('rgba(255, 255, 255, 0.05)');
  });

  it('laisse la ligne tranquille pendant un chargement', () => {
    render(<HistoryList entries={[entry()]} onClear={vi.fn()} isLoading />);
    const row = screen.getByText('Rick Astley').closest('div[style*="border-radius"]') as HTMLElement;
    const before = row.style.borderColor;

    fireEvent.mouseEnter(row);

    expect(row.style.borderColor).toBe(before);
  });

  it('éclaire le bouton « révéler dans le dossier » puis le rend', () => {
    render(<HistoryList entries={[entry()]} onClear={vi.fn()} />);
    const button = screen.getByRole('button', { name: /reveal in folder/i });

    const { during, after } = hoverCycle(button, 'color');

    expect(during).toBe('rgb(201, 242, 94)');
    expect(after).toBe('rgb(92, 87, 79)');
  });

  it('n’éclaire pas le bouton pendant un chargement', () => {
    render(<HistoryList entries={[entry()]} onClear={vi.fn()} isLoading />);
    const button = screen.getByRole('button', { name: /reveal in folder/i });
    const before = button.style.color;

    fireEvent.mouseEnter(button);

    expect(button.style.color).toBe(before);
  });
});

describe('UrlInput — retour visuel au survol', () => {
  /** Rend le champ, avec une URL déjà saisie si `url` est fourni. */
  function setup(url = '', props: Partial<Parameters<typeof UrlInput>[0]> = {}) {
    render(<UrlInput onSubmit={vi.fn()} isLoading={false} {...props} />);
    if (url) fireEvent.change(screen.getByLabelText('Video URL'), { target: { value: url } });
    return {
      paste: screen.getByLabelText('Paste from clipboard'),
      submit: screen.getByLabelText('Fetch info'),
    };
  }

  it('éclaire la bordure du bouton « coller » puis la rend', () => {
    const { paste } = setup();

    const { during, after } = hoverCycle(paste, 'borderColor');

    expect(during).toBe('rgba(255, 255, 255, 0.2)');
    expect(after).toBe('rgba(255, 255, 255, 0.1)');
  });

  it('laisse le bouton « coller » éteint quand la saisie est désactivée', () => {
    const { paste } = setup('', { isLoading: true });
    const before = paste.style.borderColor;

    fireEvent.mouseEnter(paste);

    expect(paste.style.borderColor).toBe(before);
  });

  it('soulève le bouton principal au survol puis le repose', () => {
    const { submit } = setup('https://youtu.be/abc');

    const { during, after } = hoverCycle(submit, 'transform');

    expect(during).toBe('translateY(-1px)');
    expect(after).toBe('none');
  });

  it('ne soulève pas le bouton principal quand le champ est vide', () => {
    const { submit } = setup('   ');

    fireEvent.mouseEnter(submit);

    expect(submit.style.transform).not.toBe('translateY(-1px)');
  });
});

describe('SettingsButton — retour visuel au survol', () => {
  /** Le panneau interroge la version et l'updater au montage : on laisse ces
   * promesses se résoudre avant de survoler quoi que ce soit. */
  async function setup(props: Partial<Parameters<typeof SettingsButton>[0]> = {}) {
    render(
      <SettingsButton
        open
        onClose={vi.fn()}
        outputDir="/home/me/Videos"
        onOutputDirChange={vi.fn()}
        cookiesBrowser={null}
        onCookiesBrowserChange={vi.fn()}
        detectedBrowsers={[]}
        {...props}
      />,
    );
    await act(async () => {});
  }

  it('éclaire le choix du dossier puis revient à la couleur « dossier défini »', async () => {
    await setup();
    const folder = screen.getByText('/home/me/Videos').closest('button') as HTMLElement;

    const { during, after } = hoverCycle(folder, 'color');

    expect(during).toBe('rgb(201, 242, 94)');
    expect(after).toBe('rgb(214, 209, 200)');
  });

  it('revient à la couleur « aucun dossier » quand il n’y en a pas', async () => {
    await setup({ outputDir: '' });
    const folder = screen.getByText(/choose|no folder|select/i).closest('button') as HTMLElement;

    const { after } = hoverCycle(folder, 'color');

    expect(after).toBe('rgb(111, 105, 96)');
  });

  it('éclaire la bordure du bouton de mise à jour puis la rend', async () => {
    await setup();
    const update = screen.getByText('Check for updates').closest('button') as HTMLElement;

    const { during, after } = hoverCycle(update, 'borderColor');

    expect(during).toBe('rgba(255, 255, 255, 0.2)');
    expect(after).toBe('rgba(255, 255, 255, 0.1)');
  });
});
