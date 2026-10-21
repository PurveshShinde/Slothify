import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';

const apiBase = ((import.meta as any).env?.VITE_API_BASE || (import.meta as any).env?.VITE_API_URL || '').replace(/\/api\/?$/, '');
if (apiBase) {
  axios.defaults.baseURL = apiBase;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

