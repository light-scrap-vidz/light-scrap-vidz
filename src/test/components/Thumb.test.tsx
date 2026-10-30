import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { Thumb } from '@/components/Thumb';

beforeEach(() => vi.clearAllMocks());

describe('Thumb', () => {
  it('points at the app scheme, never at the remote host', () => {
    render(<Thumb src="https://cdn.example/a.jpg?x=1" alt="clip" platform="youtube" />);

    expect(screen.getByAltText('clip')).toHaveAttribute(
      'src',
      'thumb://localhost/https%3A%2F%2Fcdn.example%2Fa.jpg%3Fx%3D1',
    );
  });

  it('makes no IPC call: the bytes come through the scheme', () => {
    render(<Thumb src="https://cdn.example/a.jpg" alt="clip" platform="instagram" />);

    expect(invoke).not.toHaveBeenCalled();
  });

  it('shows the placeholder when the image fails, and stays there', () => {
    const { container, rerender } = render(
      <Thumb src="https://cdn.example/a.jpg" alt="clip" platform="instagram" />,
    );

    fireEvent.error(screen.getByAltText('clip'));
    rerender(<Thumb src="https://cdn.example/a.jpg" alt="clip" platform="instagram" />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('tries again with a different source after a failure', () => {
    const { rerender } = render(
      <Thumb src="https://cdn.example/a.jpg" alt="clip" platform="youtube" />,
    );
    fireEvent.error(screen.getByAltText('clip'));

    rerender(<Thumb src="https://cdn.example/b.jpg" alt="clip" platform="youtube" />);

    expect(screen.getByAltText('clip')).toHaveAttribute(
      'src',
      'thumb://localhost/https%3A%2F%2Fcdn.example%2Fb.jpg',
    );
  });

  it('shows the placeholder without a source', () => {
    const { container } = render(<Thumb src="" alt="clip" platform="youtube" />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('lazy-loads when asked to', () => {
    render(<Thumb src="https://cdn.example/a.jpg" alt="clip" platform="youtube" lazy />);

    expect(screen.getByAltText('clip')).toHaveAttribute('loading', 'lazy');
  });
});
