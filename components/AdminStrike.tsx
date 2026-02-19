import React, { useState, useEffect, useContext } from 'react';
import { ShieldAlert, Terminal, Skull, AlertTriangle, Fingerprint, ArrowLeft, Hourglass } from 'lucide-react';
import { TrafficContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { INITIAL_HOLD_TIME } from '../constants';

export const AdminStrike = () => {
  const [authorized, setAuthorized] = useState(false);
  const [secret, setSecret] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isStriking, setIsStriking] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const navigate = useNavigate();

  // Consume Context
  const { triggerStrike, isAgentBusy } = useContext(TrafficContext);

  // Global ESC Listener for Navigation
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [navigate]);

  // Sync Timer with Agent Busy State
  useEffect(() => {
      if (isAgentBusy && timer === null) {
          // Sync with the Forensic Window (180s)
          setTimer(INITIAL_HOLD_TIME);
      } else if (!isAgentBusy) {
          setTimer(null);
      }
  }, [isAgentBusy]);

  // Listen for Global Clear Event (Cross-Console Sync)
  useEffect(() => {
    const channel = new BroadcastChannel('king_hud_c2_channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'STRIKE_CLEARED_GLOBAL') {
         setIsStriking(false);
         setTimer(null); // Clear timer immediately
         addLog("[SYSTEM]: REMEDIATION CONFIRMED BY SENTINEL FAIL-SAFE.");
      }
    };
    return () => channel.close();
  }, []);

  // Countdown Interval
  useEffect(() => {
      if (timer === null) return;
      const interval = setInterval(() => {
          setTimer(t => (t !== null && t > 0 ? t - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
  }, [timer]);

  // Format MM:SS
  const formatTime = (sec: number | null) => {
      if (sec === null) return "00:00";
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
  };

  // Check secret against environment or default
  const checkAuth = () => {
    const validSecret = process.env.ADMIN_SECRET || 'KING_PASS_2026'; 
    if (secret === validSecret) {
      setAuthorized(true);
      addLog("IDENTITY CONFIRMED. WELCOME, OPERATIVE.");
    } else {
      addLog("ACCESS DENIED. BIOMETRICS LOGGED.");
      setSecret('');
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  const handleStrike = () => {
    setIsStriking(true);
    
    if (isAgentBusy) {
        addLog("[TRAFFIC_CONTROL]: SYSTEM_RECOVERING. STRIKE_QUEUED.");
    } else {
        addLog("INITIATING REMOTE ZOMBIE STRIKE PROTOCOL...");
    }
    
    // Call Context Trigger which handles Queueing if Busy
    triggerStrike("ADMIN_REMOTE_STRIKE");
    
    setTimeout(() => {
        if (!isAgentBusy) {
            addLog("SIGNAL SENT. TARGET NODES INFECTED.");
            addLog("[STRIKE]: ADVERSARY_PAYLOAD_DEPLOYED.");
            addLog("AUDIT TRAIL: SOURCE: ADMIN_REMOTE_STRIKE");
        }
        setIsStriking(false);
    }, 5000); // 5 Seconds visual feedback to match the pulse
  };

  const ExitButton = () => (
    <button 
      onClick={() => navigate('/')}
      className="absolute top-4 left-4 z-50 flex items-center justify-center gap-2 p-2 rounded font-bold transition-all bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-mono uppercase tracking-widest backdrop-blur-md hover:bg-emerald-900/20 hover:border-emerald-500/50"
    >
      <ArrowLeft size={14} />
      [[ EXIT_TO_DASHBOARD ]]
    </button>
  );

  // --------------------------------------------------------------------------
  // SENTINEL 404 / ACCESS CONTROL SCREEN
  // --------------------------------------------------------------------------
  if (!authorized) {
    return (
      <div className="min-h-screen bg-black text-[#444] font-mono flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <ExitButton />
        {/* Background Noise */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url(https://www.transparenttextures.com/patterns/dark-matter.png)' }}></div>
        
        <div className="max-w-md w-full border-t-4 border-red-900 bg-gray-900/50 p-12 text-center relative z-10 backdrop-blur-sm">
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black px-4">
                <Skull className="w-12 h-12 text-red-900 animate-pulse" />
            </div>
            
            <h1 className="text-4xl font-black tracking-tighter text-gray-200 mb-2">404</h1>
            <h2 className="text-xs tracking-[0.3em] text-red-800 uppercase mb-8">Sentinel Security :: Access Violation</h2>

            <div className="text-left space-y-4 font-mono text-sm text-gray-500 mb-8">
                <p>&gt; ROUTE: /admin/strike</p>
                <p>&gt; STATUS: <span className="text-red-800 font-bold bg-red-900/10 px-1">RESTRICTED</span></p>
                <p>&gt; TRACE: {Math.random().toString(36).substring(7).toUpperCase()}</p>
            </div>

            <div className="relative group">
                <input 
                    type="password" 
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="OVERRIDE_KEY"
                    className="w-full bg-black border border-gray-800 text-red-500 p-3 outline-none focus:border-red-900 text-center tracking-widest placeholder-gray-800 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && checkAuth()}
                    autoComplete="off"
                />
                <Fingerprint className="absolute right-3 top-3 w-5 h-5 text-gray-800 group-focus-within:text-red-900 transition-colors" />
            </div>

            <button 
                onClick={checkAuth}
                className="mt-4 w-full py-2 bg-transparent hover:bg-red-950/30 text-gray-600 hover:text-red-500 text-xs border border-transparent hover:border-red-900/50 transition-all uppercase tracking-widest"
            >
                Authenticate Sentinel
            </button>
        </div>
        
        <div className="absolute bottom-4 text-[10px] text-gray-800 uppercase tracking-[0.2em]">
            King-HUD Security Layer v9.0.1
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RED CONSOLE / STRIKE INTERFACE
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#050000] text-red-600 font-mono overflow-hidden flex flex-col relative">
        <ExitButton />
        {/* CRT Scanline Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] z-[50] bg-[length:100%_2px,3px_100%] pointer-events-none"></div>

        {/* Top Bar */}
        <div className="flex justify-between items-center p-4 border-b border-red-900/50 bg-red-950/10 backdrop-blur-md pl-40 md:pl-4">
            {/* Added padding-left for mobile to accommodate absolute button, though md layout handles absolute better usually */}
            <div className="flex items-center gap-3 ml-0 md:ml-32 lg:ml-0">
                <Terminal className="w-6 h-6 text-red-500" />
                <h1 className="text-2xl font-display font-bold tracking-widest text-red-500">
                    C2_RED_CONSOLE <span className="text-xs align-top opacity-50">v1.0</span>
                </h1>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold tracking-widest">
                <span className="flex items-center gap-2">
                    STATUS: 
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                    ONLINE
                </span>
                <span className="opacity-50">ENCRYPTION: AES-256</span>
            </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 relative z-10">
            
            {/* Strike Controls (Center Stage) */}
            <div className="flex-1 border-2 border-red-900/30 bg-black/50 rounded-lg p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"></div>
                
                {/* Status Indicator */}
                <div className="absolute top-4 right-4 flex flex-col items-end">
                    <div className="text-[10px] tracking-widest opacity-70 mb-1">WEAPON STATUS</div>
                    <div className={`text-xl font-display font-bold ${isAgentBusy ? 'text-amber-500' : 'text-red-500'} animate-[pulse_0.2s_ease-in-out_infinite]`}>
                        {isAgentBusy ? 'STRIKE_QUEUED' : 'STRIKE_READY'}
                    </div>
                </div>

                <div className="mb-12 text-center space-y-2">
                    <AlertTriangle className="w-24 h-24 text-red-600 mx-auto mb-6 opacity-80" />
                    <h2 className="text-4xl font-display font-bold text-white tracking-widest">GCP-NODE-04</h2>
                    <p className="text-red-400 font-bold tracking-wider">TARGET LOCKED</p>
                </div>

                <button 
                    onClick={handleStrike}
                    disabled={isStriking || (isAgentBusy && isStriking)}
                    className={`relative w-64 h-64 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300
                    ${isStriking || isAgentBusy
                        ? 'bg-red-900/50 border-red-800 scale-95 opacity-80' 
                        : 'bg-transparent border-red-600 hover:bg-red-950/30 hover:shadow-[0_0_50px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95 cursor-pointer'
                    }`}
                >
                    {isAgentBusy ? (
                        <>
                            <Hourglass className="w-16 h-16 mb-2 text-amber-500 animate-pulse" />
                            <span className="text-2xl font-mono font-bold text-amber-400">{formatTime(timer)}</span>
                        </>
                    ) : (
                        <ShieldAlert className={`w-16 h-16 mb-4 transition-transform duration-200 ${isStriking ? 'animate-spin' : ''}`} />
                    )}
                    
                    <span className="text-xl font-bold tracking-widest text-center px-4 mt-2">
                        {isStriking 
                            ? (isAgentBusy ? 'QUEUEING...' : 'DEPLOYING...') 
                            : (isAgentBusy ? 'STRIKE ACTIVE' : '[[INITIATE_REMOTE_ZOMBIE_STRIKE]]')}
                    </span>
                    <span className="text-xs mt-1 opacity-70">
                        {isAgentBusy ? 'PAYLOAD DEPLOYED' : 'ZOMBIE PAYLOAD'}
                    </span>
                </button>
            </div>

            {/* Live Logs (Side Panel) */}
            <div className="w-full md:w-1/3 border border-red-900/30 bg-black p-4 font-mono text-xs flex flex-col">
                <h3 className="text-red-400 border-b border-red-900/30 pb-2 mb-2 uppercase tracking-widest">
                    Operational Log
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2 text-red-300/80">
                    {logs.map((log, i) => (
                        <div key={i} className="border-l-2 border-red-900 pl-2 py-1 hover:bg-red-950/20">
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div className="opacity-30 italic">System Idle... Waiting for Command.</div>}
                </div>
            </div>
        </div>
        
        {/* Footer */}
        <div className="p-2 bg-red-950/20 text-center text-[10px] text-red-900 uppercase tracking-[0.3em]">
            Authorized Use Only // Monitoring Active // King-HUD Red Cell
        </div>
    </div>
  );
};