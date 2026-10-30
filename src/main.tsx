import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LangProvider, loadLang } from './lib/locale';
import { Root } from './Root';
import './index.css';

document.documentElement.lang = loadLang();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <ErrorBoundary>
        <Root>
          <App />
        </Root>
      </ErrorBoundary>
    </LangProvider>
  </React.StrictMode>,
);
