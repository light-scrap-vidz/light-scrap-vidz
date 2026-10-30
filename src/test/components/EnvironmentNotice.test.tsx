import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EnvironmentNotice } from '@/components/EnvironmentNotice';

describe('EnvironmentNotice', () => {
  it('renders nothing when nothing is missing', () => {
    const { container } = render(<EnvironmentNotice warnings={[]} onDismiss={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('explains what is missing and what it breaks', () => {
    render(<EnvironmentNotice warnings={['ffmpeg', 'jsRuntime']} onDismiss={vi.fn()} />);

    const [ffmpeg, js] = screen.getAllByRole('alert');
    expect(ffmpeg).toHaveTextContent('ffmpeg was not found');
    expect(ffmpeg).toHaveTextContent('MP3');
    expect(js).toHaveTextContent('No JavaScript runtime');
    expect(js).toHaveTextContent('YouTube');
  });

  it('dismisses one warning at a time', () => {
    const onDismiss = vi.fn();
    render(<EnvironmentNotice warnings={['ffmpeg', 'jsRuntime']} onDismiss={onDismiss} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[1]);

    expect(onDismiss).toHaveBeenCalledWith('jsRuntime');
  });
});
