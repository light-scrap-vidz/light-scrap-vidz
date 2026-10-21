import { Component, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Keeps a render error from leaving a blank window: offers a reload instead. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        style={{ padding: 24, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ fontWeight: 700 }}>Something went wrong.</div>
        <button
          onClick={() => window.location.reload()}
          style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    );
  }
}
