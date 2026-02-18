export interface TelemetryPoint {
  timestamp: number;
  cpu: number;
  ram: number;
  threads: number;
  ioWait: number;
}

export enum SystemStatus {
  NOMINAL = 'NOMINAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  ZOMBIE_KERNEL = 'ZOMBIE_KERNEL', // Specific Type 1 SD
  C2_FRACTURE_DETECTED = 'C2_FRACTURE_DETECTED', // Confirmed Fracture
  UPLINK_FAILURE = 'UPLINK_FAILURE', // Notification Service Down
  UPLINK_RECONNECTING = 'UPLINK_RECONNECTING', // Retrying Connection
  UPLINK_SIMULATION = 'UPLINK_SIMULATION' // Failover Mode
}

export enum DixonStage {
  NONE = 'NONE',
  WIPEOUT = 'WIPEOUT',     // Immediate loss of control
  UNDERTOW = 'UNDERTOW',   // Compounding hidden errors
  RECOVERY = 'RECOVERY'    // Stabilization
}

export interface Intervention {
  id: string;
  confidence: 'HIGH' | 'LOW';
  protocol: string;
  action: string;
  cliCommand?: string;
  description: string;
  dixonStage: DixonStage;
}

export interface DiagnosticResult {
  status: SystemStatus;
  analysis: string;
  dixonStage: DixonStage;
  interventions: Intervention[];
  timestamp: number;
}