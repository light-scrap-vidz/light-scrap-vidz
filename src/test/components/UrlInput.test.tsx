import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UrlInput } from '@/components/UrlInput';

describe('UrlInput', () => {
  it('renders the input and action buttons', () => {
    render(<UrlInput onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('textbox', { name: /video url/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fetch info/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paste from clipboard/i })).toBeInTheDocument();
  });

  it('calls onSubmit when submit button clicked with a URL', async () => {
    const onSubmit = vi.fn();
    render(<UrlInput onSubmit={onSubmit} isLoading={false} />);
    const input = screen.getByRole('textbox', { name: /video url/i });
    await userEvent.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    fireEvent.click(screen.getByRole('button', { name: /fetch info/i }));
    expect(onSubmit).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('does not call onSubmit when input is empty', () => {
    const onSubmit = vi.fn();
    render(<UrlInput onSubmit={onSubmit} isLoading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /fetch info/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables input and buttons while loading', () => {
    render(<UrlInput onSubmit={vi.fn()} isLoading={true} />);
    expect(screen.getByRole('textbox', { name: /video url/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /fetch info/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /paste from clipboard/i })).toBeDisabled();
  });

  it('submits on Enter key', async () => {
    const onSubmit = vi.fn();
    render(<UrlInput onSubmit={onSubmit} isLoading={false} />);
    const input = screen.getByRole('textbox', { name: /video url/i });
    await userEvent.type(input, 'https://youtu.be/dQw4w9WgXcQ{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ');
  });
});
