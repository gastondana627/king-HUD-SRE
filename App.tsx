import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { AdminStrike } from './components/AdminStrike';
import { RemediationHandler } from './components/RemediationHandler';

export const App = () => {
  useEffect(() => {
    console.log("KING-HUD_UI: RENDER_SUCCESSFUL");
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin/strike" element={<AdminStrike />} />
        <Route path="/remediate" element={<RemediationHandler />} />
        {/* Catch-all route to ensure Dashboard renders on any unknown path */}
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
};
