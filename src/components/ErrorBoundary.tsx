import { Component, type ReactNode } from 'react';
import { useT } from '@/lib/locale';

interface State {
  failed: boolean;
}

function Fallback() {
  const t = useT();
  return (
    <div role="alert" className="p-[24px] text-fg flex flex-col gap-[12px]">
      <div className="font-[700]">{t('boundary.title')}</div>
      <button
        onClick={() => window.location.reload()}
        className="[align-self:flex-start] [padding:8px_16px] rounded-[8px] cursor-pointer"
      >
        {t('boundary.reload')}
      </button>
    </div>
  );
}

/** Keeps a render error from leaving a blank window: offers a reload instead. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}
