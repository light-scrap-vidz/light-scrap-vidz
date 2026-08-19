import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getT, keysOf, LANGUAGES } from '@/lib/i18n';
import { LangProvider, loadLang, saveLang, useLang, useT } from '@/lib/locale';
import { SettingsButton } from '@/components/SettingsButton';
import { UrlInput } from '@/components/UrlInput';

vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(invoke).mockResolvedValue('deb');
  vi.mocked(getVersion).mockResolvedValue('0.2.15');
});

describe('the saved language', () => {
  it('starts in English on a machine that has never chosen', () => {
    expect(loadLang()).toBe('en');
  });

  it('comes back on the next launch', () => {
    saveLang('fr');

    expect(loadLang()).toBe('fr');
  });

  it('ignores a language the app does not speak', () => {
    localStorage.setItem('light-scrap-vidz:language', 'klingon');

    expect(loadLang()).toBe('en');
  });
});

describe('the dictionary', () => {
  it('says the same things in both languages', () => {
    // Une clé traduite d'un seul côté retomberait silencieusement sur l'anglais,
    // ce qui donne une interface à moitié traduite plutôt qu'une erreur visible.
    expect(keysOf('fr').sort()).toEqual(keysOf('en').sort());
  });

  it('leaves no translation empty', () => {
    for (const lang of LANGUAGES) {
      const t = getT(lang);
      for (const key of keysOf(lang)) {
        expect(t(key).trim(), `${lang}/${key}`).not.toBe('');
      }
    }
  });

  it('keeps the placeholders on both sides', () => {
    const withVars = keysOf('en').filter((k) => /\{\w+\}/.test(getT('en')(k)));
    expect(withVars.length).toBeGreaterThan(0);

    for (const key of withVars) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(getT('fr')(key)), key).toEqual(vars(getT('en')(key)));
    }
  });

  it('leaves an unknown key untouched, which is what carries raw yt-dlp errors through', () => {
    expect(getT('fr')('ERROR: something new')).toBe('ERROR: something new');
  });

  it('fills in the placeholders', () => {
    expect(getT('en')('preview.videos', { count: 12 })).toBe('12 videos');
    expect(getT('fr')('preview.videos', { count: 12 })).toBe('12 vidéos');
  });
});

function Probe() {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <div>
      <span>{t('tab.recent')}</span>
      <span data-testid="lang">{lang}</span>
      <button onClick={() => setLang('fr')}>go fr</button>
    </div>
  );
}

describe('switching language', () => {
  it('renders in English by default', () => {
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );

    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('picks up the language saved at the previous launch', () => {
    saveLang('fr');

    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );

    expect(screen.getByText('Récents')).toBeInTheDocument();
  });

  it('redraws immediately, without waiting for a restart', () => {
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'go fr' }));

    expect(screen.getByText('Récents')).toBeInTheDocument();
  });

  it('writes the choice down for next time', () => {
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'go fr' }));

    expect(loadLang()).toBe('fr');
  });

  it('tells the page which language it is in', () => {
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'go fr' }));

    expect(document.documentElement.lang).toBe('fr');
  });
});

describe('the language control in the settings panel', () => {
  async function openSettings() {
    const view = render(
      <LangProvider>
        <SettingsButton
          open
          onClose={() => {}}
          outputDir="/home/me/Videos"
          onOutputDirChange={() => {}}
          cookiesBrowser={null}
          onCookiesBrowserChange={() => {}}
          detectedBrowsers={['firefox']}
        />
      </LangProvider>,
    );
    // le panneau lit sa version en arrière-plan : laisser la promesse retomber
    await act(async () => {});
    return view;
  }

  it('offers both languages', async () => {
    await openSettings();

    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Français' })).toBeInTheDocument();
  });

  it('translates the panel itself when French is picked', async () => {
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Français' }));

    expect(screen.getByText('Réglages')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('remembers the choice', async () => {
    await openSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Français' }));

    expect(loadLang()).toBe('fr');
  });

  it('reaches the rest of the app, not just the panel', () => {
    render(
      <LangProvider>
        <UrlInput onSubmit={() => {}} isLoading={false} />
      </LangProvider>,
    );

    expect(screen.getByPlaceholderText('Paste a video link…')).toBeInTheDocument();
  });

  it('shows the running version', async () => {
    await openSettings();

    expect(await screen.findByText('v0.2.15')).toBeInTheDocument();
  });
});
