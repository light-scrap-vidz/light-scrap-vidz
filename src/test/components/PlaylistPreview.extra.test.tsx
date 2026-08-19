import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlaylistPreview } from '@/components/PlaylistPreview';
import type { PlaylistInfo } from '@/types';

const entries = [
  { url: 'https://youtu.be/a', title: 'First' },
  { url: 'https://youtu.be/b', title: 'Second' },
  { url: 'https://youtu.be/c', title: 'Third' },
];

const info = (over: Partial<PlaylistInfo> = {}) =>
  ({ title: 'My playlist', playlist_count: 3, entries, ...over }) as unknown as PlaylistInfo;

const YT = 'https://www.youtube.com/playlist?list=PL1';

function setup(props: Partial<Parameters<typeof PlaylistPreview>[0]> = {}) {
  const onSelectionChange = vi.fn();
  render(
    <PlaylistPreview
      info={info()}
      url={YT}
      selectedUrls={[]}
      onSelectionChange={onSelectionChange}
      {...props}
    />,
  );
  return { onSelectionChange };
}

describe('PlaylistPreview — selection', () => {
  it('adds an entry when its checkbox is ticked', () => {
    const { onSelectionChange } = setup();

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(onSelectionChange).toHaveBeenCalledWith(['https://youtu.be/a']);
  });

  it('removes an entry when its checkbox is unticked', () => {
    const { onSelectionChange } = setup({ selectedUrls: ['https://youtu.be/a', 'https://youtu.be/b'] });

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(onSelectionChange).toHaveBeenCalledWith(['https://youtu.be/b']);
  });

  it('reflects the current selection in the checkboxes', () => {
    setup({ selectedUrls: ['https://youtu.be/b'] });
    const boxes = screen.getAllByRole('checkbox');

    expect(boxes[0]).not.toBeChecked();
    expect(boxes[1]).toBeChecked();
    expect(boxes[2]).not.toBeChecked();
  });

  it('counts the selection in the header', () => {
    setup({ selectedUrls: ['https://youtu.be/a', 'https://youtu.be/b'] });
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('selects everything from the header button', () => {
    const { onSelectionChange } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(onSelectionChange).toHaveBeenCalledWith([
      'https://youtu.be/a',
      'https://youtu.be/b',
      'https://youtu.be/c',
    ]);
  });

  it('clears the selection once everything is picked', () => {
    const { onSelectionChange } = setup({ selectedUrls: entries.map((e) => e.url) });

    fireEvent.click(screen.getByRole('button', { name: 'None' }));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});

describe('PlaylistPreview — disabled', () => {
  it('reports nothing when an entry is clicked', () => {
    const { onSelectionChange } = setup({ disabled: true });

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('reports nothing from the header button', () => {
    const { onSelectionChange } = setup({ disabled: true });

    fireEvent.click(screen.getByRole('button'));

    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

describe('PlaylistPreview — entry list', () => {
  it('lists every entry title', () => {
    setup();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('falls back to the entry count when the playlist count is missing', () => {
    setup({ info: info({ playlist_count: null }) });
    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('copes with a playlist that has no entries at all', () => {
    setup({ info: info({ playlist_count: null, entries: undefined }) });
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('falls back to the unknown-platform styling for an unrecognised URL', () => {
    setup({ url: 'https://example.com/list' });
    expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
  });

  it('tints a row on hover and clears it on leave', () => {
    setup();
    const row = screen.getByText('First').closest('label')!;

    fireEvent.mouseEnter(row);
    expect(row).toHaveStyle({ background: 'rgba(255, 255, 255, 0.04)' });

    fireEvent.mouseLeave(row);
    expect(row).toHaveStyle({ background: 'transparent' });
  });

  it('leaves a selected row tinted on hover', () => {
    setup({ selectedUrls: ['https://youtu.be/a'] });
    const row = screen.getByText('First').closest('label')!;

    fireEvent.mouseEnter(row);

    expect(row).toHaveStyle({ background: 'rgba(201, 242, 94, 0.06)' });
  });
});
