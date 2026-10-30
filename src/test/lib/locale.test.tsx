import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getT, keysOf, LANGUAGES } from '@/lib/i18n';
import { LangProvider, loadLang, saveLang, useLang, useT } from '@/lib/locale';
import App from '@/App';
import { entry, lastMenu } from '../menuTestHelpers';
import { Root } from '@/Root';
import { UrlBox } from '../wrappers';

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

describe('the language entries of the Help menu', () => {
  async function openApp() {
    const view = render(
      <LangProvider>
        <Root>
          <App />
        </Root>
      </LangProvider>,
    );
    await act(async () => {});
    return view;
  }

  it('offers both languages, the current one checked', async () => {
    await openApp();

    const language = entry('Help', 'Language');
    expect(language.items?.map((i) => [i.text, i.checked])).toEqual([
      ['English', true],
      ['Français', false],
    ]);
  });

  it('translates the app, and the menu itself, when French is picked', async () => {
    await openApp();

    await act(async () => entry('Help', 'Language').items?.[1].action?.());

    expect(screen.getByPlaceholderText('Collez un lien vidéo…')).toBeInTheDocument();
    expect(lastMenu().map((m) => m.text)).toEqual(['Fichier', 'Affichage', 'Aide']);
  });

  it('remembers the choice', async () => {
    await openApp();

    await act(async () => entry('Help', 'Language').items?.[1].action?.());

    expect(loadLang()).toBe('fr');
  });

  it('reaches the rest of the app, not just the menu', () => {
    render(
      <LangProvider>
        <UrlBox onSubmit={() => {}} isLoading={false} />
      </LangProvider>,
    );

    expect(screen.getByPlaceholderText('Paste a video link…')).toBeInTheDocument();
  });
});

describe('plural forms', () => {
  it('uses the singular for one item and the plural otherwise (English)', () => {
    const t = getT('en');
    expect(t('preview.videos', { count: 1 })).toBe('1 video');
    expect(t('preview.videos', { count: 2 })).toBe('2 videos');
    expect(t('preview.videos', { count: 0 })).toBe('0 videos');
  });

  it('treats zero as singular in French', () => {
    const t = getT('fr');
    expect(t('preview.videos', { count: 0 })).toBe('0 vidéo');
    expect(t('preview.videos', { count: 1 })).toBe('1 vidéo');
    expect(t('preview.videos', { count: 5 })).toBe('5 vidéos');
  });

  it('ignores the plural machinery when there is no numeric count', () => {
    expect(getT('en')('preview.videos', { count: 'many' })).toBe('many videos');
  });

  it('replaces every occurrence of a placeholder', () => {
    expect(getT('en')('{a}-{a}', { a: 'x' })).toBe('x-x');
  });
});
