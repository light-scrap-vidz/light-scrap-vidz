import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LangProvider, loadLang } from './lib/locale';
import './index.css';

document.documentElement.lang = loadLang();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </React.StrictMode>,
);
