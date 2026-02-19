import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react';
import { HUDLayout } from './HUDLayout';
import { TelemetryPanel } from './TelemetryPanel';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { AdversaryRadar } from './AdversaryRadar';
import { TelemetryPoint, DiagnosticResult, SystemStatus } from '../types';
import { analyzeSystemState } from '../services/geminiService';
import { sendNtfyAlert, broadcastCriticalAlert, sendEmailAlert, broadcastFailSafeAlert } from '../services/notificationService';
import { executeInstanceReset } from '../services/cloudService';
import { startAuditScheduler, logAuditEntry, invoke_ai_analysis, getShiftReports, isAuditorOnline, checkAndSendDailySummary, getCurrentShift, downloadAuditLog, resetUplinkConnection } from '../services/auditService';
import { 
  SIMULATION_INTERVAL_MS, 
  MAX_HISTORY_POINTS, 
  MOCK_LOGS_NOMINAL, 
  MOCK_LOGS_ZOMBIE, 
  MOCK_LOGS_STRIKE,
  GCP_CONFIG,
  REBOOT_COOLDOWN_MS
} from '../constants';
import { Play, Pause, AlertOctagon, RotateCcw, Zap, RefreshCw, ServerCrash, FileText, X, Cpu, Download, Database, Layers, ArrowLeft } from 'lucide-react';
import { TrafficContext } from '../App';

