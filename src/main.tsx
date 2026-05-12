import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ScatterController,
  LineController,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import './styles/global.css';
import './styles/print.css';
import { App } from './App.js';

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ScatterController,
  LineController,
  Tooltip,
  Legend,
  Filler,
);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
