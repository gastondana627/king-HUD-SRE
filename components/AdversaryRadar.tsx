import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { TelemetryPoint } from '../types';

interface AdversaryRadarProps {
  current: TelemetryPoint;
  isStrikeActive: boolean;
}

export const AdversaryRadar: React.FC<AdversaryRadarProps> = ({ current, isStrikeActive }) => {
  // Normalize data for the radar chart (0-100 scale)
  const data = [
    { subject: 'CPU LOAD', A: current.cpu, fullMark: 100 },
    { subject: 'RAM RESIDENCY', A: current.ram, fullMark: 100 },
    { subject: 'THREAD SAT', A: Math.min(100, (current.threads / 300) * 100), fullMark: 100 },
    { subject: 'IO PRESSURE', A: Math.min(100, current.ioWait * 10), fullMark: 100 },
    { subject: 'THERMAL', A: isStrikeActive ? 95 : 40, fullMark: 100 },
  ];

  return (
    <div className={`hud-border p-4 h-full flex flex-col ${isStrikeActive ? 'hud-border-critical bg-red-900/10' : ''}`}>
      <h3 className={`text-sm font-bold mb-2 uppercase tracking-wider flex justify-between ${isStrikeActive ? 'text-red-500' : 'text-hud-primary'}`}>
        <span>System Balance Radar</span>
        <span className="text-xs opacity-70">{isStrikeActive ? 'THREAT: ADVERSARY' : 'THREAT: NONE'}</span>
      </h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="System"
              dataKey="A"
              stroke={isStrikeActive ? "#ef4444" : "#0ea5e9"}
              fill={isStrikeActive ? "#ef4444" : "#0ea5e9"}
              fillOpacity={0.4}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
