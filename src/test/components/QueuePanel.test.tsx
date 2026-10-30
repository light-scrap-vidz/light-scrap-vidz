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

function setup(
  items: QueueItem[] = [],
  progress: Record<string, number> = {},
  added?: (urls: string[]) => number,
) {
  const onAddUrls = vi.fn(added ?? ((urls: string[]) => urls.length));
  const onRemoveItem = vi.fn();
  const onRetryItem = vi.fn();
  const onRetryFailed = vi.fn();
  const view = render(
    <QueuePanel
      items={items}
      progress={progress}
      onAddUrls={onAddUrls}
      onRemoveItem={onRemoveItem}
      onRetryItem={onRetryItem}
      onRetryFailed={onRetryFailed}
    />,
  );
  return { onAddUrls, onRemoveItem, onRetryItem, onRetryFailed, ...view };
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

  it('splits on newlines and spaces', () => {
    const { onAddUrls } = setup();
    fireEvent.change(textarea(), {
      target: { value: 'https://a\nhttps://b   https://c' },
    });

    fireEvent.click(addButton());

    expect(onAddUrls).toHaveBeenCalledWith(['https://a', 'https://b', 'https://c']);
  });

  it('keeps a comma that belongs to the link', () => {
    const { onAddUrls } = setup();
    fireEvent.change(textarea(), { target: { value: 'https://site.example/v?ids=1,2,3' } });

    fireEvent.click(addButton());

    expect(onAddUrls).toHaveBeenCalledWith(['https://site.example/v?ids=1,2,3']);
  });

  it('tells how many entries were ignored, invalid or already queued', () => {
    setup([], {}, () => 1);
    fireEvent.change(textarea(), { target: { value: 'https://a https://b nonsense' } });

    fireEvent.click(addButton());

    expect(screen.getByRole('status')).toHaveTextContent('2 links ignored');
  });

  it('says nothing when everything was added', () => {
    setup();
    fireEvent.change(textarea(), { target: { value: 'https://a https://b' } });

    fireEvent.click(addButton());

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('labels the box for assistive technology', () => {
    setup();
    expect(screen.getByRole('textbox', { name: 'Links to download' })).toBe(textarea());
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

  it('adds nothing when no entry looks like a link, and reports them', () => {
    const { onAddUrls } = setup();
    fireEvent.change(textarea(), { target: { value: 'just some words' } });

    fireEvent.click(addButton());

    expect(onAddUrls).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('3 links ignored');
  });

  it('takes its focus highlight from the shared CSS class', () => {
    setup();
    expect(textarea()).toHaveClass('lsv-field');
  });
});

describe('QueuePanel — rows', () => {
  it('lists every queued URL', () => {
    setup([item(), item({ id: '2', url: 'https://youtu.be/b' })]);

    expect(screen.getByText('https://youtu.be/a')).toBeInTheDocument();
    expect(screen.getByText('https://youtu.be/b')).toBeInTheDocument();
  });

  it('offers a remove button on pending and running rows only', () => {
    setup([
      item({ id: '1', status: 'pending' }),
      item({ id: '2', status: 'downloading' }),
      item({ id: '3', status: 'done' }),
      item({ id: '4', status: 'error' }),
    ]);

    expect(screen.getAllByLabelText('Remove from queue')).toHaveLength(2);
  });

  it('reports which row was removed', () => {
    const { onRemoveItem } = setup([item({ id: 'x' })]);

    fireEvent.click(screen.getByLabelText('Remove from queue'));

    expect(onRemoveItem).toHaveBeenCalledWith('x');
  });

  it('draws a progress bar for the running row', () => {
    const { container } = setup([item({ id: '9', status: 'downloading' })], { '9': 42 });

    expect(container.querySelector('div[style*="width: 42%"]')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  });

  it('treats a missing progress value as zero', () => {
    const { container } = setup([item({ status: 'downloading' })]);

    expect(container.querySelector('div[style*="width: 0%"]')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows the known title instead of the raw link', () => {
    setup([item({ title: 'Episode 1' })]);

    expect(screen.getByText('Episode 1')).toBeInTheDocument();
    expect(screen.queryByText('https://youtu.be/a')).toBeNull();
  });

  it('shows the reason on a failed row, translated', () => {
    setup([item({ status: 'error', error: 'err.private' })]);
    expect(screen.getByText('This video is private.')).toBeInTheDocument();
  });

  it('shows no message for a failed row without a reason', () => {
    const { container } = setup([item({ status: 'error' })]);

    expect(container.querySelector('.text-danger')).toBeNull();
  });

  it('offers to retry a failed row, and only a failed one', () => {
    const { onRetryItem } = setup([
      item({ id: '1', status: 'error', error: 'err.private' }),
      item({ id: '2', status: 'pending' }),
      item({ id: '3', status: 'done' }),
    ]);

    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryItem).toHaveBeenCalledWith('1');
  });

  it('offers to retry every failure at once when there are some', () => {
    const { onRetryFailed } = setup([item({ id: '1', status: 'error' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Retry failed' }));

    expect(onRetryFailed).toHaveBeenCalled();
  });

  it('does not offer a global retry when nothing failed', () => {
    setup([item({ status: 'pending' })]);

    expect(screen.queryByRole('button', { name: 'Retry failed' })).toBeNull();
  });

  it('marks each status with its own icon', () => {
    const { container } = setup([
      item({ id: '1', status: 'pending' }),
      item({ id: '2', status: 'downloading' }),
      item({ id: '3', status: 'done' }),
      item({ id: '4', status: 'error' }),
    ]);

    expect(container.querySelector('.lsv-spin')).toBeTruthy();
    expect(container.querySelectorAll('svg[stroke="var(--accent)"]')).toHaveLength(1);
    expect(container.querySelectorAll('svg[stroke="var(--danger)"]')).toHaveLength(1);
    expect(container.querySelectorAll('svg[stroke="var(--text-secondary)"]')).toHaveLength(1);
  });
});
