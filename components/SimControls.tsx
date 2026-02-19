import React, { useState } from 'react';
import { Play, Pause, AlertOctagon, RotateCcw, Zap, RefreshCw, ServerCrash, FileText } from 'lucide-react';
import { SystemStatus } from '../types';

interface SimControlsProps {
  isPlaying: boolean;
  setIsPlaying: (val: boolean) => void;
  simulationMode: 'NOMINAL' | 'ZOMBIE' | 'CPU_STRIKE';
  toggleSimulation: () => void;
  triggerPlannedStrike: (duration: number) => void;
  isAutonomousActuating: boolean;
  remediationTimer: number | null;
  handleRemediation: () => void;
  systemStatus: SystemStatus;
  attemptManualResync: () => void;
  setShowShiftReports: (val: boolean) => void;
  currentShift: string;
}

const ForensicTooltip = ({ text, type = 'standard' }: { text: string, type?: 'standard' | 'critical' }) => (
  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none transition-opacity duration-200 animate-in fade-in zoom-in-95">
    <div className={`relative px-3 py-1.5 bg-[#050505] border ${type === 'critical' ? 'border-[#ff003c] text-[#ff003c]' : 'border-[#00f3ff] text-[#00f3ff]'} text-[10px] font-mono shadow-[0_0_15px_rgba(0,0,0,0.8)] whitespace-nowrap tracking-wider flex items-center overflow-hidden`}>
      {/* Scanline Effect Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.2)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-30 z-0"></div>
      
      <span className="relative z-10 mr-1 opacity-70">&gt;</span> 
      <span className="relative z-10">{text}</span>
      
      {/* Connecting Arrow */}
      <div className={`absolute left-0 top-1/2 -translate-x-[50%] -translate-y-1/2 w-2 h-2 bg-[#050505] border-l border-b ${type === 'critical' ? 'border-[#ff003c]' : 'border-[#00f3ff]'} rotate-45`}></div>
    </div>
  </div>
);

const ControlBtn = ({ 
  onClick, 
  disabled, 
  className, 
  children, 
  tooltip, 
  tooltipType = 'standard'
}: { 
  onClick: () => void, 
  disabled?: boolean, 
  className: string, 
  children: React.ReactNode, 
  tooltip: string,
  tooltipType?: 'standard' | 'critical'
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div 
      className="relative w-full group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
      {hovered && !disabled && <ForensicTooltip text={tooltip} type={tooltipType} />}
    </div>
  );
};

