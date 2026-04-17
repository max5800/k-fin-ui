import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log(
  '%ck-fin',
  'color:#f4bd5f;font-size:20px;font-weight:bold;font-family:Manrope,sans-serif;letter-spacing:-0.02em',
);
console.log('%c🐠', 'font-size:14px');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
