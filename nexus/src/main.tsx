import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted so NEXUS keeps working with no network. Inter carries the UI,
// JetBrains Mono carries every number, ID, time and log line.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

// Global styles first, so component stylesheets layer on top of the reset.
import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';

import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('NEXUS could not find #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
