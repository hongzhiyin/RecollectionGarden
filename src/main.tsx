import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BridgeProvider } from './external/BridgeProvider';
import { installFrameFallback } from './pdf/frameFallback';
import './styles/tokens.css';
import './styles/library.css';
import './styles/dialogs.css';

installFrameFallback(window);
createRoot(document.getElementById('root')!).render(<StrictMode><BridgeProvider><App /></BridgeProvider></StrictMode>);
