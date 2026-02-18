import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Verification Log for Cloud Run / Local Port
console.log(`[SYSTEM]: PORTAL_UPLINK_LISTENING_ON_PORT_${window.location.port || '80'}`);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root not found");
const root = createRoot(rootElement);

root.render(<App />);