import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyTheme, watchSystemTheme } from './lib/theme';
import './styles/index.css';

applyTheme();
watchSystemTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
