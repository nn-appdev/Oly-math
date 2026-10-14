import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './features/auth/AuthProvider';
import { envResult } from './lib/env';
import { ConfigErrorPage } from './pages/SimplePages';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemen #root tidak ditemukan');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      {envResult.ok ? (
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      ) : (
        <ConfigErrorPage issues={envResult.issues} />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
