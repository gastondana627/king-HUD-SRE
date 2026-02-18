import React, { useState } from 'react';
import { ShieldAlert, Terminal, Lock, Skull } from 'lucide-react';
import { logAuditEntry } from '../services/auditService';

export const AdminConsole = () => {
  const [authorized, setAuthorized] = useState(false);
  const [secret, setSecret] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const checkAuth = () => {
    // Vercel Ready: uses process.env.ADMIN_SECRET if available, with a fallback for the demo env
    const validSecret = process.env.ADMIN_SECRET || 'RED_SQUADRON_ALPHA'; 
    if (secret === validSecret) {
      setAuthorized(true);
      addLog("ACCESS GRANTED. WELCOME, COMMANDER.");
    } else {
      addLog("ACCESS DENIED. INCIDENT LOGGED.");
      setSecret('');
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const triggerStrike = () => {
    addLog("INITIATING REMOTE ZOMBIE STRIKE PROTOCOL...");
    
    // 1. Broadcast signal to Dashboard tabs
    const channel = new BroadcastChannel('king_hud_c2_channel');
    channel.postMessage({ type: 'TRIGGER_ZOMBIE' });
    
    // 2. Log Audit
    const mockMetrics = { timestamp: Date.now(), cpu: 0, ram: 0, threads: 0, ioWait: 0 };
    logAuditEntry(mockMetrics, true, true, "SOURCE: ADMIN_REMOTE_STRIKE", false); 
    
    setTimeout(() => {
        addLog("SIGNAL SENT. TARGET NODES INFECTED.");
        addLog("AUDIT TRAIL: SOURCE: ADMIN_REMOTE_STRIKE");
    }, 800);
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-black text-red-500 font-mono flex flex-col items-center justify-center p-4">
        <div className="border border-red-900 bg-red-950/20 p-8 rounded-lg max-w-md w-full shadow-[0_0_20px_rgba(220,38,38,0.2)]">
            <div className="flex justify-center mb-6">
                <Lock className="w-16 h-16 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-center mb-6 tracking-widest font-display">RESTRICTED ACCESS</h1>
            <input 
                type="password" 
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="ENTER ADMIN SECRET"
                className="w-full bg-black border border-red-800 text-red-500 p-3 mb-4 outline-none focus:border-red-500 text-center placeholder-red-900"
                onKeyDown={(e) => e.key === 'Enter' && checkAuth()}
            />
            <button 
                onClick={checkAuth}
                className="w-full bg-red-900/50 hover:bg-red-700 text-red-100 p-3 font-bold border border-red-800 transition-all uppercase tracking-wider"
            >
                Authenticate
            </button>
            <div className="mt-4 text-[10px] text-red-800 text-center">
                UNAUTHORIZED ACCESS IS A FEDERAL OFFENSE
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#33ff00] font-mono p-4 overflow-hidden">
        <div className="max-w-4xl mx-auto border border-[#33ff00]/30 h-[90vh] flex flex-col relative bg-gray-900/50 backdrop-blur shadow-[0_0_50px_rgba(51,255,0,0.1)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#33ff00]/50 animate-scan pointer-events-none"></div>
            
            {/* Header */}
            <div className="p-4 border-b border-[#33ff00]/30 flex justify-between items-center bg-black/80">
                <h1 className="text-xl font-bold tracking-[0.2em] flex items-center gap-2 font-display">
                    <Terminal className="w-5 h-5" />
                    C2_ADMIN_CONSOLE // <span className="text-red-500">RED_CELL</span>
                </h1>
                <div className="text-xs animate-pulse text-[#33ff00]">CONNECTION: SECURE (TOR_RELAY_ACTIVE)</div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center gap-12 relative">
                {/* Decoration */}
                <div className="absolute inset-0 pointer-events-none opacity-10" 
                     style={{ backgroundImage: 'radial-gradient(circle, #33ff00 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                </div>

                <div className="text-center space-y-2 relative z-10">
                    <Skull className="w-24 h-24 text-red-500 mx-auto mb-4 animate-pulse" />
                    <h2 className="text-3xl font-bold text-white tracking-widest font-display">TARGET: GCP-P100-NODE-04</h2>
                    <p className="text-red-400 font-bold">STATUS: VULNERABLE</p>
                </div>

                <button 
                    onClick={triggerStrike}
                    className="group relative px-12 py-8 bg-red-950/80 border-2 border-red-600 rounded overflow-hidden transition-all hover:bg-red-900 hover:scale-105 active:scale-95 hover:shadow-[0_0_50px_rgba(220,38,38,0.5)] z-20 cursor-pointer"
                >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
                    <div className="flex flex-col items-center gap-2">
                        <ShieldAlert className="w-8 h-8 text-white mb-2" />
                        <span className="relative z-10 text-2xl font-bold text-white tracking-widest group-hover:text-red-200 shadow-black drop-shadow-lg">
                            [INITIATE_REMOTE_ZOMBIE_STRIKE]
                        </span>
                    </div>
                </button>

                <div className="text-xs text-gray-500 mt-8 border-t border-gray-800 pt-4 w-full text-center">
                    WARNING: THIS ACTION WILL INJECT MALICIOUS KERNEL PARAMETERS INTO PRODUCTION NODES.
                </div>
            </div>

            {/* Logs Footer */}
            <div className="h-48 border-t border-[#33ff00]/30 bg-black p-4 font-mono text-sm overflow-y-auto">
                {logs.map((log, i) => (
                    <div key={i} className="mb-1 text-[#33ff00] opacity-80 border-l-2 border-[#33ff00]/50 pl-2">&gt; {log}</div>
                ))}
                <div className="animate-pulse text-[#33ff00]">_</div>
            </div>
        </div>
    </div>
  );
};