import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

// Set global Axios baseURL to VITE_API_URL (which can be blank in dev to use Vite proxy)
const rawApiUrl = import.meta.env.VITE_API_URL || '';
axios.defaults.baseURL = rawApiUrl;

// In production, when VITE_API_URL is set and calls are going directly to the backend,
// we must strip the "/api" prefix because the Go backend does not use it (e.g. Go backend routing is directly /auth/login)
if (rawApiUrl) {
  axios.interceptors.request.use((config) => {
    if (config.url && config.url.startsWith('/api')) {
      config.url = config.url.replace(/^\/api/, '');
    }
    return config;
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
