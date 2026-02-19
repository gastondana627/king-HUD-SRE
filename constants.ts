export const SIMULATION_INTERVAL_MS = 1000;
export const MAX_HISTORY_POINTS = 60;

export const GCP_CONFIG = {
  PROJECT_ID: 'king-hud-production',
  ZONE: 'us-central1-a',
  INSTANCE_ID: 'gcp-p100-node-04'
};

export const REBOOT_COOLDOWN_MS = 300000; // 5 minutes

// FORENSIC TIMERS (SECONDS)
export const INITIAL_HOLD_TIME = 180; // 3 Minutes (Forensic Window)
export const FAILSAFE_GRACE_TIME = 120; // 2 Minutes (Sentinel Fail-Safe)
export const AUTO_REMEDIATE_THRESHOLD = INITIAL_HOLD_TIME + FAILSAFE_GRACE_TIME; // 300s Total

export const KING_HUD_SYSTEM_INSTRUCTION = `
You are the King-HUD Agent, a specialized cognitive-aware SRE tool.
Your specialization is identifying "Spatial Disorientation" in distributed systems.

DIAGNOSTIC PROTOCOLS:
1. IDENTIFY TYPE 1 SD (Unrecognized Error): Specifically look for "Zombie" patterns—near 0% CPU utilization with high RAM residency (>80%) and stalled execution threads (The "C2 Fracture" pattern).
2. STAGE RECOGNITION: Classify the incident into Dixon Stages:
   - WIPEOUT: Immediate, catastrophic loss of signal or control.
   - UNDERTOW: Insidious, slow-burning failure (like memory leaks or zombie processes).
   - RECOVERY: System is stabilizing.
3. OUTPUT: Provide a "High-Confidence Intervention Path".

PRIMARY ACTION:
If a "Zombie Kernel" pattern is detected (Low CPU, High RAM), you MUST immediately suggest the "Safe-Restart" protocol for Google Cloud P100/T4 infrastructure.

SECONDARY ACTION (RED TEAM):
If you see logs containing "[TEST_MODE]" or "RED TEAM", classify the status as "WARNING" but explicitly note that this is a "PLANNED ADVERSARY EMULATION". Do NOT recommend a restart.
`;

export const MOCK_LOGS_NOMINAL = [
  "[INFO] kernel: [41234.12] task scheduler: nominal",
  "[INFO] systemd[1]: Started User Manager for UID 1000.",
  "[DEBUG] networking: packet flow steady at 4500 pps",
];

export const MOCK_LOGS_ZOMBIE = [
  "[WARN] kernel: [41240.55] rcu: INFO: rcu_sched self-detected stall on CPU",
  "[CRIT] vmem: allocation failed: out of memory",
  "[WARN] watchdog: BUG: soft lockup - CPU#0 stuck for 22s!",
  "[INFO] tasks: 2045 blocked processes detected",
];

export const MOCK_LOGS_STRIKE = [
  "[INFO] auth: ADMIN_OVERRIDE detected for user: red_team_lead",
  "[WARN] stress-ng: dispatching hogs: 64 cpu, 32 io, 16 vm, 8 hdd",
  "[INFO] kernel: [TEST_MODE] ADVERSARY EMULATION SEQUENCE INITIATED",
  "[WARN] thermal: CPU0: Package temperature above threshold, cpu clock throttled",
];