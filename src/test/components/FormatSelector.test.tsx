import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FormatSelector } from '@/components/FormatSelector';

function setup(props: Partial<Parameters<typeof FormatSelector>[0]> = {}) {
  const onAudioOnlyChange = vi.fn();
  const onQualityChange = vi.fn();
  render(
    <FormatSelector
      audioOnly={false}
      onAudioOnlyChange={onAudioOnlyChange}
      quality="best"
      onQualityChange={onQualityChange}
      {...props}
    />,
  );
  return { onAudioOnlyChange, onQualityChange };
}

describe('FormatSelector — format toggle', () => {
  it('offers a video and an audio segment', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Video · MP4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Audio · MP3' })).toBeInTheDocument();
  });

  it('highlights the video segment when audio is off', () => {
    setup({ audioOnly: false });
    expect(screen.getByRole('button', { name: 'Video · MP4' })).toHaveStyle({
      background: '#C9F25E',
    });
  });

  it('highlights the audio segment when audio is on', () => {
    setup({ audioOnly: true });
    expect(screen.getByRole('button', { name: 'Audio · MP3' })).toHaveStyle({
      background: '#C9F25E',
    });
  });

  it('reports the switch to audio', () => {
    const { onAudioOnlyChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Audio · MP3' }));
    expect(onAudioOnlyChange).toHaveBeenCalledWith(true);
  });

  it('reports the switch back to video', () => {
    const { onAudioOnlyChange } = setup({ audioOnly: true });
    fireEvent.click(screen.getByRole('button', { name: 'Video · MP4' }));
    expect(onAudioOnlyChange).toHaveBeenCalledWith(false);
  });
});

describe('FormatSelector — quality row', () => {
  it('is shown for video downloads', () => {
    setup({ audioOnly: false });
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Video · MP4',
      'Audio · MP3',
      'Best',
      '1080p',
      '720p',
      '480p',
    ]);
  });

  it('is hidden for audio-only downloads', () => {
    setup({ audioOnly: true });
    expect(screen.queryByText('Quality')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1080p' })).not.toBeInTheDocument();
  });

  it('highlights the active quality', () => {
    setup({ quality: '720p' });
    expect(screen.getByRole('button', { name: '720p' })).toHaveStyle({ background: '#C9F25E' });
    expect(screen.getByRole('button', { name: 'Best' })).toHaveStyle({ background: '#211F1B' });
  });

  it.each(['best', '1080p', '720p', '480p'] as const)('reports the %s choice', (quality) => {
    const { onQualityChange } = setup();
    const label = quality === 'best' ? 'Best' : quality;
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onQualityChange).toHaveBeenCalledWith(quality);
  });
});

describe('FormatSelector — disabled', () => {
  it('disables every control', () => {
    setup({ disabled: true });
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });

  it('reports nothing while disabled', () => {
    const { onAudioOnlyChange, onQualityChange } = setup({ disabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'Audio · MP3' }));
    fireEvent.click(screen.getByRole('button', { name: '720p' }));

    expect(onAudioOnlyChange).not.toHaveBeenCalled();
    expect(onQualityChange).not.toHaveBeenCalled();
  });
});
