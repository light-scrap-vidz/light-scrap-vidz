import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { UrlInput } from '@/components/UrlInput';
import { UrlBox } from '../wrappers';

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ readText: vi.fn() }));

const mockReadText = vi.mocked(readText);

const input = () => screen.getByRole('textbox', { name: /video url/i });
const fetchButton = () => screen.getByRole('button', { name: /fetch info/i });
const pasteButton = () => screen.getByRole('button', { name: /paste from clipboard/i });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UrlInput — submitting', () => {
  it('sends the trimmed URL on Enter', () => {
    const onSubmit = vi.fn();
    render(<UrlBox onSubmit={onSubmit} isLoading={false} />);

    fireEvent.change(input(), { target: { value: '  https://youtu.be/a  ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('https://youtu.be/a');
  });

  it('ignores other keys', () => {
    const onSubmit = vi.fn();
    render(<UrlBox onSubmit={onSubmit} isLoading={false} />);

    fireEvent.change(input(), { target: { value: 'https://youtu.be/a' } });
    fireEvent.keyDown(input(), { key: 'a' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does nothing when the box holds only whitespace', () => {
    const onSubmit = vi.fn();
    render(<UrlBox onSubmit={onSubmit} isLoading={false} />);

    fireEvent.change(input(), { target: { value: '   ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the fetch button disabled until something is typed', () => {
    render(<UrlBox onSubmit={vi.fn()} isLoading={false} />);
    expect(fetchButton()).toBeDisabled();

    fireEvent.change(input(), { target: { value: 'https://youtu.be/a' } });

    expect(fetchButton()).toBeEnabled();
  });
});

describe('UrlInput — clipboard', () => {
  it('fills the box with the trimmed clipboard text', async () => {
    mockReadText.mockResolvedValue('  https://youtu.be/pasted  ');
    render(<UrlBox onSubmit={vi.fn()} isLoading={false} />);

    fireEvent.click(pasteButton());

    await waitFor(() => expect(input()).toHaveValue('https://youtu.be/pasted'));
  });

  it('leaves the box alone when the clipboard is empty', async () => {
    mockReadText.mockResolvedValue('');
    render(<UrlBox onSubmit={vi.fn()} isLoading={false} />);

    fireEvent.click(pasteButton());
    await waitFor(() => expect(mockReadText).toHaveBeenCalled());

    expect(input()).toHaveValue('');
  });

  it('stays quiet when clipboard access is refused', async () => {
    mockReadText.mockRejectedValue(new Error('permission denied'));
    render(<UrlBox onSubmit={vi.fn()} isLoading={false} />);

    fireEvent.click(pasteButton());
    await waitFor(() => expect(mockReadText).toHaveBeenCalled());

    expect(input()).toHaveValue('');
  });
});

describe('UrlInput — busy and disabled states', () => {
  it('locks the controls while loading', () => {
    render(<UrlBox onSubmit={vi.fn()} isLoading />);
    expect(input()).toBeDisabled();
    expect(pasteButton()).toBeDisabled();
  });

  it('keeps what was typed when the loading starts', () => {
    const { rerender } = render(
      <UrlBox initial="https://youtu.be/a" onSubmit={vi.fn()} isLoading={false} />,
    );

    rerender(<UrlBox initial="https://youtu.be/a" onSubmit={vi.fn()} isLoading />);

    expect(input()).toHaveValue('https://youtu.be/a');
  });
});

describe('UrlInput — owned by its parent', () => {
  it('shows the value it is given and reports every edit', () => {
    const onChange = vi.fn();
    render(
      <UrlInput
        value="https://youtu.be/a"
        onChange={onChange}
        onSubmit={vi.fn()}
        isLoading={false}
      />,
    );

    expect(input()).toHaveValue('https://youtu.be/a');
    fireEvent.change(input(), { target: { value: 'https://youtu.be/ab' } });

    expect(onChange).toHaveBeenCalledWith('https://youtu.be/ab');
  });

  it('survives being remounted, because the text does not live in the component', () => {
    const first = render(
      <UrlInput
        value="https://youtu.be/a"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        isLoading={false}
      />,
    );
    first.unmount();

    render(<UrlInput value="https://youtu.be/a" onChange={vi.fn()} onSubmit={vi.fn()} isLoading />);

    expect(input()).toHaveValue('https://youtu.be/a');
  });
});

describe('UrlInput — supported platform chips', () => {
  it('lists the platforms when asked', () => {
    render(<UrlBox onSubmit={vi.fn()} isLoading={false} showTryChips />);

    expect(screen.getByText('Supports:')).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('Twitter / X')).toBeInTheDocument();
    expect(screen.getByText('Dailymotion')).toBeInTheDocument();
  });

  it('hides them by default', () => {
    render(<UrlBox onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.queryByText('Supports:')).not.toBeInTheDocument();
  });
});

describe('UrlInput — focus ring', () => {
  it('takes its focus highlight from the shared CSS class', () => {
    render(<UrlBox onSubmit={vi.fn()} isLoading={false} />);

    expect(input().parentElement).toHaveClass('lsv-field');
  });
});
