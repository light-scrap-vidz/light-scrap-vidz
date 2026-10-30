import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LangProvider } from '@/lib/locale';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('shows a reload prompt instead of a blank screen when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('speaks the language of the interface', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('light-scrap-vidz:language', 'fr');
    render(
      <LangProvider>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </LangProvider>,
    );

    expect(screen.getByText('Un problème est survenu.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
    localStorage.clear();
  });
});
