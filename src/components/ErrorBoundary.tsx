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
      <div role="alert" className="p-[24px] text-fg flex flex-col gap-[12px]">
        <div className="font-[700]">Something went wrong.</div>
        <button
          onClick={() => window.location.reload()}
          className="[align-self:flex-start] [padding:8px_16px] rounded-[8px] cursor-pointer"
        >
          Reload
        </button>
      </div>
    );
  }
}