export const Dashboard = () => {
  // Context
  const { isAgentBusy, setBusy, triggerStrike, queueDepth, registerLogger } = useContext(TrafficContext);

  // State
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [simulationMode, setSimulationMode] = useState<'NOMINAL' | 'ZOMBIE' | 'CPU_STRIKE'>('NOMINAL');
  const [simulationSource, setSimulationSource] = useState<string>('UNKNOWN');
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(SystemStatus.NOMINAL);
  const [commandStatus, setCommandStatus] = useState<string | null>(null);
  const [showShiftReports, setShowShiftReports] = useState(false);
  const [shiftReports, setShiftReports] = useState<any[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [currentShift, setCurrentShift] = useState<string>(getCurrentShift());
  const [showFullArchive, setShowFullArchive] = useState(false);
  
  // Operational Intensity & Hiccup Logic State
  const [shiftRemediationCount, setShiftRemediationCount] = useState<number>(0);
  const [isStalled, setIsStalled] = useState<boolean>(false);

  // Forensic Delay State
  const [remediationTimer, setRemediationTimer] = useState<number | null>(null);
  const [remediationPhase, setRemediationPhase] = useState<'HOLD' | 'FAILSAFE'>('HOLD');
  // TTR STOPWATCH: Measures time from DETECTION (Fracture Confirmed) to COMMIT (Reset)
  const remediationStartTimeRef = useRef<number>(0);
  
  // Visual Actuation State
  const [isAutonomousActuating, setIsAutonomousActuating] = useState(false);
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const [shockwavePos, setShockwavePos] = useState({ x: 0, y: 0 });
  const remediationButtonRef = useRef<HTMLButtonElement>(null);

  const lastAlertSuccessRef = useRef<boolean>(false);
  const lastGeminiMatchRef = useRef<boolean>(false); // Store match result

  // Refs for logic that shouldn't trigger re-renders or dependency loops
  const logsRef = useRef<string[]>(MOCK_LOGS_NOMINAL);
  const lastAnalysisTimeRef = useRef<number>(0);
  const strikeTimeoutRef = useRef<number | null>(null);
  
  // Heuristic & Healing Refs
  const consecutiveZombieTicksRef = useRef<number>(0);
  const isFractureActiveRef = useRef<boolean>(false);
  const lastResetTimeRef = useRef<number>(0);
  const isHealingInProgressRef = useRef<boolean>(false);

  // Hiccup Detection Refs
  const stallTickCountRef = useRef<number>(0);
  const lastRamRef = useRef<number>(0);

  // Register Log Pusher
  useEffect(() => {
    registerLogger((msg: string) => {
      logsRef.current = [...logsRef.current, msg];
    });
  }, [registerLogger]);

  // Sync Busy State with Traffic Controller
  useEffect(() => {
    const busy = simulationMode !== 'NOMINAL' || isAnalyzing;
    if (busy !== isAgentBusy) {
        setBusy(busy);
    }
  }, [simulationMode, isAnalyzing, setBusy, isAgentBusy]);

  // Sync State to Refs for Stale Closures
  const currentShiftRef = useRef(currentShift);
  useEffect(() => { currentShiftRef.current = currentShift; }, [currentShift]);
  
  const simulationModeRef = useRef(simulationMode);
  useEffect(() => { simulationModeRef.current = simulationMode; }, [simulationMode]);
  
  const simulationSourceRef = useRef(simulationSource);
  useEffect(() => { simulationSourceRef.current = simulationSource; }, [simulationSource]);

  const diagnosticResultRef = useRef(diagnosticResult);
  useEffect(() => { diagnosticResultRef.current = diagnosticResult; }, [diagnosticResult]);

  const remediationTimerRef = useRef(remediationTimer);
  useEffect(() => { remediationTimerRef.current = remediationTimer; }, [remediationTimer]);

  // ESC Key Listener for Modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showShiftReports) {
        setShowShiftReports(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showShiftReports]);

  // Determine Shift-Specific Visuals
  const shiftColors = useMemo(() => {
    switch(currentShift) {
        case '1ST_SHIFT': return { hex: '#00FF41', rgb: '0, 255, 65' };   // Emerald (Observation)
        case '2ND_SHIFT': return { hex: '#FFB000', rgb: '255, 176, 0' };  // Amber (Tactical)
        case '3RD_SHIFT': return { hex: '#00f3ff', rgb: '0, 243, 255' };  // Cyan (Autonomous)
        default: return { hex: '#00f3ff', rgb: '0, 243, 255' };
    }
  }, [currentShift]);

  // System Init Log
  useEffect(() => {
    console.log("[SYSTEM]: INTENSITY_MONITOR_ACTIVE");
    logsRef.current = [...logsRef.current, "[SYSTEM]: INTENSITY_MONITOR_ACTIVE"];
  }, []);

  // Initial Data
  useEffect(() => {
    const initialData = Array.from({ length: 20 }).map((_, i) => ({
      timestamp: Date.now() - (20 - i) * 1000,
      cpu: 45 + Math.random() * 10,
      ram: 30 + Math.random() * 5,
      threads: 150 + Math.floor(Math.random() * 20),
      ioWait: 2 + Math.random() * 2
    }));
    setHistory(initialData);
    if (initialData.length > 0) lastRamRef.current = initialData[initialData.length-1].ram;
  }, []);

  // Initialize Audit Scheduler & Daily Check
  useEffect(() => {
    const stopScheduler = startAuditScheduler((source) => {
      console.log(`[AUDIT]: Triggering Scheduled Zombie Wave (Source: ${source})`);
      triggerStrike(source);
    });
    
    // Check for Daily Summary on load
    checkAndSendDailySummary();

    return () => stopScheduler();
  }, [triggerStrike]);

  // Shift Handover Synchronization & Rotation Logic
  useEffect(() => {
    const shiftInterval = setInterval(() => {
      const newShift = getCurrentShift();
      if (newShift !== currentShift) {
        console.log(`[SYSTEM]: Shift Handover Triggered: ${currentShift} -> ${newShift}`);
        setCurrentShift(newShift);
        // Reset Counter on Shift Change
        setShiftRemediationCount(0);
        logsRef.current = [...logsRef.current, `[SYSTEM]: SHIFT_ROTATION_COMPLETE // NEW_WATCH: ${newShift}`];
        logsRef.current = [...logsRef.current, `[SYSTEM]: NEW_WATCH_INITIALIZED // COUNTER_RESET`];
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(shiftInterval);
  }, [currentShift]);

  // C2 Admin Hook - Expose globally for "Route" simulation
  useEffect(() => {
    // @ts-ignore
    window.triggerZombieStrike = () => {
       console.log("[C2_ADMIN_HOOK]: Remote Signal Received on /admin/strike. Initiating Zombie Protocol.");
       triggerStrike("WINDOW_HOOK");
    };
    
    // Cleanup
    return () => {
        // @ts-ignore
        delete window.triggerZombieStrike;
    }
  }, [triggerStrike]);

  // Listen for C2 Admin Strike via BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel('king_hud_c2_channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'TRIGGER_ZOMBIE') {
         console.log("[C2_ADMIN_HOOK]: Remote Broadcast Received. Initiating Zombie Protocol.");
         setSimulationMode('ZOMBIE');
         if (event.data.source) {
             setSimulationSource(event.data.source);
             logsRef.current = [...logsRef.current, `[ALERT]: SIGNAL_SOURCE_IDENTIFIED: ${event.data.source}`];
         }
         logsRef.current = [...logsRef.current, "[ALERT]: REMOTE_C2_COMMAND_RECEIVED. SYSTEM_COMPROMISED."];
      }
    };
    return () => channel.close();
  }, []);

  // Load Shift Reports when modal opens
  useEffect(() => {
      if (showShiftReports) {
          setShiftReports(getShiftReports());
          setShowFullArchive(false); // Reset to filtered view by default
      }
  }, [showShiftReports]);

  // Filter Reports Logic
  const filteredReports = showFullArchive 
    ? shiftReports 
    : shiftReports.filter(r => {
        // Compatibility check: either explicit shift property or string containment in content
        const shiftIdentifier = `[SHIFT_IDENTIFIER: ${currentShift}]`;
        return r.shift === currentShift || (r.content && r.content.includes(shiftIdentifier));
    });

  // Forensic Timer & Fail-Safe Logic
  useEffect(() => {
      if (remediationTimer === null) return;
      
      if (remediationTimer === 0) {
          // PHASE 1: FORENSIC HOLD EXPIRED -> ENTER FAILSAFE
          if (remediationPhase === 'HOLD') {
              setRemediationPhase('FAILSAFE');
              setRemediationTimer(120); // 120s Grace Period (Total 300s)
              logsRef.current = [...logsRef.current, "[WARNING]: FORENSIC_WINDOW_CLOSED. OPERATOR_INACTIVITY_DETECTED. EXTENDING_GRACE_PERIOD_120S."];
              return;
          }
          
          // PHASE 2: FAILSAFE EXPIRED -> FORCED SENTINEL ACTUATION
          if (remediationPhase === 'FAILSAFE') {
              // CRITICAL: Execute GitLab Actuation via Bridge
              const cmd = diagnosticResultRef.current?.interventions?.[0]?.cliCommand || "gcloud compute instances reset --all";
              const source = "AUTO_SENTINEL_FAILSAFE";

              // Log the automated decision
              logsRef.current = [...logsRef.current, `[SENTINEL]: FAILSAFE_TIMER_EXPIRED. HUMAN_UNRESPONSIVE. EXECUTING_FORCED_REBOOT.`];
              
              // OOB Alert
              broadcastFailSafeAlert();

              triggerGitLabActuation(cmd);

              // TTR is approx 300s
              executeFinalRemediation(history[history.length-1], false, Date.now() - remediationStartTimeRef.current, source);
              return;
          }
      }
      
      const timer = setInterval(() => {
          setRemediationTimer(t => (t !== null && t > 0 ? t - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
  }, [remediationTimer, history, remediationPhase]);

  // Debug AI Uplink Trigger
  const handleDebugUplink = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    
    // 1. Reset Connection & Clear Cache
    resetUplinkConnection();

    // 2. Inject Confirmation Log
    logsRef.current = [...logsRef.current, "[UPLINK]: RE-HANDSHAKE_COMPLETE. FORENSIC_LEAD_READY."];

    // Get current state
    const currentMetrics = history[history.length - 1];
    
    // Invoke Analysis directly (Bypassing scheduler)
    await invoke_ai_analysis({
        trigger: "MANUAL_DEBUG_UPLINK",
        timestamp: Date.now(),
        metrics: currentMetrics,
        alert_status: "DEBUG_INVOCATION"
    });

    // Refresh lists
    setShiftReports(getShiftReports());
    setIsGeneratingReport(false);
  };

  // Red Team Strike Logic
  const triggerPlannedStrike = (durationSeconds = 30) => {
    console.log(`[RED TEAM] Initiating CPU Strike for ${durationSeconds}s`);
    setSimulationMode('CPU_STRIKE');
    setSimulationSource('RED_TEAM_MANUAL'); // Tag as manual red team
    setSystemStatus(SystemStatus.WARNING); // Warning, not Critical (it's a test)
    
    // Inject Test Mode Logs immediately
    logsRef.current = [...logsRef.current.slice(-10), ...MOCK_LOGS_STRIKE];

    if (strikeTimeoutRef.current) clearTimeout(strikeTimeoutRef.current);
    
    strikeTimeoutRef.current = window.setTimeout(() => {
      console.log("[RED TEAM] Strike Timeout. Reverting to Nominal.");
      setSimulationMode('NOMINAL');
      setSimulationSource('UNKNOWN');
      setSystemStatus(SystemStatus.NOMINAL);
      consecutiveZombieTicksRef.current = 0; // Reset counters
      isFractureActiveRef.current = false;
      
      // Reset Hiccup
      setIsStalled(false);
      stallTickCountRef.current = 0;
    }, durationSeconds * 1000);
  };

  // Uplink Heartbeat Logic
  useEffect(() => {
    let heartbeatInterval: number;
    
    if (systemStatus === SystemStatus.UPLINK_FAILURE) {
        heartbeatInterval = window.setInterval(async () => {
            console.log("[HEARTBEAT] Attempting auto-reconnect...");
            setSystemStatus(SystemStatus.UPLINK_RECONNECTING);
            
            // Simple ping with low priority to check connection
            const result = await sendNtfyAlert("Heartbeat: Auto-Reconnection Successful", 1);
            
            if (result.success) {
                console.log("[HEARTBEAT] Connection restored.");
                // Reset to Nominal unless fracture logic overrides it immediately next tick
                setSystemStatus(SystemStatus.NOMINAL); 
                logsRef.current = [...logsRef.current, "[INFO]: UPLINK_RESTORED. SIGNAL_STRENGTH_100%"];
            } else {
                console.warn("[HEARTBEAT] Connection failed.");
                setSystemStatus(SystemStatus.UPLINK_FAILURE);
            }
        }, 15000); // 15s retry interval
    }
    
    return () => clearInterval(heartbeatInterval);
  }, [systemStatus]);

  const attemptManualResync = async () => {
      setSystemStatus(SystemStatus.UPLINK_RECONNECTING);
      logsRef.current = [...logsRef.current, "[CMD]: INITIATING_MANUAL_HANDSHAKE..."];
      
      const result = await sendNtfyAlert("Manual Resync: Connection Verified", 1);
      
      if (result.success) {
          setSystemStatus(SystemStatus.NOMINAL);
          logsRef.current = [...logsRef.current, "[SUCCESS]: HANDSHAKE_ACCEPTED. LINK_SECURE."];
      } else {
          setSystemStatus(SystemStatus.UPLINK_FAILURE);
          logsRef.current = [...logsRef.current, "[FAILURE]: HANDSHAKE_REJECTED. GATEWAY_TIMEOUT."];
      }
  };

  // GitLab Actuation Bridge (Moved up for scope visibility)
  const triggerGitLabActuation = async (command: string) => {
    logsRef.current = [...logsRef.current, `[ACTION] Initiating GitLab Agent Actuation: ${command}`];
    try {
      const response = await fetch('https://gitlab.com/api/v4/projects/YOUR_PROJECT_ID/trigger/pipeline', {
        method: 'POST',
        body: JSON.stringify({
          token: 'YOUR_TRIGGER_TOKEN',
          ref: 'main',
          variables: { "REMEDIATION_CMD": command }
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        logsRef.current = [...logsRef.current, `[SUCCESS] Actuation Signal Received by GitLab Agent. Running remediation...`];
      }
    } catch (error: any) {
      logsRef.current = [...logsRef.current, `[ERROR] Actuation Link Severed: ${error.message}`];
    }
  };

  // Final Execution of Remediation (Post-Delay or Manual)
  const executeFinalRemediation = async (point: TelemetryPoint, isManual: boolean, ttrMs: number, customSource?: string) => {
      setRemediationTimer(null); // Stop timer
      setRemediationPhase('HOLD'); // Reset phase
      setCommandStatus(`[CMD]: gcloud compute instances reset ${GCP_CONFIG.INSTANCE_ID} --zone ${GCP_CONFIG.ZONE} ... EXECUTING`);
      
      // Calculate LATENCY_HUMAN_ACTION (Time before reset is triggered)
      // ttrMs passed here is (now - start), which effectively captures the decision latency
      const humanLatencyMs = ttrMs;

      const resetSuccess = await executeInstanceReset();
      
      // Calculate TOTAL_TTR (Time including reset duration)
      // Since we reset the timer start on completion, we can calculate total time now
      const totalTtrMs = Date.now() - remediationStartTimeRef.current;
      const totalTtrSec = Math.floor(Math.max(0, totalTtrMs) / 1000);
      const latencySec = Math.floor(Math.max(0, humanLatencyMs) / 1000);

      // Increment Shift Counter
      const newCount = shiftRemediationCount + 1;
      setShiftRemediationCount(newCount);

      // Capture Stall State before reset
      const stallDetectedDuringEvent = isStalled;

      // UPGRADE: Adversarial Traceability
      let source = isManual 
        ? "DASHBOARD_CONSOLE" 
        : "AUTO_SENTINEL // DRILL_FAILED_HUMAN_OOB_TIMEOUT";
      
      if (customSource) {
          source = customSource;
      }
      
      // Use the stored alert success status if we are in auto mode flow
      const alertSuccess = isManual ? lastAlertSuccessRef.current : true;
      const geminiMatch = lastGeminiMatchRef.current;

      // Log to CSV - Triggers 3rd Shift Auditor
      // UPGRADE: Pass geminiMatch, Source, Shift Count, Stall Status, Queue Delay, and Human Latency
      logAuditEntry(point, alertSuccess, resetSuccess, source, geminiMatch, totalTtrSec, remediationStartTimeRef.current, newCount, stallDetectedDuringEvent, 0, latencySec);
      
      if (resetSuccess) {
          lastResetTimeRef.current = Date.now();
          logsRef.current = [...logsRef.current, `[SYSTEM]: RECOVERY_COMPLETE. SOURCE: ${source}. TTR: ${totalTtrSec}s`];
          setCommandStatus(null);
          
          setSimulationMode('NOMINAL');
          setSimulationSource('UNKNOWN');
          setSystemStatus(SystemStatus.NOMINAL);
          consecutiveZombieTicksRef.current = 0;
          isFractureActiveRef.current = false;
          setDiagnosticResult(null);
          
          // Reset Hiccup State
          setIsStalled(false);
          stallTickCountRef.current = 0;
      } else {
          // If autonomous mode failed, we MUST enforce cooldown to prevent loops
          if (!isManual) {
             lastResetTimeRef.current = Date.now();
             logsRef.current = [...logsRef.current, `[AUTONOMOUS]: REMEDIATION_FAILED. ENFORCING_COOLDOWN_PROTOCOL.`];
          }

          setCommandStatus("[ERROR]: CLOUD_API_FAILURE. RESET ABORTED.");
          logsRef.current = [...logsRef.current, "[CRITICAL]: RESET_FAILED. MANUAL INTERVENTION REQUIRED."];
      }
      isHealingInProgressRef.current = false;
      
      // RESET TTR STOPWATCH
      remediationStartTimeRef.current = 0;
  };

  // Self-Healing Workflow (Initiator)
  const initiateSelfHealing = async (point: TelemetryPoint, manualTrigger = false) => {
    const now = Date.now();

    // =========================================================================
    // ALERT SEQUENCE: NOW HANDLED IN checkHeuristics FOR INSTANT TRIGGER
    // =========================================================================
    
    // CALCULATE MATCH (PRELIMINARY)
    let isMatch = false;
    if (diagnosticResultRef.current) {
         if (simulationModeRef.current === 'ZOMBIE' && diagnosticResultRef.current.status === SystemStatus.ZOMBIE_KERNEL) isMatch = true;
         else if (simulationModeRef.current === 'CPU_STRIKE' && (diagnosticResultRef.current.status === SystemStatus.WARNING || diagnosticResultRef.current.status === SystemStatus.CRITICAL)) isMatch = true;
    }
    lastGeminiMatchRef.current = isMatch;


    // INTERRUPT LOGIC: If timer is running and user clicks button, this is USER_OOB intervention
    if (manualTrigger && (remediationTimerRef.current !== null || isHealingInProgressRef.current)) {
        logsRef.current = [...logsRef.current, "[CMD]: FORENSIC_HOLD_OVERRIDDEN_BY_USER."];
        executeFinalRemediation(point, true, now - remediationStartTimeRef.current);
        return;
    }

    // PURE MANUAL LOGIC: No timer running, user forces reset (Pre-emptive)
    if (manualTrigger) {
        setCommandStatus(`[CMD]: MANUAL_REMEDIATION_TRIGGERED...`);
        if (remediationStartTimeRef.current === 0) {
            remediationStartTimeRef.current = now;
        }
        
        let manualMatch = false;
        if (diagnosticResultRef.current) {
            manualMatch = (simulationModeRef.current === 'ZOMBIE' && diagnosticResultRef.current.status === SystemStatus.ZOMBIE_KERNEL) ||
                          (simulationModeRef.current === 'CPU_STRIKE' && diagnosticResultRef.current.status === SystemStatus.WARNING);
        }
        lastGeminiMatchRef.current = manualMatch;

        // Even for manual triggers, we broadcast alert if not already sent
        await broadcastCriticalAlert(point, "MANUAL_RESET_TRIGGERED", undefined, manualMatch);
        lastAlertSuccessRef.current = true; 
        executeFinalRemediation(point, true, now - remediationStartTimeRef.current);
        return;
    }

    // HYBRID AUTOMATION: Check if this is a SCHEDULED WAVE
    if (simulationSourceRef.current === 'AUTO_SCHEDULER') {
         logsRef.current = [...logsRef.current, `[SENTINEL]: SCHEDULED_AUTOMATION_PROTOCOL_ACTIVE. BYPASSING_HUMAN_GATE.`];
         
         setIsAutonomousActuating(true);
         setTimeout(() => {
             const cmd = diagnosticResultRef.current?.interventions?.[0]?.cliCommand || "gcloud compute instances reset --all";
             triggerGitLabActuation(cmd);
             executeFinalRemediation(point, false, Date.now() - remediationStartTimeRef.current, "AUTO_SENTINEL_SCHEDULED");
             setIsAutonomousActuating(false);
         }, 2000);
         return;
    }
    
    // AUTOMATED LOGIC (Standard Heuristic Trigger)
    const timeSinceLastReset = now - lastResetTimeRef.current;
    
    if (timeSinceLastReset < REBOOT_COOLDOWN_MS) {
      console.warn("[SELF_HEALING]: Reset blocked by Safety Governor (Cool-down active).");
      logsRef.current = [...logsRef.current, `[WARN]: AUTO_RESET_BLOCKED. COOL_DOWN_ACTIVE (${Math.ceil((REBOOT_COOLDOWN_MS - timeSinceLastReset)/1000)}s remaining)`];
      logAuditEntry(point, false, false, "AUTOMATED_HEURISTIC_TRIGGER", false, 0);
      return;
    }

    if (isHealingInProgressRef.current) return;
    isHealingInProgressRef.current = true;
    
    if (remediationStartTimeRef.current === 0) {
        remediationStartTimeRef.current = now;
    }

    // 0. GENERATE FORENSIC HYPOTHESIS (Background process)
    invoke_ai_analysis({
        trigger: "HEURISTIC_ZOMBIE_DETECTION",
        timestamp: Date.now(),
        metrics: point,
        alert_status: "ALERT_DISPATCHED",
        remediation_source: "PURPLE_TEAM_PRE_EMPTIVE"
    }).catch(e => console.warn("Forensic generation failed", e));

    // 2. AUTONOMOUS OVERRIDE (3RD SHIFT ONLY)
    if (currentShiftRef.current === '3RD_SHIFT') {
         logsRef.current = [...logsRef.current, `[AUTONOMOUS]: 3rd Shift Sentinel has bypassed the human gate. Dispatching remediation to GitLab Duo Agent...`];
         setIsAutonomousActuating(true);
         setTimeout(() => {
             if (remediationButtonRef.current) {
                 const rect = remediationButtonRef.current.getBoundingClientRect();
                 setShockwavePos({
                     x: rect.left + rect.width / 2,
                     y: rect.top + rect.height / 2
                 });
             }
             setShockwaveActive(true);
             const cmd = diagnosticResultRef.current?.interventions?.[0]?.cliCommand || "gcloud compute instances reset --all";
             triggerGitLabActuation(cmd);
             executeFinalRemediation(point, false, Date.now() - remediationStartTimeRef.current, "AUTO_REMEDIATION_3RD_SHIFT");
             setIsAutonomousActuating(false);
             setTimeout(() => setShockwaveActive(false), 2000);
         }, 2000);
         return;
    }

    // 3. START FORENSIC DELAY PROTOCOL (1st/2nd Shift)
    // IMPORTANT: Timer scale set to 180s (3 minutes)
    setRemediationPhase('HOLD');
    setRemediationTimer(180); 
    setCommandStatus(`[CMD]: INITIATING FORENSIC HOLD (180s)...`);
  };

  // ADMIN STRIKE 5-SECOND PULSE LOGIC
  useEffect(() => {
    if (simulationSource === 'ADMIN_REMOTE_STRIKE') {
      const timer = setTimeout(() => {
        if (simulationMode === 'ZOMBIE') {
           setSimulationMode('NOMINAL');
           setSimulationSource('UNKNOWN');
           setSystemStatus(SystemStatus.NOMINAL);
           isFractureActiveRef.current = false;
           consecutiveZombieTicksRef.current = 0;
           logsRef.current = [...logsRef.current, "[INFO]: REMOTE_STRIKE_PULSE_ENDED. TELEMETRY_NORMALIZING."];
        }
      }, 5000); // 5 Seconds Exact Pulse
      return () => clearTimeout(timer);
    }
  }, [simulationSource, simulationMode]);

  // Simulation Tick
  useEffect(() => {
    let interval: number;

    if (isPlaying) {
      interval = window.setInterval(() => {
        setHistory(prev => {
          const now = Date.now();
          
          let newCpu, newRam, newThreads, newIo;

          if (simulationMode === 'ZOMBIE') {
            // ADMIN STRIKE LOGIC: EXACT METRICS
            if (simulationSource === 'ADMIN_REMOTE_STRIKE') {
                newCpu = 0.01;
                newRam = 98.0;
                newThreads = prev[prev.length - 1].threads; // Freeze threads
                newIo = 0.0;
                // Add a log only occasionally to avoid spamming
                if (Math.random() > 0.8) {
                   logsRef.current = [...logsRef.current.slice(-10), ...MOCK_LOGS_ZOMBIE.slice(0, 1)];
                }
            } else {
                newCpu = Math.max(0, (Math.random() * 2));
                newRam = Math.min(99, (prev[prev.length - 1].ram + 2)); 
                newThreads = prev[prev.length - 1].threads + 5; 
                newIo = 0.5;
                logsRef.current = [...logsRef.current.slice(-10), ...MOCK_LOGS_ZOMBIE.slice(0, 1)];
            }
          } else if (simulationMode === 'CPU_STRIKE') {
            newCpu = 95 + Math.random() * 5; 
            newRam = 50 + Math.random() * 10;
            newThreads = 300 + Math.floor(Math.random() * 20);
            newIo = 8 + Math.random() * 4;
            if (Math.random() > 0.7) {
               logsRef.current = [...logsRef.current.slice(-10), MOCK_LOGS_STRIKE[Math.floor(Math.random() * MOCK_LOGS_STRIKE.length)]];
            }
          } else {
            newCpu = 40 + Math.random() * 20;
            newRam = 30 + Math.random() * 5;
            newThreads = 150 + Math.floor(Math.random() * 10 - 5);
            newIo = 2 + Math.random() * 5;
            logsRef.current = [...logsRef.current.slice(-10), ...MOCK_LOGS_NOMINAL.slice(0, 1)];
          }

          // === HICCUP / STALL LOGIC ===
          // Check if RAM > 50% and stable within +/- 0.1% for > 60s
          const ramDelta = Math.abs(newRam - lastRamRef.current);
          const isStable = ramDelta < 0.1;
          const isHighRam = newRam > 50;
          
          if (isStable && isHighRam) {
             stallTickCountRef.current += 1;
             
             // 60 seconds of stall
             if (stallTickCountRef.current > 60 && !isStalled) {
                 setIsStalled(true);
                 logsRef.current = [...logsRef.current, "[ADVISORY]: NOMINAL_STALL_DETECTED // OBSERVING_RECOVERY_POTENTIAL"];
             }
          } else {
             // Reset if pattern breaks
             stallTickCountRef.current = 0;
             if (isStalled) {
                 setIsStalled(false);
                 logsRef.current = [...logsRef.current, "[INFO]: SYSTEM_STALL_CLEARED. MEMORY_FLUX_RETURNED."];
             }
          }
          lastRamRef.current = newRam;
          // ============================

          const newPoint = {
            timestamp: now,
            cpu: newCpu,
            ram: newRam,
            threads: newThreads,
            ioWait: newIo
          };

          const newHistory = [...prev, newPoint].slice(-MAX_HISTORY_POINTS);
          
          checkHeuristics(newPoint);

          return newHistory;
        });
      }, SIMULATION_INTERVAL_MS);
    }

    return () => clearInterval(interval);
  }, [isPlaying, simulationMode, isStalled, simulationSource]);

  // Heuristic Trigger
  const checkHeuristics = useCallback(async (point: TelemetryPoint) => {
    const now = Date.now();

    // Condition: CPU < 5% AND RAM > 90%
    if (point.cpu < 5 && point.ram > 90) {
      consecutiveZombieTicksRef.current += 1;
    } else {
      consecutiveZombieTicksRef.current = 0;
    }

    // Trigger Initial Alert after 3 seconds
    if (consecutiveZombieTicksRef.current === 3 && !isFractureActiveRef.current) {
      console.log("!!! C2 FRACTURE CONFIRMED !!!");
      isFractureActiveRef.current = true;
      
      // TTR START: CAPTURE DETECTION TIME
      if (remediationStartTimeRef.current === 0) {
          remediationStartTimeRef.current = now;
      }

      // INSTANT NOTIFICATION TRIGGER (First Action)
      setCommandStatus(`[CMD]: BROADCASTING IMMEDIATE TACTICAL ALERT...`);
      logsRef.current = [...logsRef.current, `[SYSTEM]: FRACTURE_CONFIRMED. BROADCASTING_ON_ALL_CHANNELS.`];
      broadcastCriticalAlert(point, "ZOMBIE_KERNEL_DETECTED", undefined, false).then(broadcastResults => {
          const emailResult = broadcastResults[1];
          if (emailResult.status === 'fulfilled') {
              const val = emailResult.value as any;
              if (val.success) {
                  if (val.status === 'SIMULATED_FAILOVER') {
                      logsRef.current = [...logsRef.current, "[UPLINK_SIM]: EMAIL_GATEWAY_UNREACHABLE. SIMULATION_MODE_ACTIVE. LOG_PERSISTED_LOCALLY."];
                      lastAlertSuccessRef.current = true;
                  } else {
                      lastAlertSuccessRef.current = true;
                      logsRef.current = [...logsRef.current, "[UPLINK]: EMAIL_DISPATCH_SUCCESSFUL. WAITING_FOR_USER_INTERVENTION."];
                  }
              } else {
                  lastAlertSuccessRef.current = false;
                  logsRef.current = [...logsRef.current, "[UPLINK_WARN]: ALERT_DISPATCH_FAILED. AUTO_REMEDIATION_PENDING."];
              }
          } else {
              lastAlertSuccessRef.current = false;
              logsRef.current = [...logsRef.current, "[UPLINK_WARN]: ALERT_DISPATCH_FAILED. AUTO_REMEDIATION_PENDING."];
          }
      });
      
      const alertResult = await sendNtfyAlert("Zombie Kernel Detected. Systemic Disorientation (C2 Fracture) in progress on GCP Instance.", 5);
      
      if (alertResult.success) {
        if (alertResult.simulated) {
             setSystemStatus(SystemStatus.UPLINK_SIMULATION);
             logsRef.current = [...logsRef.current, "[UPLINK_SIM]: Satellite Link Degradation Detected. Switching to Local Simulation Mode... ALERT_DISPATCHED_TO_ADMIN_ENCRYPTED_NODE"];
        } else {
             setSystemStatus(SystemStatus.C2_FRACTURE_DETECTED);
             logsRef.current = [...logsRef.current, "[CRITICAL]: UPLINK_ESTABLISHED. ALERT_DISPATCHED_TO_SRE_NODE"];
        }
      } else {
        setSystemStatus(SystemStatus.UPLINK_FAILURE);
        logsRef.current = [...logsRef.current, "[CRITICAL_FAILURE]: SATELLITE UPLINK LOST. NOTIFICATION DROPPED."];
      }
      triggerAnalysis(point);
    }

    // Trigger Self-Healing after 3 seconds of persistence
    if (consecutiveZombieTicksRef.current > 3) {
       initiateSelfHealing(point, false);
    }

    // Recovery Logic
    if (isFractureActiveRef.current && point.cpu > 20 && point.ram < 80) {
       isFractureActiveRef.current = false;
       setSystemStatus(SystemStatus.NOMINAL);
       setDiagnosticResult(null);
    }

    // AI Analysis Debounce
    if (now - lastAnalysisTimeRef.current < 10000) return;
    const isZombieSignature = point.cpu < 5 && point.ram > 80;
    const isStrikeSignature = point.cpu > 90;
    
    if ((isZombieSignature || isStrikeSignature) && !isFractureActiveRef.current) {
      lastAnalysisTimeRef.current = now;
      triggerAnalysis(point);
    }

  }, []);

  const triggerAnalysis = async (point: TelemetryPoint) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeSystemState(point, logsRef.current);
      if (isFractureActiveRef.current) {
         // Determine Specific Status Message
         if (simulationSourceRef.current === 'AUTO_SCHEDULER') {
             result.status = SystemStatus.EXECUTING_SCHEDULED_SENTINEL_PROTOCOL;
         } else if (simulationSourceRef.current === 'RED_TEAM_MANUAL' || simulationSourceRef.current === 'ADMIN_CONSOLE_MANUAL' || simulationSourceRef.current === 'ADMIN_REMOTE_STRIKE') {
             result.status = SystemStatus.EMERGENCY_ADVERSARY_EMULATION_IN_PROGRESS;
         } else if (systemStatus === SystemStatus.UPLINK_FAILURE || systemStatus === SystemStatus.UPLINK_RECONNECTING || systemStatus === SystemStatus.UPLINK_SIMULATION) {
             result.status = systemStatus;
         } else {
             result.status = SystemStatus.C2_FRACTURE_DETECTED;
         }
      }
      setDiagnosticResult(result);
      if (!isFractureActiveRef.current && simulationMode !== 'CPU_STRIKE') {
          setSystemStatus(result.status);
      }
      
      // Force update system status based on source for visual compliance
      if (isFractureActiveRef.current) {
          if (simulationSourceRef.current === 'AUTO_SCHEDULER') {
             setSystemStatus(SystemStatus.EXECUTING_SCHEDULED_SENTINEL_PROTOCOL);
         } else if (simulationSourceRef.current === 'RED_TEAM_MANUAL' || simulationSourceRef.current === 'ADMIN_CONSOLE_MANUAL' || simulationSourceRef.current === 'ADMIN_REMOTE_STRIKE') {
             setSystemStatus(SystemStatus.EMERGENCY_ADVERSARY_EMULATION_IN_PROGRESS);
         }
      }

    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSimulation = () => {
    if (simulationMode === 'CPU_STRIKE') return;
    
    const newMode = simulationMode === 'NOMINAL' ? 'ZOMBIE' : 'NOMINAL';
    setSimulationMode(newMode);
    
    if (newMode === 'NOMINAL') {
      setSimulationSource('UNKNOWN');
      setSystemStatus(SystemStatus.NOMINAL);
      consecutiveZombieTicksRef.current = 0;
      isFractureActiveRef.current = false;
      // Reset TTR just in case
      remediationStartTimeRef.current = 0;
      // Reset Hiccup
      setIsStalled(false);
      stallTickCountRef.current = 0;
    } else {
        // Assume manual dashboard toggle
        setSimulationSource('DASHBOARD_MANUAL');
    }
  };

  return (
    <HUDLayout 
        status={systemStatus} 
        remediationTimer={remediationTimer}
        remediationPhase={remediationPhase}
        shiftRemediationCount={shiftRemediationCount}
        isStalled={isStalled}
    >
      <style>{`
        @keyframes crtFlicker {
          0% { opacity: 0.95; }
          5% { opacity: 0.85; }
          10% { opacity: 0.95; }
          15% { opacity: 1; }
          50% { opacity: 0.9; }
          55% { opacity: 0.85; }
          60% { opacity: 0.95; }
          100% { opacity: 0.95; }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .crt-scanline-container {
            position: relative;
            overflow: hidden;
        }
        .crt-scanline-container::before {
            content: " ";
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(255, 0, 0, 0.02), rgba(255, 0, 0, 0.06));
            z-index: 20;
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
        }
        .crt-scanline-bar {
            width: 100%;
            height: 5px;
            background: rgba(0, 255, 65, 0.1);
            position: absolute;
            z-index: 21;
            animation: scanline 3s linear infinite;
            pointer-events: none;
        }
        .crt-active {
            animation: crtFlicker 0.15s infinite;
        }
        
        /* SENTINEL ACTUATION VISUALS */
        @keyframes sentinelGlow {
          0% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.5); border-color: #ef4444; background-color: rgba(69, 10, 10, 0.5); }
          50% { 
            box-shadow: 0 0 25px rgba(${shiftColors.rgb}, 0.8), inset 0 0 10px rgba(${shiftColors.rgb}, 0.3); 
            border-color: ${shiftColors.hex}; 
            background-color: rgba(${shiftColors.rgb}, 0.1); 
            color: ${shiftColors.hex}; 
          }
          100% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.5); border-color: #ef4444; background-color: rgba(69, 10, 10, 0.5); }
        }
        @keyframes shockwaveExpand {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 1; border-width: 2px; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0; border-width: 0; }
        }
        .sentinel-btn-active {
            animation: sentinelGlow 1s ease-in-out infinite;
        }
      `}</style>
      
      {/* SHOCKWAVE EFFECT OVERLAY */}
      {shockwaveActive && (
        <div 
            className="fixed z-50 rounded-full border pointer-events-none"
            style={{
                left: shockwavePos.x,
                top: shockwavePos.y,
                width: '200vw',
                height: '200vw',
                borderColor: shiftColors.hex,
                backgroundColor: `rgba(${shiftColors.rgb}, 0.1)`,
                animation: 'shockwaveExpand 1.5s ease-out forwards'
            }}
        />
      )}

      {/* SHIFT REPORTS MODAL */}
      {showShiftReports && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className={`bg-gray-950 border border-hud-primary w-full max-w-3xl h-[80vh] flex flex-col shadow-[0_0_50px_rgba(14,165,233,0.2)] crt-scanline-container ${isGeneratingReport ? 'crt-active' : ''}`}>
                  <div className="crt-scanline-bar"></div>
                  
                  {/* Modal Header */}
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 z-30">
                      <div className="flex flex-col">
                          <div className="flex items-center gap-4 mb-2">
                             <button 
                                onClick={() => setShowShiftReports(false)}
                                className="flex items-center justify-center gap-2 p-1.5 px-3 rounded font-bold transition-all bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-[10px] font-mono uppercase tracking-widest"
                             >
                                <ArrowLeft size={12} />
                                [[ EXIT_TO_MAIN_HUD ]]
                             </button>
                          </div>
                          <div className="flex items-center gap-2 text-hud-primary">
                              <FileText className="w-5 h-5" />
                              <h2 className="text-xl font-display uppercase tracking-widest">// FORENSIC_LOGS // WATCH: {currentShift}</h2>
                          </div>
                          <div className={`text-[10px] font-mono mt-1 flex items-center gap-2 ${isAuditorOnline() ? 'text-emerald-500' : 'text-red-500'}`}>
                              <div className={`w-2 h-2 rounded-full ${isAuditorOnline() ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></div>
                              [AUDITOR_STATUS]: {isAuditorOnline() ? 'ONLINE' : 'OFFLINE'}
                          </div>
                      </div>
                      <div className="flex items-center gap-4">
                         
                         {/* ARCHIVE TOGGLE */}
                         <button 
                            onClick={() => setShowFullArchive(!showFullArchive)}
                            className={`flex items-center gap-1 text-[10px] font-mono border px-2 py-1 rounded transition-all ${
                                showFullArchive 
                                ? 'bg-hud-primary text-black border-hud-primary' 
                                : 'bg-black border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'
                            }`}
                        >
                            <Database className="w-3 h-3" />
                            {showFullArchive ? 'HIDE_ARCHIVE' : 'SHOW_FULL_ARCHIVE'}
                        </button>

                         {/* DATA SHOVEL: CSV DOWNLOAD */}
                        <button 
                            onClick={downloadAuditLog}
                            className="flex items-center gap-1 text-[10px] font-mono border px-2 py-1 rounded transition-all bg-black border-gray-600 text-gray-400 hover:text-emerald-400 hover:border-emerald-500"
                        >
                            <Download className="w-3 h-3" />
                            DOWNLOAD_CSV
                        </button>

                        <button 
                            onClick={handleDebugUplink}
                            disabled={isGeneratingReport}
                            className={`flex items-center gap-1 text-[10px] font-mono border px-2 py-1 rounded transition-all ${
                                isGeneratingReport 
                                ? 'bg-emerald-900/50 text-emerald-300 border-emerald-500 animate-pulse cursor-wait' 
                                : 'bg-black border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'
                            }`}
                        >
                            <Cpu className="w-3 h-3" />
                            {isGeneratingReport ? 'UPLINK_ACTIVE...' : 'DEBUG_AI_UPLINK'}
                        </button>
                        <div className="text-[10px] text-emerald-500 animate-pulse font-mono hidden sm:block">
                            [AUDITOR]: PERSISTENT_MODE_ACTIVE
                        </div>
                        <button onClick={() => setShowShiftReports(false)} className="text-gray-500 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                      </div>
                  </div>

                  {/* Modal Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono z-30 relative">
                      {isGeneratingReport && (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 text-emerald-500 font-mono text-sm tracking-widest">
                             <div className="animate-pulse flex flex-col items-center gap-2">
                                <RefreshCw className="w-8 h-8 animate-spin" />
                                <div>[ESTABLISHING_SECURE_HANDSHAKE]</div>
                                <div className="text-[10px] opacity-70">SENTINEL-80s :: ANALYZING_TELEMETRY</div>
                             </div>
                          </div>
                      )}

                      {filteredReports.length === 0 ? (
                          <div className="text-gray-500 text-center mt-10">
                              {showFullArchive ? 'NO_REPORTS_IN_ARCHIVE' : `NO_REPORTS_FILED_FOR_${currentShift}`}
                          </div>
                      ) : (
                          filteredReports.map((report, idx) => (
                              <div key={idx} className="border border-gray-700 bg-black/50 p-4 rounded hover:border-gray-500 transition-colors">
                                  <div className="flex justify-between text-xs text-gray-500 mb-2 border-b border-gray-800 pb-2">
                                      <span>TIMESTAMP: {new Date(report.timestamp).toLocaleString()}</span>
                                      <span className="text-hud-warning uppercase">TRIGGER: {report.trigger}</span>
                                  </div>
                                  
                                  {/* REFINED UI: Full Forensic Block */}
                                  <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto bg-[#0a0f14] p-2 border border-gray-800 rounded">
                                      {report.content}
                                  </pre>
                                  
                                  {report.aiConfidence && (
                                      <div className="mt-2 text-[10px] text-right text-gray-600 font-bold">
                                          DIAGNOSTIC_CONFIDENCE: <span className="text-emerald-500">{report.aiConfidence}</span>
                                      </div>
                                  )}
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-12 gap-6 h-full">
        {/* Left Column: Controls & Stats */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          
          {/* Control Panel */}
          <div className="hud-border p-4">
            <h3 className="text-xs text-hud-muted uppercase tracking-widest mb-4">Sim Controls</h3>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all ${isPlaying ? 'bg-hud-dark border border-hud-muted text-hud-text' : 'bg-hud-primary text-black'}`}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                {isPlaying ? 'PAUSE TELEMETRY' : 'RESUME STREAM'}
              </button>

              <button 
                onClick={toggleSimulation}
                disabled={simulationMode === 'CPU_STRIKE'}
                className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all ${
                  simulationMode === 'ZOMBIE' 
                  ? 'bg-red-900/50 border border-red-500 text-red-100 animate-pulse' 
                  : 'bg-hud-dark border border-hud-muted text-hud-text hover:border-hud-primary disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {simulationMode === 'ZOMBIE' ? <RotateCcw size={16} /> : <AlertOctagon size={16} />}
                {simulationMode === 'ZOMBIE' ? 'RESET SIMULATION' : 'INJECT ZOMBIE KERNEL'}
              </button>

              <button 
                onClick={() => triggerPlannedStrike(30)}
                disabled={simulationMode === 'CPU_STRIKE'}
                className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all relative overflow-hidden group ${
                  simulationMode === 'CPU_STRIKE'
                  ? 'bg-amber-600 text-black cursor-not-allowed'
                  : 'bg-hud-dark border border-amber-500/50 text-amber-500 hover:bg-amber-500/10'
                }`}
              >
                <Zap size={16} className={simulationMode === 'CPU_STRIKE' ? 'animate-bounce' : ''} />
                <span className="text-xs">{simulationMode === 'CPU_STRIKE' ? 'STRIKE IN PROGRESS...' : 'INITIATE ADVERSARY EMULATION'}</span>
                {simulationMode !== 'CPU_STRIKE' && <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>}
              </button>

              {/* Force Cloud Reset Button */}
              <button 
                ref={remediationButtonRef}
                onClick={() => {
                  const cmd = diagnosticResult?.interventions?.[0]?.cliCommand || "gcloud compute instances reset --all";
                  triggerGitLabActuation(cmd);
                  initiateSelfHealing(history[history.length-1], true);
                }}
                disabled={isAutonomousActuating}
                className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all border ${
                  isAutonomousActuating 
                    ? 'sentinel-btn-active cursor-wait'
                    : remediationTimer !== null
                        ? 'bg-red-900 border-red-500 text-red-100 animate-pulse'
                        : 'bg-hud-dark border-red-700 text-red-500 hover:bg-red-900/20'
                }`}
              >
                {isAutonomousActuating ? <RefreshCw size={16} className="animate-spin" /> : <ServerCrash size={16} />}
                <span className="text-xs">
                   {isAutonomousActuating ? `[[SHIFT_${currentShift}_ACTUATING...]]` : `[COMMIT_REMEDIATION_TO_${currentShift}]`}
                </span>
              </button>

              {/* Manual Resync Button - Only appears on Failure */}
              {(systemStatus === SystemStatus.UPLINK_FAILURE || systemStatus === SystemStatus.UPLINK_RECONNECTING) && (
                  <button 
                    onClick={attemptManualResync}
                    disabled={systemStatus === SystemStatus.UPLINK_RECONNECTING}
                    className={`flex items-center justify-center gap-2 p-3 rounded font-bold transition-all border ${
                        systemStatus === SystemStatus.UPLINK_RECONNECTING
                        ? 'bg-orange-900/50 border-orange-500 text-orange-200 cursor-wait'
                        : 'bg-hud-dark border-orange-500 text-orange-500 hover:bg-orange-500/10'
                    }`}
                  >
                    <RefreshCw size={16} className={systemStatus === SystemStatus.UPLINK_RECONNECTING ? 'animate-spin' : ''} />
                    <span className="text-xs">{systemStatus === SystemStatus.UPLINK_RECONNECTING ? 'SYNCING...' : 'MANUAL UPLINK RESYNC'}</span>
                  </button>
              )}

              {/* VIEW SHIFT LOGS BUTTON */}
              <button 
                onClick={() => setShowShiftReports(true)}
                className="flex items-center justify-center gap-2 p-2 rounded font-bold transition-all bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 mt-2"
              >
                <FileText size={16} />
                <span className="text-xs">VIEW {currentShift} REPORTS</span>
              </button>

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

          {/* Quick Stats */}
          <div className="hud-border p-4 flex-1">
             <h3 className="text-xs text-hud-muted uppercase tracking-widest mb-4">Live Metrics</h3>
             <div className="space-y-4 font-mono">
               <div className="flex justify-between items-center">
                 <span className="text-gray-400">CPU LOAD</span>
                 <span className={`text-xl ${
                   history[history.length-1]?.cpu > 90 ? 'text-amber-500 font-bold' :
                   history[history.length-1]?.cpu < 5 ? 'text-red-500 font-bold' : 'text-sky-400'
                 }`}>
                   {history[history.length-1]?.cpu.toFixed(1)}%
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-400">RAM USAGE</span>
                 <span className={`text-xl ${history[history.length-1]?.ram > 80 ? 'text-red-500 font-bold' : 'text-emerald-400'}`}>
                   {history[history.length-1]?.ram.toFixed(1)}%
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-400">THREAD COUNT</span>
                 <span className="text-xl text-amber-400">
                   {history[history.length-1]?.threads}
                 </span>
               </div>
             </div>
             
             {/* Log Stream Mini */}
             <div className="mt-6 pt-4 border-t border-gray-800">
               <h3 className="text-xs text-hud-muted uppercase tracking-widest mb-2 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <span>System Kernel Log</span>
                    {queueDepth > 0 && (
                        <span className="bg-yellow-900/50 text-yellow-400 text-[10px] px-1 rounded border border-yellow-600 flex items-center gap-1 animate-pulse">
                            <Layers size={8} /> [QUEUE_DEPTH: {queueDepth}]
                        </span>
                    )}
                 </div>
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
               </h3>

               {/* Command Status Bar */}
               {commandStatus && (
                 <div className="mb-2 p-2 bg-black border border-hud-primary/50 text-xs font-mono text-hud-primary animate-pulse break-all">
                   {commandStatus}
                 </div>
               )}

               <div className="h-48 overflow-hidden relative font-mono text-[10px] text-gray-500 leading-tight">
                  <div className="absolute inset-0 bg-gradient-to-t from-hud-dark to-transparent z-10"></div>
                  {logsRef.current.slice(-6).map((log, i) => (
                    <div key={i} className={`mb-1 truncate opacity-70 ${
                        log.includes('[CRITICAL]: UPLINK') ? 'text-[#FF4D6D] font-bold animate-pulse' :
                        log.includes('[CRITICAL_FAILURE]') ? 'text-[#FFA500] font-bold animate-pulse' :
                        log.includes('[UPLINK_ERROR]') ? 'text-[#FFA500] font-bold animate-pulse' :
                        log.includes('[UPLINK_SIM]') ? 'text-[#FFA500] font-bold animate-pulse' :
                        log.includes('[SYSTEM]: VIRTUAL_NODE') ? 'text-emerald-400 font-bold' :
                        log.includes('[TEST_MODE]') ? 'text-amber-500 font-bold' :
                        log.includes('[TRAFFIC_CONTROL]') ? 'text-yellow-400 font-bold' :
                        log.includes('[ADVISORY]') ? 'text-[#FFD700] font-bold animate-pulse' : ''
                    }`}>{log}</div>
                  ))}
               </div>
             </div>
          </div>

        </div>

        {/* Center: Charts */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6 h-[400px] lg:h-auto">
          <div className="flex-1 min-h-[250px]">
            <TelemetryPanel data={history} />
          </div>
          <div className="h-[250px]">
            <AdversaryRadar 
              current={history[history.length-1] || { cpu: 0, ram: 0, threads: 0, ioWait: 0, timestamp: 0 }} 
              isStrikeActive={simulationMode === 'CPU_STRIKE'}
            />
          </div>
        </div>

        {/* Right: AI Diagnostics */}
        <div className="col-span-12 lg:col-span-4 h-[500px] lg:h-auto">
          <DiagnosticsPanel result={diagnosticResult} loading={isAnalyzing} />
        </div>
      </div>
    </HUDLayout>
  );
};