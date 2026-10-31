import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';
import { registerServiceWorker } from './registerServiceWorker';
import { warmStudentGallery } from './lib/studentArchive';
import { startPerfObserver } from './lib/perf';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

registerServiceWorker();

// Pause the decorative background animation when the tab is hidden so a kiosk
// display that's asleep doesn't waste GPU on the particle-drift loop.
if (typeof document !== 'undefined') {
  const apply = () => document.body.classList.toggle('is-idle', document.hidden);
  apply();
  document.addEventListener('visibilitychange', apply);
}


// Idle-time preload of the student gallery thumbnails so the wall
// doesn'''t 8x flash empty on first navigation.
warmStudentGallery(2000, 12);
startPerfObserver(true);