export const SimControls: React.FC<SimControlsProps> = ({
  isPlaying,
  setIsPlaying,
  simulationMode,
  toggleSimulation,
  triggerPlannedStrike,
  isAutonomousActuating,
  remediationTimer,
  handleRemediation,
  systemStatus,
  attemptManualResync,
  setShowShiftReports,
  currentShift
}) => {
  return (
    <div className="hud-border p-4 relative">
      <h3 className="text-xs text-hud-muted uppercase tracking-widest mb-4">Sim Controls</h3>
      <div className="flex flex-col gap-3">
        
        <ControlBtn
          onClick={() => setIsPlaying(!isPlaying)}
          className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all w-full ${isPlaying ? 'bg-hud-dark border border-hud-muted text-hud-text' : 'bg-hud-primary text-black'}`}
          tooltip={isPlaying ? "HALT_TELEMETRY_STREAM // FREEZE_FRAME" : "RESUME_REALTIME_INGEST"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? 'PAUSE TELEMETRY' : 'RESUME STREAM'}
        </ControlBtn>

        <ControlBtn
          onClick={toggleSimulation}
          disabled={simulationMode === 'CPU_STRIKE'}
          className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all w-full ${
            simulationMode === 'ZOMBIE' 
            ? 'bg-red-900/50 border border-red-500 text-red-100 animate-pulse' 
            : 'bg-hud-dark border border-hud-muted text-hud-text hover:border-hud-primary disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
          tooltip={simulationMode === 'ZOMBIE' ? "RESET_SIMULATION_PARAMETERS" : "[ADVERSARY]: Initiate resource exhaustion via stalled kernel threads."}
          tooltipType={simulationMode === 'ZOMBIE' ? 'standard' : 'critical'}
        >
          {simulationMode === 'ZOMBIE' ? <RotateCcw size={16} /> : <AlertOctagon size={16} />}
          {simulationMode === 'ZOMBIE' ? 'RESET SIMULATION' : 'INJECT ZOMBIE KERNEL'}
        </ControlBtn>

        <ControlBtn
          onClick={() => triggerPlannedStrike(30)}
          disabled={simulationMode === 'CPU_STRIKE'}
          className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all relative overflow-hidden group w-full ${
            simulationMode === 'CPU_STRIKE'
            ? 'bg-amber-600 text-black cursor-not-allowed'
            : 'bg-hud-dark border border-amber-500/50 text-amber-500 hover:bg-amber-500/10'
          }`}
          tooltip="INITIATE_RED_TEAM_DRILL // CPU_STRESS_TEST"
          tooltipType="critical"
        >
          <Zap size={16} className={simulationMode === 'CPU_STRIKE' ? 'animate-bounce' : ''} />
          <span className="text-xs">{simulationMode === 'CPU_STRIKE' ? 'STRIKE IN PROGRESS...' : 'INITIATE ADVERSARY EMULATION'}</span>
          {simulationMode !== 'CPU_STRIKE' && <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>}
        </ControlBtn>

        {/* Force Cloud Reset Button */}
        <ControlBtn
          onClick={handleRemediation}
          disabled={isAutonomousActuating}
          className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all border w-full ${
            isAutonomousActuating 
              ? 'sentinel-btn-active cursor-wait'
              : remediationTimer !== null
                  ? 'bg-red-900 border-red-500 text-red-100 animate-pulse'
                  : 'bg-hud-dark border-red-700 text-red-500 hover:bg-red-900/20'
          }`}
          tooltip="[HUMAN_AUTH]: Finalize forensic audit and execute Safe-Restart."
          tooltipType="critical"
        >
          {isAutonomousActuating ? <RefreshCw size={16} className="animate-spin" /> : <ServerCrash size={16} />}
          <span className="text-xs">
             {isAutonomousActuating ? `[[SHIFT_${currentShift}_ACTUATING...]]` : `[COMMIT_REMEDIATION_TO_${currentShift}]`}
          </span>
        </ControlBtn>

        {/* Manual Resync Button */}
        {(systemStatus === SystemStatus.UPLINK_FAILURE || systemStatus === SystemStatus.UPLINK_RECONNECTING) && (
            <ControlBtn
              onClick={attemptManualResync}
              disabled={systemStatus === SystemStatus.UPLINK_RECONNECTING}
              className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all border w-full ${
                  systemStatus === SystemStatus.UPLINK_RECONNECTING
                  ? 'bg-orange-900/50 border-orange-500 text-orange-200 cursor-wait'
                  : 'bg-hud-dark border-orange-500 text-orange-500 hover:bg-orange-500/10'
              }`}
              tooltip="FORCE_UPLINK_HANDSHAKE // RETRY_GATEWAY"
              tooltipType="critical"
            >
              <RefreshCw size={16} className={systemStatus === SystemStatus.UPLINK_RECONNECTING ? 'animate-spin' : ''} />
              <span className="text-xs">{systemStatus === SystemStatus.UPLINK_RECONNECTING ? 'SYNCING...' : 'MANUAL UPLINK RESYNC'}</span>
            </ControlBtn>
        )}

        {/* VIEW SHIFT LOGS BUTTON */}
        <ControlBtn
          onClick={() => setShowShiftReports(true)}
          className="flex items-center justify-center gap-2 p-2 rounded font-bold transition-all bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 mt-2 w-full"
          tooltip="[AUDIT]: Access shift-specific telemetry and compliance timestamps."
        >
          <FileText size={16} />
          <span className="text-xs">VIEW {currentShift} REPORTS</span>
        </ControlBtn>

      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-800">
         <div className="text-xs font-mono text-gray-500 mb-1">CURRENT PATTERN</div>
         <div className={`text-lg font-display font-bold ${
           simulationMode === 'ZOMBIE' ? 'text-red-500' : 
           simulationMode === 'CPU_STRIKE' ? 'text-amber-500' : 'text-emerald-500'
         }`}>
           {simulationMode === 'ZOMBIE' ? 'TYPE 1 SD (ZOMBIE)' : 
            simulationMode === 'CPU_STRIKE' ? 'RED TEAM STRIKE' : 'NOMINAL OPERATION'}
         </div>
      </div>
    </div>
  );
};