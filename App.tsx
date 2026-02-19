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
  
  // PERSISTENCE LAYER: Initialize from storage or default to 11 (Legacy Baseline)
  const [remediationCount, setRemediationCount] = useState(() => {
      const saved = localStorage.getItem("king_hud_remediation_count");
      return saved ? parseInt(saved, 10) : 11;
  });
  
  const loggerRef = useRef<((msg: string) => void) | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    console.log("KING-HUD_UI: RENDER_SUCCESSFUL [SYSTEM_REFRESH_COMPLETE]");
    // FINAL SEAL: Purge Protocol Removed. State is now persistent.
    console.log("[SYSTEM]: NOMINAL_STATE_RESTORED");
  }, []);

  const registerLogger = (fn: (msg: string) => void) => {
    loggerRef.current = fn;
  };

  const incrementRemediationCount = () => {
      // DEBOUNCE: Prevent double-tap glitches
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setTimeout(() => { isProcessingRef.current = false; }, 5000);

      setRemediationCount(prev => {
          // CIRCUIT_BREAKER: Prevent further increments after sprint target
          if (prev >= 20) {
              console.log("[SYSTEM]: SPRINT_TARGET_REACHED. COUNTER_LOCKED.");
              return prev;
          }
          const next = prev + 1;
          localStorage.setItem("king_hud_remediation_count", next.toString());
          return next;
      });
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