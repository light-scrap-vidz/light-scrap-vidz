import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { SettingsSheet } from '@/components/SettingsSheet';

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);

/** Per-command backend responses. */
let responses: Record<string, unknown>;

function setup(props: Partial<Parameters<typeof SettingsSheet>[0]> = {}) {
  const onClose = vi.fn();
  const onOutputDirChange = vi.fn();
  const onCookiesChoiceChange = vi.fn();
  const view = render(
    <SettingsSheet
      open
      onClose={onClose}
      outputDir="/home/me/Videos"
      onOutputDirChange={onOutputDirChange}
      cookiesChoice="none"
      onCookiesChoiceChange={onCookiesChoiceChange}
      detectedBrowsers={['firefox']}
      {...props}
    />,
  );
  return { onClose, onOutputDirChange, onCookiesChoiceChange, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  responses = {};
  mockInvoke.mockImplementation((command: string) =>
    command in responses
      ? Promise.resolve(responses[command])
      : Promise.reject(new Error(`unstubbed: ${command}`)),
  );
  mockOpen.mockResolvedValue(null);
});

describe('SettingsSheet — visibility', () => {
  it('renders nothing while closed', () => {
    const { container } = setup({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the panel when open', async () => {
    setup();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByLabelText('Close settings'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the overlay is clicked', async () => {
    const { onClose, container } = setup();
    const overlay = container.querySelector('div.inset-0');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SettingsSheet — output folder', () => {
  it('shows the current folder', async () => {
    setup();
    expect(screen.getByText('/home/me/Videos')).toBeInTheDocument();
  });

  it('reports a newly picked folder', async () => {
    mockOpen.mockResolvedValue('/home/me/Downloads');
    const { onOutputDirChange } = setup();

    fireEvent.click(screen.getByText('/home/me/Videos'));

    await waitFor(() => expect(onOutputDirChange).toHaveBeenCalledWith('/home/me/Downloads'));
  });

  it('reports nothing when the folder dialog is dismissed', async () => {
    const { onOutputDirChange } = setup();

    fireEvent.click(screen.getByText('/home/me/Videos'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalled());

    expect(onOutputDirChange).not.toHaveBeenCalled();
  });
});

describe('SettingsSheet — notification toggle', () => {
  it('starts on and flips when clicked', async () => {
    setup();
    const toggle = screen.getByRole('switch', { name: 'Toggle notification' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('light-scrap-vidz:notify')).toBe('off');
  });
});

describe('SettingsSheet — browser cookies', () => {
  it('offers Auto, None and only the detected browsers', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Auto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Firefox' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chrome' })).not.toBeInTheDocument();
  });

  it('reports the picked browser', async () => {
    const { onCookiesChoiceChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Firefox' }));
    expect(onCookiesChoiceChange).toHaveBeenCalledWith('firefox');
  });
});

describe('SettingsSheet — as a dialog', () => {
  it('is announced as a modal dialog named by its title', async () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'Settings' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves the focus inside when it opens', async () => {
    setup();

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('keeps Tab and Shift+Tab inside the panel', async () => {
    setup();
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled)'));
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape', async () => {
    const { onClose } = setup();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('gives the focus back to what had it before', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const view = setup();

    view.rerender(
      <SettingsSheet
        open={false}
        onClose={vi.fn()}
        outputDir=""
        onOutputDirChange={vi.fn()}
        cookiesChoice="none"
        onCookiesChoiceChange={vi.fn()}
        detectedBrowsers={[]}
      />,
    );

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
