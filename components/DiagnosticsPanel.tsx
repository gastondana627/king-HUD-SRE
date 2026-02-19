import React, { useState, useEffect } from 'react';
import { DiagnosticResult, DixonStage, SystemStatus } from '../types';
import { AlertTriangle, Terminal, ShieldAlert, CheckCircle, Activity, Skull, WifiOff } from 'lucide-react';

interface DiagnosticsPanelProps {
  result: DiagnosticResult | null;
  loading: boolean;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ result, loading }) => {
  const [adversaryConfidence, setAdversaryConfidence] = useState(5);

  useEffect(() => {
      // VISUAL EFFECT: Climbing Confidence during Adversary Emulation
      if (result?.status === SystemStatus.EMERGENCY_ADVERSARY_EMULATION_IN_PROGRESS) {
          const interval = setInterval(() => {
              setAdversaryConfidence(prev => {
                  if (prev >= 98) return 98;
                  // Random climb between 1-3% per tick for organic feel
                  return prev + Math.floor(Math.random() * 3) + 1; 
              });
          }, 150);
          return () => clearInterval(interval);
      } else {
          // Reset when not in adversary mode
          setAdversaryConfidence(5);
      }
  }, [result?.status]);

  if (loading) {
    return (
      <div className="hud-border h-full flex flex-col items-center justify-center p-8 text-hud-primary animate-pulse">
        <Activity className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-display uppercase tracking-widest">Running Heuristic Scan...</h2>
        <p className="text-xs text-hud-muted mt-2">Connecting to Cognitive Logic Layer</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="hud-border h-full flex flex-col items-center justify-center p-8 text-hud-muted opacity-50">
        <CheckCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-display uppercase tracking-widest">System Nominal</h2>
        <p className="text-xs mt-2">Awaiting Telemetry Anomalies</p>
      </div>
    );
  }

  const isFracture = result.status === SystemStatus.C2_FRACTURE_DETECTED;
  const isUplinkFail = result.status === SystemStatus.UPLINK_FAILURE;
  const isAdversary = result.status === SystemStatus.EMERGENCY_ADVERSARY_EMULATION_IN_PROGRESS;
  const isCritical = result.status === SystemStatus.ZOMBIE_KERNEL || result.status === SystemStatus.CRITICAL || isFracture || isUplinkFail || isAdversary;
  
  let statusColor = 'text-emerald-500';
  let Icon = Activity;

  if (isFracture) {
    statusColor = 'text-[#FF4D6D]';
    Icon = Skull;
  } else if (isUplinkFail) {
    statusColor = 'text-[#FFA500]';
    Icon = WifiOff;
  } else if (isAdversary) {
    statusColor = 'text-red-500';
    Icon = ShieldAlert;
  } else if (isCritical) {
    statusColor = 'text-red-500';
    Icon = ShieldAlert;
  } else if (result.status === SystemStatus.WARNING) {
    statusColor = 'text-amber-500';
    Icon = AlertTriangle;
  }

  return (
    <div className={`hud-border h-full flex flex-col ${isCritical ? 'hud-border-critical' : ''}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${statusColor} ${isFracture || isUplinkFail || isAdversary ? 'animate-pulse' : ''}`} />
          <span className={`font-bold font-display uppercase tracking-wider ${statusColor}`}>
            {result.status} DETECTED
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
           <span className="uppercase px-2 py-0.5 border border-gray-700 rounded">Stage: {result.dixonStage}</span>
        </div>
      </div>

      {/* Analysis Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="mb-6">
          <h4 className="text-xs text-hud-muted uppercase tracking-widest mb-2">Forensic Analysis</h4>
          <p className="text-sm leading-relaxed text-gray-300 font-mono border-l-2 border-gray-700 pl-3">
            {result.analysis}
          </p>
        </div>

        {/* Interventions */}
        <div>
          <h4 className="text-xs text-hud-muted uppercase tracking-widest mb-3 flex items-center gap-2">
            Intervention Protocols
            <span className="w-full h-px bg-gray-800 ml-2"></span>
          </h4>
          
          <div className="space-y-4">
            {result.interventions.map((intervention) => (
              <div key={intervention.id} className={`border border-l-4 p-4 rounded bg-black/40 ${
                intervention.confidence === 'HIGH' ? 'border-l-emerald-500 border-gray-700' : 'border-l-amber-500 border-gray-700'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sky-400 font-display text-lg">{intervention.protocol}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    isAdversary 
                      ? 'bg-red-900/50 text-red-400 animate-pulse' // Special styling for Adversary Mode
                      : intervention.confidence === 'HIGH' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-amber-900/50 text-amber-400'
                  }`}>
                    {isAdversary 
                       ? `AI_FORENSIC_CONFIDENCE: ${adversaryConfidence}%` 
                       : `${intervention.confidence} CONFIDENCE`
                    }
                  </span>
                </div>
                
                <p className="text-sm text-gray-300 mb-3">{intervention.description}</p>
                
                {intervention.cliCommand && (
                  <div className="bg-black border border-gray-800 p-3 rounded font-mono text-xs relative group">
                    <div className="absolute top-0 right-0 p-1 opacity-50 text-[10px] text-gray-500">BASH</div>
                    <div className="flex items-start gap-2 text-emerald-500">
                      <Terminal className="w-3 h-3 mt-1 shrink-0" />
                      <span className="break-all">{intervention.cliCommand}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};