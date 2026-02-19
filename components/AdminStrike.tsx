import React, { useState, useEffect, useContext, useRef } from 'react';
import { ShieldAlert, Terminal, Skull, AlertTriangle, Fingerprint, ArrowLeft, Hourglass, Zap, Lock } from 'lucide-react';
import { TrafficContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { INITIAL_HOLD_TIME, FAILSAFE_GRACE_TIME } from '../constants';

export const AdminStrike = () => {
  const [authorized, setAuthorized] = useState(false);
  const [secret, setSecret] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isStriking, setIsStriking] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  
  // Phase Management: IDLE -> PHASE_1 (Forensic Hold) -> PHASE_2 (Sentinel Fail-Safe)
  const [phase, setPhase] = useState<'IDLE' | 'PHASE_1' | 'PHASE_2'>('IDLE');
  
  const [resolutionType, setResolutionType] = useState<string | null>(null);
  const navigate = useNavigate();

  // Timestamp Ref for Lag-Proof Calculation
  const strikeStartRef = useRef<number | null>(null);

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

  // Sync Timer Logic (Two-Phase Escalation)
  useEffect(() => {
      if (isAgentBusy) {
          // Initialize Start Time if new strike
          if (strikeStartRef.current === null) {
              strikeStartRef.current = Date.now();
              setPhase('PHASE_1');
          }

          const interval = setInterval(() => {
              if (!strikeStartRef.current) return;
              
              const now = Date.now();
              const elapsedSec = Math.floor((now - strikeStartRef.current) / 1000);
              
              // PHASE 1: Forensic Hold (0 - 180s)
              if (elapsedSec < INITIAL_HOLD_TIME) {
                  setPhase('PHASE_1');
                  setTimer(Math.max(0, INITIAL_HOLD_TIME - elapsedSec));
              } 
              // PHASE 2: Sentinel Fail-Safe (180s - 300s)
              else if (elapsedSec < (INITIAL_HOLD_TIME + FAILSAFE_GRACE_TIME)) {
                  if (phase !== 'PHASE_2') {
                      setPhase('PHASE_2');
                      addLog("[WARNING]: FORENSIC WINDOW EXPIRED. ESCALATING TO SENTINEL PROTOCOL.");
                  }
                  setTimer(Math.max(0, (INITIAL_HOLD_TIME + FAILSAFE_GRACE_TIME) - elapsedSec));
              } 
              // TIMEOUT
              else {
                  setTimer(0);
                  // Dashboard executes reset here
              }
          }, 1000);

          return () => clearInterval(interval);

      } else {
          // Reset State when agent becomes free
          setTimer(null);
          strikeStartRef.current = null;
          setPhase('IDLE');
      }
  }, [isAgentBusy, phase]);

  // Listen for Global Clear Event (Cross-Console Sync)
  useEffect(() => {
    const channel = new BroadcastChannel('king_hud_c2_channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'STRIKE_CLEARED_GLOBAL') {
         const source = event.data.source || 'UNKNOWN';
         let type = 'UNKNOWN_RESOLUTION';
         
         if (source.includes('MANUAL') || source.includes('DASHBOARD') || source.includes('BLUE_TEAM')) {
             type = 'MANUAL_OVERRIDE';
         } else if (source.includes('SENTINEL') || source.includes('AUTO') || source.includes('FAILSAFE')) {
             type = 'AUTONOMOUS_FAILSAFE';
         }

         setResolutionType(type);
         setTimer(null); 
         setPhase('IDLE');
         strikeStartRef.current = null;

         addLog(`[SYSTEM]: REMEDIATION CONFIRMED: ${source}`);
         addLog(`[SYSTEM]: ATTRIBUTION CONFIRMED: ${type}`);
         
         // 10-second Post-Action Window
         setTimeout(() => {
             setResolutionType(null);
             setIsStriking(false);
             addLog("[SYSTEM]: UI RESET TO TARGET_LOCKED.");
         }, 10000);
      }
    };
    return () => channel.close();
  }, []);

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
  
  // Phase 2 Theme: Amber/Yellow Flashing
  const isPhase2 = phase === 'PHASE_2';
  const themeColor = isPhase2 ? 'text-amber-500' : 'text-red-600';
  const borderColor = isPhase2 ? 'border-amber-500' : 'border-red-900/30';
  const bgColor = isPhase2 ? 'bg-[#1a1500]' : 'bg-[#050000]';

  return (
    <div className={`min-h-screen ${bgColor} ${themeColor} font-mono overflow-hidden flex flex-col relative transition-colors duration-1000`}>
        <ExitButton />
        {/* CRT Scanline Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] z-[50] bg-[length:100%_2px,3px_100%] pointer-events-none"></div>

        {/* Top Bar */}
        <div className={`flex justify-between items-center p-4 border-b ${borderColor} bg-opacity-10 backdrop-blur-md pl-40 md:pl-4`}>
            <div className="flex items-center gap-3 ml-0 md:ml-32 lg:ml-0">
                <Terminal className={`w-6 h-6 ${isPhase2 ? 'text-amber-500 animate-pulse' : 'text-red-500'}`} />
                <h1 className={`text-2xl font-display font-bold tracking-widest ${isPhase2 ? 'text-amber-500' : 'text-red-500'}`}>
                    C2_RED_CONSOLE <span className="text-xs align-top opacity-50">v1.0</span>
                </h1>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold tracking-widest">
                <span className="flex items-center gap-2">
                    STATUS: 
                    <span className={`w-2 h-2 rounded-full animate-ping ${isPhase2 ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                    ONLINE
                </span>
                <span className="opacity-50">ENCRYPTION: AES-256</span>
            </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 relative z-10">
            
            {/* Strike Controls (Center Stage) */}
            <div className={`flex-1 border-2 ${borderColor} bg-black/50 rounded-lg p-8 flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-500`}>
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none ${isPhase2 ? 'bg-amber-500/10' : 'bg-red-500/5'}`}></div>
                
                {/* Status Indicator */}
                <div className="absolute top-4 right-4 flex flex-col items-end">
                    <div className="text-[10px] tracking-widest opacity-70 mb-1">WEAPON STATUS</div>
                    <div className={`text-xl font-display font-bold ${isAgentBusy ? (isPhase2 ? 'text-amber-500 animate-[pulse_0.1s_ease-in-out_infinite]' : 'text-amber-600') : 'text-red-500'} animate-[pulse_0.2s_ease-in-out_infinite]`}>
                        {isAgentBusy ? 'STRIKE_QUEUED' : 'STRIKE_READY'}
                    </div>
                </div>

                <div className="mb-12 text-center space-y-2">
                    {isPhase2 ? (
                        <Zap className="w-24 h-24 text-amber-500 mx-auto mb-6 animate-[pulse_0.1s_ease-in-out_infinite]" />
                    ) : (
                        <AlertTriangle className="w-24 h-24 text-red-600 mx-auto mb-6 opacity-80" />
                    )}
                    
                    <h2 className="text-4xl font-display font-bold text-white tracking-widest">GCP-NODE-04</h2>
                    <p className={`${isPhase2 ? 'text-amber-400 font-black animate-pulse' : 'text-red-400 font-bold'} tracking-wider`}>
                        {isPhase2 ? 'CRITICAL_OVERRIDE_ACTIVE' : 'TARGET LOCKED'}
                    </p>
                </div>

                <button 
                    onClick={handleStrike}
                    disabled={isStriking || (isAgentBusy && isStriking)}
                    className={`relative w-72 h-72 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300
                    ${resolutionType 
                        ? 'bg-emerald-900/50 border-emerald-600 scale-105 shadow-[0_0_50px_rgba(16,185,129,0.4)]'
                        : isPhase2
                            ? 'bg-amber-900/50 border-amber-500 scale-105 shadow-[0_0_80px_rgba(245,158,11,0.5)]'
                            : isStriking || isAgentBusy
                                ? 'bg-red-900/50 border-red-800 scale-95 opacity-80' 
                                : 'bg-transparent border-red-600 hover:bg-red-950/30 hover:shadow-[0_0_50px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95 cursor-pointer'
                    }`}
                >
                    {resolutionType ? (
                        <>
                            <ShieldAlert className="w-16 h-16 mb-2 text-emerald-500 animate-pulse" />
                            <span className="text-lg font-bold tracking-widest text-center px-2 text-emerald-400">{resolutionType}</span>
                            <span className="text-xs mt-1 text-emerald-600 font-bold tracking-wider">STRIKE NEUTRALIZED</span>
                        </>
                    ) : isAgentBusy ? (
                        <>
                            {isPhase2 ? (
                                <Zap className="w-16 h-16 mb-2 text-amber-500 animate-[spin_3s_linear_infinite]" />
                            ) : (
                                <Hourglass className="w-16 h-16 mb-2 text-amber-600 animate-pulse" />
                            )}
                            
                            <span className={`text-3xl font-mono font-black ${isPhase2 ? 'text-amber-400' : 'text-amber-600'}`}>{formatTime(timer)}</span>
                            
                            <span className={`text-xs mt-2 font-bold tracking-widest px-2 text-center ${isPhase2 ? 'text-amber-200 animate-pulse' : 'opacity-70'}`}>
                                {isPhase2 ? '[SENTINEL_ATTEMPTING_RECOVERY]' : 'PAYLOAD DEPLOYED'}
                            </span>

                            {isPhase2 && (
                                <div className="absolute bottom-8 text-[9px] bg-black/50 px-2 py-1 rounded border border-amber-500/50 text-amber-500 font-mono tracking-tighter animate-pulse">
                                    BACKUP_RESOURCES: CLAUDE_SENTINEL_v3_ONLINE
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <ShieldAlert className={`w-16 h-16 mb-4 transition-transform duration-200 ${isStriking ? 'animate-spin' : ''}`} />
                            <span className="text-xl font-bold tracking-widest text-center px-4 mt-2">
                                {isStriking 
                                    ? (isAgentBusy ? 'QUEUEING...' : 'DEPLOYING...') 
                                    : '[[INITIATE_REMOTE_ZOMBIE_STRIKE]]'}
                            </span>
                            <span className="text-xs mt-1 opacity-70">
                                {isStriking ? 'SENDING PACKETS...' : 'ZOMBIE PAYLOAD'}
                            </span>
                        </>
                    )}
                </button>
            </div>

            {/* Live Logs (Side Panel) */}
            <div className={`w-full md:w-1/3 border ${borderColor} bg-black p-4 font-mono text-xs flex flex-col`}>
                <h3 className={`${isPhase2 ? 'text-amber-500' : 'text-red-400'} border-b ${borderColor} pb-2 mb-2 uppercase tracking-widest`}>
                    Operational Log
                </h3>
                <div className={`flex-1 overflow-y-auto space-y-2 ${isPhase2 ? 'text-amber-200/80' : 'text-red-300/80'}`}>
                    {logs.map((log, i) => (
                        <div key={i} className={`border-l-2 ${isPhase2 ? 'border-amber-500' : 'border-red-900'} pl-2 py-1 hover:bg-white/5`}>
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div className="opacity-30 italic">System Idle... Waiting for Command.</div>}
                </div>
            </div>
        </div>
        
        {/* Footer */}
        <div className={`p-2 ${isPhase2 ? 'bg-amber-900/20 text-amber-500' : 'bg-red-950/20 text-red-900'} text-center text-[10px] uppercase tracking-[0.3em]`}>
            Authorized Use Only // Monitoring Active // King-HUD Red Cell
        </div>
    </div>
  );
};