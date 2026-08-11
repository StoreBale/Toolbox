import './style.css';
import { renderApp } from './app.js';
import { initializeAuth } from './auth.js';

await initializeAuth();
renderApp();
