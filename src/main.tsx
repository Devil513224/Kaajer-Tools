import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register service worker safely; fail silently if blocked by preview iframe or browser privacy mode
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError: () => {
        // Silent fallback so the rest of the app continues working uninterrupted
      },
    });
  } catch {
    // Silent fallback
  }
}

createRoot(document.getElementById('root')!).render(<App />);
