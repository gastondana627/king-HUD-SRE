import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TelemetryPoint } from '../types';

interface TelemetryPanelProps {
  data: TelemetryPoint[];
}

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
              <Tooltip 
                contentStyle={{ backgroundColor: '#0a0f14', border: '1px solid #334155' }} 
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="cpu" stroke="#0ea5e9" fill="url(#cpuGradient)" strokeWidth={2} name="CPU %" isAnimationActive={false} />
              <Area type="monotone" dataKey="ioWait" stroke="#f59e0b" fill="url(#ioGradient)" strokeWidth={1} name="IO Wait %" isAnimationActive={false} />
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
              <Tooltip 
                contentStyle={{ backgroundColor: '#0a0f14', border: '1px solid #334155' }} 
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="ram" stroke="#10b981" fill="url(#ramGradient)" strokeWidth={2} name="RAM %" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
