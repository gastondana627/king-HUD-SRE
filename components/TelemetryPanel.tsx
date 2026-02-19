import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TelemetryPoint } from '../types';

interface TelemetryPanelProps {
  data: TelemetryPoint[];
}

// Custom Tooltip for Forensic Context
const ForensicTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 border border-hud-primary p-3 font-mono text-xs relative overflow-hidden shadow-[0_0_15px_rgba(14,165,233,0.3)] max-w-xs z-50">
        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] z-10 bg-[length:100%_2px,3px_100%] opacity-20"></div>
        
        <div className="text-hud-primary font-bold mb-2 border-b border-hud-primary/30 pb-1">T-INDEX: {label}</div>
        
        <div className="space-y-3 relative z-20">
            {payload.map((entry: any, idx: number) => {
                let labelText = entry.name;
                let descText = "";
                let colorClass = "text-gray-300";

                if (entry.dataKey === 'cpu') {
                    labelText = "[CPU_VITALITY]";
                    descText = "Measures processor cycle efficiency. Flatline indicates kernel-level stall.";
                    colorClass = "text-[#0ea5e9]"; // Blue
                } else if (entry.dataKey === 'ram') {
                    labelText = "[RAM_RESIDENCY]";
                    descText = "Measures memory allocation. Spikes indicate buffer-overflow or residency-locks.";
                    colorClass = "text-[#10b981]"; // Green
                } else if (entry.dataKey === 'ioWait') {
                    labelText = "[IO_LATENCY]";
                    colorClass = "text-[#f59e0b]";
                }

                return (
                    <div key={idx}>
                        <div className={`font-bold ${colorClass} mb-0.5`}>{labelText}: {entry.value.toFixed(1)}%</div>
                        {descText && <div className="text-[10px] text-gray-400 leading-tight">{descText}</div>}
                    </div>
                );
            })}
        </div>
        
        <div className="mt-3 pt-2 border-t border-gray-800 text-[9px] text-[#00f3ff] uppercase tracking-wider relative z-20">
            [FORENSIC_GRID]: Calibrated to Dixon 2026 Aerospace standards.
        </div>
      </div>
    );
  }
  return null;
};

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* CPU & IO */}
      <div className="hud-border p-4 flex flex-col h-64 lg:h-auto">
        <h3 className="text-hud-primary text-sm font-bold mb-2 uppercase tracking-wider flex justify-between">
          <span>Processor Core Metrics</span>
          <span className="text-xs opacity-70">RTS: Active</span>
        </h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="ioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" tick={false} stroke="#475569" />
              <YAxis stroke="#475569" domain={[0, 100]} />
              <Tooltip content={<ForensicTooltip />} />
              <Area type="monotone" dataKey="cpu" stroke="#0ea5e9" fill="url(#cpuGradient)" strokeWidth={2} name="CPU" isAnimationActive={false} />
              <Area type="monotone" dataKey="ioWait" stroke="#f59e0b" fill="url(#ioGradient)" strokeWidth={1} name="IO Wait" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RAM & Threads */}
      <div className="hud-border p-4 flex flex-col h-64 lg:h-auto">
        <h3 className="text-hud-primary text-sm font-bold mb-2 uppercase tracking-wider flex justify-between">
          <span>Memory & Residency</span>
          <span className="text-xs opacity-70">PAGE_FAULT: Low</span>
        </h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" tick={false} stroke="#475569" />
              <YAxis stroke="#475569" domain={[0, 100]} />
              <Tooltip content={<ForensicTooltip />} />
              <Area type="monotone" dataKey="ram" stroke="#10b981" fill="url(#ramGradient)" strokeWidth={2} name="RAM" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};