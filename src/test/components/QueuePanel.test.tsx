import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueuePanel } from '@/components/QueuePanel';
import type { QueueItem } from '@/types';

const item = (over: Partial<QueueItem> = {}): QueueItem => ({
  id: '1',
  url: 'https://youtu.be/a',
  outputDir: '/out',
  quality: 'best',
  audioOnly: false,
  playlistEnd: null,
  cookiesBrowser: null,
  status: 'pending',
  ...over,
});

function setup(items: QueueItem[] = []) {
  const onAddUrls = vi.fn();
  const onRemoveItem = vi.fn();
  render(
    <QueuePanel
      items={items}
      onAddUrls={onAddUrls}
      onRemoveItem={onRemoveItem}
      onClearDone={vi.fn()}
      onClearAll={vi.fn()}
    />,
  );
  return { onAddUrls, onRemoveItem };
}

const textarea = () => screen.getByPlaceholderText('Paste one or more links, one per line…');
const addButton = () => screen.getByRole('button', { name: /Add to queue/ });

describe('QueuePanel — adding URLs', () => {
  it('keeps the add button disabled while the box is empty', () => {
    setup();
    expect(addButton()).toBeDisabled();
  });

  it('enables the add button once something is typed', () => {
    setup();
    fireEvent.change(textarea(), { target: { value: 'https://youtu.be/a' } });
    expect(addButton()).toBeEnabled();
  });

  it('splits on newlines, spaces and commas', () => {
    const { onAddUrls } = setup();
    fireEvent.change(textarea(), {
      target: { value: 'https://a\nhttps://b, https://c' },
    });

    fireEvent.click(addButton());

    expect(onAddUrls).toHaveBeenCalledWith(['https://a', 'https://b', 'https://c']);
  });

  it('drops anything that is not an http link', () => {
    const { onAddUrls } = setup();
    fireEvent.change(textarea(), { target: { value: 'notaurl\nhttps://good\nftp://nope' } });

    fireEvent.click(addButton());

    expect(onAddUrls).toHaveBeenCalledWith(['https://good']);
  });

  it('clears the box after a successful add', () => {
    setup();
    fireEvent.change(textarea(), { target: { value: 'https://a' } });

    fireEvent.click(addButton());

    expect(textarea()).toHaveValue('');
  });

  it('adds nothing when no line looks like a link', () => {
    const { onAddUrls } = setup();
    fireEvent.change(textarea(), { target: { value: 'just some words' } });

    fireEvent.click(addButton());

    expect(onAddUrls).not.toHaveBeenCalled();
    expect(textarea()).toHaveValue('just some words');
  });

  it('highlights the box while it has focus', () => {
    setup();
    fireEvent.focus(textarea());
    expect(textarea()).toHaveStyle({ borderColor: '#C9F25E' });

    fireEvent.blur(textarea());
    expect(textarea()).not.toHaveStyle({ borderColor: '#C9F25E' });
  });
});

describe('QueuePanel — rows', () => {
  it('lists every queued URL', () => {
    setup([item(), item({ id: '2', url: 'https://youtu.be/b' })]);

    expect(screen.getByText('https://youtu.be/a')).toBeInTheDocument();
    expect(screen.getByText('https://youtu.be/b')).toBeInTheDocument();
  });

  it('offers a remove button on pending rows only', () => {
    setup([
      item({ id: '1', status: 'pending' }),
      item({ id: '2', status: 'downloading' }),
      item({ id: '3', status: 'done' }),
      item({ id: '4', status: 'error' }),
    ]);

    expect(screen.getAllByLabelText('Remove from queue')).toHaveLength(1);
  });

  it('reports which row was removed', () => {
    const { onRemoveItem } = setup([item({ id: 'x' })]);

    fireEvent.click(screen.getByLabelText('Remove from queue'));

    expect(onRemoveItem).toHaveBeenCalledWith('x');
  });

  it('draws a progress bar for the running row', () => {
    const { container } = render(
      <QueuePanel
        items={[item({ status: 'downloading', progress: 42 })]}
        onAddUrls={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearDone={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    const fill = container.querySelector('div[style*="width: 42%"]');
    expect(fill).toBeTruthy();
  });

  it('treats a missing progress value as zero', () => {
    const { container } = render(
      <QueuePanel
        items={[item({ status: 'downloading' })]}
        onAddUrls={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearDone={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(container.querySelector('div[style*="width: 0%"]')).toBeTruthy();
  });

  it('shows the reason on a failed row', () => {
    setup([item({ status: 'error', error: 'This video is private' })]);
    expect(screen.getByText('This video is private')).toBeInTheDocument();
  });

  it('shows no message for a failed row without a reason', () => {
    const { container } = render(
      <QueuePanel
        items={[item({ status: 'error' })]}
        onAddUrls={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearDone={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(container.querySelector('span[style*="FF8A8A"]')).toBeNull();
  });

  it('marks each status with its own icon', () => {
    const { container } = render(
      <QueuePanel
        items={[
          item({ id: '1', status: 'pending' }),
          item({ id: '2', status: 'downloading' }),
          item({ id: '3', status: 'done' }),
          item({ id: '4', status: 'error' }),
        ]}
        onAddUrls={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearDone={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(container.querySelector('.lsv-spin')).toBeTruthy();
    expect(container.querySelectorAll('svg[stroke="#C9F25E"]')).toHaveLength(1);
    expect(container.querySelectorAll('svg[stroke="#FF8A8A"]')).toHaveLength(1);
    expect(container.querySelectorAll('svg[stroke="#6F6960"]')).toHaveLength(1);
  });

  it('tints the remove button on hover and restores it on leave', () => {
    setup([item()]);
    const button = screen.getByLabelText('Remove from queue');

    fireEvent.mouseEnter(button);
    expect(button).toHaveStyle({ color: '#C2BCB2' });

    fireEvent.mouseLeave(button);
    expect(button).toHaveStyle({ color: '#5C574F' });
  });
});
