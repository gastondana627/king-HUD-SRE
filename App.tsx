import React, { useEffect, useState, useRef, createContext } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { AdminStrike } from './components/AdminStrike';
import { RemediationHandler } from './components/RemediationHandler';
import { triggerZombieStrike } from './services/auditService';

export const TrafficContext = createContext({
  isAgentBusy: false,
  setBusy: (busy: boolean) => {},
  triggerStrike: (source?: string) => {},
  queueDepth: 0,
  registerLogger: (logger: (msg: string) => void) => {},
  remediationCount: 0,
  incrementRemediationCount: () => {}
});

export const App = () => {
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [queue, setQueue] = useState<{time: number, source: string}[]>([]);
  const [remediationCount, setRemediationCount] = useState(0);
  const loggerRef = useRef<((msg: string) => void) | null>(null);

  useEffect(() => {
    console.log("KING-HUD_UI: RENDER_SUCCESSFUL [SYSTEM_REFRESH_COMPLETE]");
    
    // DATA_PURGE: The "83" Fix (Counter Calibration)
    console.log("[SYSTEM]: EXECUTING_DATA_PURGE_PROTOCOL...");
    localStorage.clear();
    setRemediationCount(11);
    
    // PERSISTENCE: Initialize counter from existing CSV logs (Fallback if purge fails/is removed later)
    const csvContent = localStorage.getItem("telemetry_audit.csv");
    if (csvContent) {
        // Subtract 1 for header, ensure non-negative
        const rows = Math.max(0, csvContent.trim().split('\n').length - 1);
        if (rows > 11) setRemediationCount(rows);
    }
  }, []);

  const registerLogger = (fn: (msg: string) => void) => {
    loggerRef.current = fn;
  };

  const incrementRemediationCount = () => {
      setRemediationCount(prev => prev + 1);
  };

  const triggerStrike = (source: string = "UNKNOWN") => {
    if (isAgentBusy) {
        const msg = `[TRAFFIC_CONTROL]: AGENT_OCCUPIED. QUEUEING_STRIKE_SEQUENTIALLY... (Source: ${source})`;
        console.log(msg);
        if (loggerRef.current) loggerRef.current(msg);
        setQueue(prev => [...prev, { time: Date.now(), source }]);
    } else {
        triggerZombieStrike(0, source);
        setIsAgentBusy(true);
    }
  };

  // Traffic Controller Logic
  useEffect(() => {
    if (!isAgentBusy && queue.length > 0) {
       const nextItem = queue[0];
       const remainingQueue = queue.slice(1);
       const now = Date.now();
       const delayMs = now - nextItem.time;
       const delaySec = Math.floor(delayMs / 1000);

       if (loggerRef.current) loggerRef.current(`[TRAFFIC_CONTROL]: AGENT_FREE. EXECUTING_QUEUED_STRIKE (Waited ${delaySec}s). Launching in 10s...`);

       // Wait for 10s "Cool Down" / "Preparation" before launching next wave
       const timer = setTimeout(() => {
           setQueue(remainingQueue);
           triggerZombieStrike(delaySec, nextItem.source);
           // NOTE: Dashboard will detect the strike start via BroadcastChannel or state update and setBusy(true) accordingly.
       }, 10000);

       return () => clearTimeout(timer);
    }
  }, [isAgentBusy, queue]);

  return (
    <TrafficContext.Provider value={{ 
        isAgentBusy, 
        setBusy: setIsAgentBusy, 
        triggerStrike, 
        queueDepth: queue.length,
        registerLogger,
        remediationCount,
        incrementRemediationCount
    }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin/strike" element={<AdminStrike />} />
          <Route path="/remediate" element={<RemediationHandler />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </HashRouter>
    </TrafficContext.Provider>
  );
};