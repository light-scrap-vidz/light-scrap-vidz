import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  // Same shape as the real helper on macOS/Linux: scheme://localhost/<encoded path>.
  convertFileSrc: vi.fn(
    (path: string, protocol = 'asset') => `${protocol}://localhost/${encodeURIComponent(path)}`,
  ),
}));

// No system folder in tests: the output folder stays empty unless a test provides one.
vi.mock('@tauri-apps/api/path', () => ({
  downloadDir: vi.fn(() => Promise.reject(new Error('no download dir in tests'))),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// The native menu bar and the window: recorded instead of built, so tests can read the menu
// the app installs and click its entries.
vi.mock('@tauri-apps/api/menu', () => {
  const make = (kind: string) => ({
    new: vi.fn(async (options: object) => ({ kind, ...options })),
  });
  return {
    Menu: { new: vi.fn(async (options: object) => ({ ...options, setAsAppMenu: vi.fn() })) },
    Submenu: make('submenu'),
    MenuItem: make('item'),
    CheckMenuItem: make('check'),
    PredefinedMenuItem: make('predefined'),
  };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setTheme: vi.fn(async () => {}),
    isFullscreen: vi.fn(async () => false),
    setFullscreen: vi.fn(async () => {}),
  }),
}));
