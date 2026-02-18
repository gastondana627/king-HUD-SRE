import React, { ReactNode } from 'react';
import { SystemStatus } from '../types';

interface HUDLayoutProps {
  children: ReactNode;
  status: string;
  remediationTimer: number | null;
  shiftRemediationCount?: number;
  isStalled?: boolean;
}

export const HUDLayout: React.FC<HUDLayoutProps> = ({ children, status, remediationTimer, shiftRemediationCount = 0, isStalled = false }) => {
  const isCritical = status === 'CRITICAL' || status === 'ZOMBIE_KERNEL';
  const isFracture = status === SystemStatus.C2_FRACTURE_DETECTED;
  const isUplinkFail = status === SystemStatus.UPLINK_FAILURE;
  const isReconnecting = status === SystemStatus.UPLINK_RECONNECTING;
  const isSimulation = status === SystemStatus.UPLINK_SIMULATION; // New Failover Mode
  
  let borderColor = 'border-sky-500/30';
  let glowColor = 'shadow-[0_0_15px_rgba(14,165,233,0.1)]';
  
  // LED Logic
  let ledColor = 'bg-[#00FF41] shadow-[0_0_10px_#00FF41]'; // Default Green
  let ledTooltip = 'UPLINK STATUS: NOMINAL // CHANNEL SECURE';
  
  if (isFracture) {
    borderColor = 'border-[#FF4D6D]'; // Neon Magenta
    glowColor = 'shadow-[0_0_30px_rgba(255,77,109,0.6)] animate-pulse';
  } else if (isUplinkFail || isReconnecting || isSimulation) {
    borderColor = 'border-[#FFA500]'; // Orange
    glowColor = 'shadow-[0_0_30px_rgba(255,165,0,0.6)] animate-pulse';
    
    if (isUplinkFail) {
        ledColor = 'bg-[#FF0000] shadow-[0_0_10px_#FF0000]';
        ledTooltip = '[ERROR]: SATELLITE_UPLINK_OFFLINE // CHECK_API_GATEWAY';
    } else if (isSimulation) {
        ledColor = 'bg-[#FFA500] shadow-[0_0_10px_#FFA500]';
        ledTooltip = 'BACKUP COMMUNICATIONS // SIMULATION MODE ACTIVE';
    } else {
        ledColor = 'bg-[#FFA500] shadow-[0_0_10px_#FFA500] animate-pulse';
        ledTooltip = 'ATTEMPTING_HANDSHAKE // RECONNECTING...';
    }
  } else if (isCritical) {
    borderColor = 'border-red-500/30';
    glowColor = 'shadow-[0_0_15px_rgba(239,68,68,0.2)]';
  } else if (isStalled) {
    // VISUAL HANDSHAKE: HICCUP/STALL DETECTED
    borderColor = 'border-[#FFD700]'; // Gold/Yellow
    glowColor = 'shadow-[0_0_15px_#FFD700] animate-pulse';
  }

  // Timer Formatting
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className={`min-h-screen bg-hud-black text-hud-text font-mono p-4 md:p-6 overflow-hidden relative`}>
      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-10" 
           style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
      
      {/* Main Container */}
      <div className={`relative z-10 w-full h-full max-w-7xl mx-auto flex flex-col gap-6 ${borderColor} border rounded-sm p-1 ${glowColor} transition-all duration-300`}>
        
        {/* Top Bar / Header */}
        <header className="flex items-center justify-between px-4 py-2 bg-hud-dark/80 border-b border-hud-muted/30 relative">
          <div className="flex items-center gap-4">
            {/* Main Status Dot (Left) - General System Health */}
            <div className={`w-3 h-3 rounded-full ${isFracture ? 'bg-[#FF4D6D] animate-ping' : isUplinkFail ? 'bg-[#FFA500]' : isCritical ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            <h1 className="font-display text-2xl font-bold tracking-widest text-white">KING-HUD <span className="text-xs text-hud-muted align-top ml-1">v2.4.2</span></h1>
          </div>
          
          {/* CENTER: FORENSIC HOLD TIMER OVERLAY */}
          {remediationTimer !== null && (
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none hidden md:block">
               <div className="bg-red-950/90 border border-red-500 text-red-100 px-6 py-1 rounded shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse font-bold tracking-widest text-sm whitespace-nowrap">
                   [REMEDIATION_HOLD]: {formatTime(remediationTimer)} // ALLOWING_FORENSIC_WITNESS
               </div>
            </div>
          )}

          <div className="flex items-center gap-6 text-xs text-hud-primary uppercase tracking-wider">
            <span>SYS_ID: G-4491-X</span>

            {/* STRIKE COUNTER */}
            <span className="text-hud-text hidden sm:inline-block">
                [SHIFT_STRIKES_CLEARED: <span className="text-emerald-400 font-bold">{shiftRemediationCount}</span>]
            </span>
            
            {/* Uplink Status LED (Persistent Indicator) */}
            <div className="flex items-center gap-2 group relative cursor-help">
                <span className="opacity-70">UPLINK:</span>
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${ledColor}`}></div>
                
                {/* Tactical Tooltip */}
                <div className="absolute top-full right-0 mt-2 w-64 p-2 bg-hud-black border border-red-500/50 text-[10px] text-red-400 font-mono shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {ledTooltip}
                </div>
            </div>

            <span className={
              isFracture ? 'text-[#FF4D6D] font-bold animate-pulse' : 
              isUplinkFail || isReconnecting || isSimulation ? 'text-[#FFA500] font-bold animate-pulse' :
              isCritical ? 'text-red-500 font-bold' : ''
            }>STATUS: {status}</span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-2">
          {children}
        </main>

        {/* Decorative HUD Lines */}
        <div className="absolute top-0 left-0 w-16 h-1 bg-hud-primary/50"></div>
        <div className="absolute top-0 right-0 w-16 h-1 bg-hud-primary/50"></div>
        <div className="absolute bottom-0 left-0 w-16 h-1 bg-hud-primary/50"></div>
        <div className="absolute bottom-0 right-0 w-16 h-1 bg-hud-primary/50"></div>
      </div>
    </div>
  );
};