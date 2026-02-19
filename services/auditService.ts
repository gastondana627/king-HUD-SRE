import { GoogleGenAI } from "@google/genai";
import { TelemetryPoint } from '../types';
import { sendEmailAlert } from './notificationService';

// GitLab Narrative: Implemented continuous security validation loop to simulate recurring adversary behavior and audit system resilience.

// UPGRADE: Kaggle-Ready Dataset Schema V2
// High-Resolution Timestamps & Standardized Feature Engineering
// Added LATENCY_HUMAN_ACTION for precise reaction time tracking separate from system reboot time.
// REFACTOR: HEURISTIC_CONFIDENCE -> AI_FORENSIC_CONFIDENCE
// ADDED: REMEDIATION_TYPE (Manual vs Sentinel)
export const CSV_HEADER = "UTC_DATE,UTC_TIME_PRECISION,UNIX_EPOCH,INCIDENT_UUID,TRIGGER_TYPE,REMEDIATION_TYPE,CPU_PEAK,RAM_PEAK,AI_THOUGHT_LATENCY_SEC,TOTAL_RECOVERY_TIME_SEC,SHIFT_ID,ASSOCIATED_DRILL,GEMINI_HYPOTHESIS_MATCH,AI_FORENSIC_CONFIDENCE,COGNITIVE_LOAD_SCORE,STALL_DETECTED,QUEUE_DELAY_SEC,IS_ADVERSARY_MODE,LATENCY_HUMAN_ACTION_SEC";
const STORAGE_KEY = "telemetry_audit.csv";
const HISTORY_KEY = "KING_HUD_HISTORY"; 
const LAST_REPORT_KEY = "king_hud_last_daily_report";
const ACTIVE_DRILL_KEY = "KING_HUD_ACTIVE_DRILL";

// Persist peak confidence for the active incident to prevent decay
let activeIncidentPeakConfidence = 0;

// Helper for Environment Variable compatibility (Vercel/Vite/Node)
const getEnvVar = (key: string) => {
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
             // @ts-ignore
             return process.env[key];
        }
    } catch (e) { /* ignore */ }

    try {
        // @ts-ignore
        const meta = import.meta;
        // @ts-ignore
        if (meta && meta.env) {
             // @ts-ignore
            return meta.env[`VITE_${key}`];
        }
    } catch (e) { /* ignore */ }
    
    return '';
};

// Use VITE_GEMINI_API_KEY for Gemini
const getGeminiKey = () => getEnvVar('GEMINI_API_KEY') || getEnvVar('API_KEY');
const getSendGridKey = () => getEnvVar('SENDGRID_API_KEY');

// Auditor is only ONLINE if BOTH the Cognitive Layer (Gemini) and Uplink Layer (SendGrid) are provisioned.
export const isAuditorOnline = () => !!getGeminiKey() && !!getSendGridKey();

// Dynamic Client Instantiation for Uplink Stability
let aiClient: GoogleGenAI | null = null;

const getAIClient = (forceReset = false) => {
    if (!aiClient || forceReset) {
        console.log("[AUDIT_SERVICE]: Instantiating new Forensic AI Client...");
        aiClient = new GoogleGenAI({ apiKey: getGeminiKey() });
    }
    return aiClient;
};

// SHIFT BOUNDARIES (CST/CDT)
export const SHIFT_1_START_HOUR = 9;  // 09:00 AM
export const SHIFT_2_START_HOUR = 17; // 05:00 PM
export const SHIFT_3_START_HOUR = 1;  // 01:00 AM

// SHIFT CALCULATION LOGIC (CST)
export const getCurrentShift = (): string => {
  // Use CST/CDT (America/Chicago)
  const timeString = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hour12: false
  });
  
  const hour = parseInt(timeString);

  // 1st Shift: 9 AM - 5 PM (09:00 - 16:59)
  if (hour >= SHIFT_1_START_HOUR && hour < SHIFT_2_START_HOUR) return "1ST_SHIFT";
  
  // 2nd Shift: 5 PM - 1 AM (17:00 - 00:59)
  // Handles 17, 18, 19, 20, 21, 22, 23, 0
  if (hour >= SHIFT_2_START_HOUR || hour === 0) return "2ND_SHIFT";
  
  // 3rd Shift: 1 AM - 9 AM (01:00 - 08:59)
  return "3RD_SHIFT";
};

export const startAuditScheduler = (triggerWave: (source: string) => void) => {
  let lastTriggerHour = -1;

  console.log(`[AUDIT_SCHEDULER]: Continuous Security Validation Loop Active. Monitoring Shift Patterns (CST)...`);
  
  // Check every minute to ensure we catch the top of the hour
  const interval = setInterval(() => {
    // Get CST Time
    const cstDate = new Date().toLocaleString("en-US", {
        timeZone: "America/Chicago"
    });
    const dt = new Date(cstDate);
    const hour = dt.getHours();
    const minute = dt.getMinutes();

    // Check for EOD Report at 08:00 CST (End of 3rd Shift)
    // We pass strict CST logic here, but defer execution to checkAndSendDailySummary's internal logic
    checkAndSendDailySummary();

    // SCHEDULING LOGIC:
    // Only trigger if we haven't triggered this hour yet
    if (lastTriggerHour !== hour) {
        // Trigger at the top of the hour (minute 0)
        // In a real app, we might use cron, but this works for the simulation loop
        if (minute === 0) {
            let shouldTrigger = false;

            // 1. Shift-Start Automation (09:00 CST and 17:00 CST)
            if (hour === 9 || hour === 17) {
                console.log(`[AUDIT_SCHEDULER]: Shift Start Detected (${hour}:00 CST). Initiating Scheduled Sentinel Protocol.`);
                shouldTrigger = true;
            }

            // 2. Wits-End Ramp-Up (3rd Shift Hourly: 01:00 - 08:00 CST)
            // 3rd Shift starts at 01:00. 08:00 is the end of the shift/handover.
            if (hour >= 1 && hour <= 8) {
                console.log(`[AUDIT_SCHEDULER]: 3rd Shift Intensity Protocol (${hour}:00 CST). Initiating Autonomous Wave.`);
                shouldTrigger = true;
            }

            if (shouldTrigger) {
                triggerWave("AUTO_SCHEDULER");
                lastTriggerHour = hour;
            }
        }
    }
  }, 30000); // Check every 30 seconds to be safe on minute boundaries

  return () => clearInterval(interval);
};

export const checkAndSendDailySummary = async () => {
  const nowMs = Date.now();
  
  // EOD CONSTRAINT: 08:00 AM CST (End of 3rd Shift)
  const options: Intl.DateTimeFormatOptions = { timeZone: "America/Chicago", hour: "numeric", hour12: false };
  const currentHour = parseInt(new Date().toLocaleString("en-US", options));

  // Only run during the 8 AM hour (08:00 - 08:59)
  if (currentHour !== 8) {
     return;
  }
  
  const lastReport = localStorage.getItem(LAST_REPORT_KEY);
  // Prevent duplicate sends in the same hour window (check if sent in last 20 hours to be safe)
  const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;
  
  if (lastReport) {
      const lastTime = parseInt(lastReport);
      if (nowMs - lastTime < TWENTY_HOURS_MS) {
          // Already sent the EOD report for this cycle
          return;
      }
  }

  console.log("[AUDIT_SCHEDULER]: 0800 HOURS CST DETECTED - Initiating EOD Deep Analysis...");

  // Fetch logs from CSV
  const csvContent = localStorage.getItem(STORAGE_KEY);
  if (!csvContent) {
       console.log("[AUDIT_SCHEDULER]: No telemetry logs found.");
       return;
  }

  const lines = csvContent.split('\n');
  const dataLines = lines.slice(1);
  
  // Filter for last 24h
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  
  let totalFractures = 0;
  let totalTTR = 0;
  let humanCount = 0;
  let agentCount = 0;
  const recentLogs: string[] = [];

  dataLines.forEach(line => {
      if (!line.trim()) return;
      const columns = line.split(',');
      const timestamp = parseInt(columns[2]);
      
      if (nowMs - timestamp <= ONE_DAY_MS) {
          recentLogs.push(line);
          totalFractures++;
          
          const ttr = parseFloat(columns[8]) || 0;
          totalTTR += ttr;
          
          const triggerType = columns[4]; // 'AUTO' or 'MANUAL'
          if (triggerType === 'MANUAL') {
              humanCount++;
          } else {
              agentCount++;
          }
      }
  });

  if (recentLogs.length === 0) {
      console.log("[AUDIT_SCHEDULER]: No activity in last 24h to report.");
      localStorage.setItem(LAST_REPORT_KEY, nowMs.toString()); 
      return;
  }
  
  const avgTTR = totalFractures > 0 ? (totalTTR / totalFractures).toFixed(1) : "0";
  const efficiencyRatio = agentCount > 0 ? (humanCount / agentCount).toFixed(2) : (humanCount > 0 ? "INFINITE" : "0.00");

  const metrics = {
      totalFractures,
      avgTTR,
      humanCount,
      agentCount,
      efficiencyRatio
  };

  // Generate Report
  const reportHTML = await generateShiftHandoverReport(recentLogs, metrics);
  
  // Send Email
  if (reportHTML) {
      const emailResult = await sendEmailAlert("KING-HUD | EOD_DEEP_ANALYSIS_REPORT", reportHTML);
      if (emailResult.success) {
          console.log("[AUDIT_SCHEDULER]: EOD Deep Analysis Email Dispatched.");
          localStorage.setItem(LAST_REPORT_KEY, nowMs.toString());
      } else {
          console.error("[AUDIT_SCHEDULER]: Failed to dispatch email.");
      }
  }
};

const generateShiftHandoverReport = async (logs: string[], metrics?: any) => {
    if (!getGeminiKey()) {
        console.warn("[AUDIT_SERVICE]: Cannot generate Daily Report - No API Key");
        return null;
    }

    const systemInstruction = `
        IDENTITY: You are the Senior Forensic Lead (Model: COMMANDER-90s).
        CONTEXT: You are overseeing the KING-HUD SRE Console.
        TASK: Synthesize the last 24 hours of telemetry logs into a 'Shift Handover' report.
        TONE: Authoritative, Brief, Tactical.
        OUTPUT_FORMAT: HTML. Use <h3> for sections, <ul> for lists, <strong> for emphasis.
        
        LOG_FORMAT: ${CSV_HEADER}
    `;
    
    // Limit logs to avoid token limits (take last 50 if too many)
    const logsToAnalyze = logs.length > 50 ? logs.slice(-50) : logs;
    const logData = logsToAnalyze.join('\n');

    const userContent = `
        [SHIFT_DATA_INGEST]:
        ${logData}
        
        [CALCULATED_METRICS_24H]:
        - TOTAL_FRACTURES: ${metrics?.totalFractures || 0}
        - AVG_TTR: ${metrics?.avgTTR || 0}s
        - HUMAN_INTERVENTIONS: ${metrics?.humanCount || 0}
        - AGENT_INTERVENTIONS: ${metrics?.agentCount || 0}
        - HUMAN_VS_AGENT_EFFICIENCY_RATIO: ${metrics?.efficiencyRatio || "N/A"}

        [DIRECTIVE]:
        1. Summarize total incidents (Zombie Kernels vs Admin Strikes).
        2. Identify recurring vulnerabilities.
        3. Analyze Time-To-Recovery (TTR) trends between AUTO_SENTINEL and USER_OOB interventions.
        4. Validate GEMINI_HYPOTHESIS_MATCH accuracy.
        5. CRITICAL: Flag any "DRILL_FAILED_HUMAN_OOB_TIMEOUT" events as 1st Shift coverage gaps (Human-in-the-Loop Failure).
        6. ANALYZE COGNITIVE_LOAD_SCORE: Report if the team is operating at Expert Level (Score ~1) or System Exhaustion (Score 10).
        7. EOD DEEP ANALYSIS: Use the provided calculated metrics to assess team performance. Discuss the Efficiency Ratio.
    `;

    try {
        const client = getAIClient();
        const response = await client.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: userContent,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        const content = response.text || "NO_SUMMARY_GENERATED";
        
        return `
            <div style="font-family: monospace; background: #0a0f14; color: #e2e8f0; padding: 20px; border: 1px solid #0ea5e9;">
                <h2 style="color: #0ea5e9; border-bottom: 1px solid #334155; padding-bottom: 10px;">DAILY FORENSIC SUMMARY</h2>
                <div style="color: #94a3b8; font-size: 12px; margin-bottom: 20px;">
                    GENERATED: ${new Date().toISOString()}<br/>
                    EVENTS_ANALYZED: ${logs.length}
                </div>
                <div style="font-size: 14px; line-height: 1.6;">
                    ${content}
                </div>
                <div style="margin-top: 20px; border-top: 1px solid #334155; padding-top: 10px; color: #64748b; font-size: 10px;">
                    KING-HUD AUTOMATED SRE CONSOLE // SENTINEL-90s
                </div>
            </div>
        `;

    } catch (e) {
        console.error("Daily Summary Gen Failed", e);
        return null;
    }
}

export const logAuditEntry = async (
  metrics: TelemetryPoint, 
  alertSuccess: boolean, 
  remediationTriggered: boolean,
  interventionSource: string, // Maps to SOURCE
  geminiMatch: boolean,       // Maps to GEMINI_HYPOTHESIS_MATCH
  timeToRecovery: number = 0,
  incidentStart?: number,      // Optional start time (timestamp)
  // New: Operational Intensity & Hiccup Logic
  shiftStrikeCount: number = 0,
  stallDetected: boolean = false,
  queueDelay: number = 0, // TRAFFIC CONTROL: Delay in seconds
  // DATA SCIENCE UPGRADE
  humanLatency: number = 0,
  // FORENSIC CONFIDENCE SNAPSHOT
  aiConfidence: number = 0
) => {
  const currentShift = getCurrentShift();
  
  // === DATA SCIENCE POLISH ===
  // 1. High-Resolution Timestamps
  const timestampObj = new Date(incidentStart || Date.now() - (timeToRecovery * 1000));
  const unixEpoch = timestampObj.getTime();
  const utcDate = timestampObj.toISOString().split('T')[0]; // YYYY-MM-DD
  const utcTimePrecision = timestampObj.toISOString().split('T')[1].replace('Z', ''); // HH:MM:SS.mmm

  // 2. Incident UUID (Forensic ID)
  const forensicId = `Z-${Math.floor(Math.random() * 9000 + 1000)}`;

  // 3. Trigger Type Standardization
  let triggerType = "UNKNOWN";
  const src = interventionSource.toUpperCase();
  if (src.includes("AUTO_SCHEDULER")) triggerType = "AUTO";
  else if (src.includes("ADMIN") || src.includes("STRIKE") || src.includes("RED_TEAM")) triggerType = "MANUAL";
  else if (src.includes("SENTINEL") || src.includes("AUTONOMOUS")) triggerType = "AUTO";
  else triggerType = "MANUAL"; // Default fallback

  // 4. Remediation Type (Performance Analysis)
  // If Manual Trigger, it's Manual. If Auto Trigger, it's Sentinel.
  const remediationType = triggerType === "MANUAL" ? "MANUAL_OPERATOR" : "SENTINEL_AI";

  // NEW METADATA: ADVERSARY MODE FILTER
  const isAdversaryMode = src.includes("ADMIN") || src.includes("RED_TEAM") || src.includes("STRIKE");

  // 5. Shift ID Integer Mapping
  const shiftId = currentShift === "1ST_SHIFT" ? 1 : currentShift === "2ND_SHIFT" ? 2 : 3;

  // 6. Heuristic Metrics
  // Simulate Analysis Latency: 1.5s to 4.5s (Typical Gemini/Claude API response time)
  const analysisLatency = (Math.random() * (4.5 - 1.5) + 1.5).toFixed(2);
  
  // 7. Clean TTR (Integer)
  const ttrClean = Math.floor(timeToRecovery);
  const latencyClean = Math.floor(humanLatency);

  // === FORENSIC STITCHING LOGIC ===
  // Retrieve the Active Drill ID from storage if it exists
  const activeDrill = localStorage.getItem(ACTIVE_DRILL_KEY) || "NONE";
  
  // Calculate COGNITIVE_LOAD_SCORE (The 'Scar Tissue' Log)
  let cognitiveScore = 5; // Default Nominal Human Load
  
  if (interventionSource.includes("AUTO_SENTINEL")) {
      cognitiveScore = 10; // System Exhaustion (Timeout)
  } else if (timeToRecovery < 60 && timeToRecovery > 0) {
      cognitiveScore = 1; // Expert Level (Human OOB < 60s)
  }

  // === UNIVERSAL TRIGGER: 3RD SHIFT AUDITOR ===
  if (alertSuccess || remediationTriggered) {
      console.log(`[AUDITOR]: Processing Event from ${interventionSource}. Waking Sentinel-80s...`);
      
      try {
          // Invoke AI analysis but don't block log writing
          invoke_ai_analysis({
              trigger: `SOURCE_${interventionSource} // DRILL_${activeDrill}`, 
              timestamp: Date.now(),
              metrics: metrics,
              alert_status: alertSuccess ? "TRANSMISSION_CONFIRMED" : "TRANSMISSION_FAILED",
              remediation_source: interventionSource,
              ttr: timeToRecovery
          }).catch(err => console.error(err));
      } catch (err) {
          console.error("[AUDITOR]: Forensic Analysis Failed", err);
      }
  }

  // Reset Peak Confidence if this was a completed remediation
  if (timeToRecovery > 0) {
      activeIncidentPeakConfidence = 0;
  }

  // Use the SNAPSHOT value passed from UI/Dashboard for the CSV
  const recordedConfidence = aiConfidence > 0 ? aiConfidence : activeIncidentPeakConfidence;

  // CSV FORMAT: UTC_DATE,UTC_TIME_PRECISION,UNIX_EPOCH,INCIDENT_UUID,TRIGGER_TYPE,REMEDIATION_TYPE,CPU_PEAK,RAM_PEAK,AI_THOUGHT_LATENCY_SEC,TOTAL_RECOVERY_TIME_SEC,SHIFT_ID,ASSOCIATED_DRILL,GEMINI_HYPOTHESIS_MATCH,AI_FORENSIC_CONFIDENCE,COGNITIVE_LOAD_SCORE,STALL_DETECTED,QUEUE_DELAY_SEC,IS_ADVERSARY_MODE,LATENCY_HUMAN_ACTION_SEC
  const line = `\n${utcDate},${utcTimePrecision},${unixEpoch},${forensicId},${triggerType},${remediationType},${metrics.cpu.toFixed(2)},${metrics.ram.toFixed(2)},${analysisLatency},${ttrClean},${shiftId},${activeDrill},${geminiMatch},${recordedConfidence},${cognitiveScore},${stallDetected},${queueDelay},${isAdversaryMode},${latencyClean}`;
  
  const existing = localStorage.getItem(STORAGE_KEY) || CSV_HEADER;
  localStorage.setItem(STORAGE_KEY, existing + line);
  
  console.log(`[AUDIT_LOG]: Appended to ${STORAGE_KEY} -> ${line.trim()}`);

  // CLEANUP: If this was a remediation event (not the strike start), clear the drill
  if (!interventionSource.includes("ADMIN_REMOTE_STRIKE") && !interventionSource.includes("STRIKE")) {
       localStorage.removeItem(ACTIVE_DRILL_KEY);
  }
};

// Gemini Handshake
export const invoke_ai_analysis = async (telemetryPayload: any) => {
  console.log("[AUDIT_SERVICE]: Packaging Telemetry Window for 3rd Shift Handover...");
  
  const shift = getCurrentShift();
  const timestamp = new Date().toISOString();
  const headerPrefix = `[SHIFT_IDENTIFIER: ${shift}] [TIMESTAMP: ${timestamp}]`;

  // --- LOCAL HEURISTICS CALCULATION ---
  const cpu = telemetryPayload.metrics?.cpu || 0;
  const ram = telemetryPayload.metrics?.ram || 0;
  let localHeuristicScore = 15; // Default: Speculative

  // Heuristic Rule: Zombie Kernel (Low CPU, High RAM)
  if (cpu < 5 && ram > 80) localHeuristicScore = 75; // Moderate match
  if (cpu < 2 && ram > 90) localHeuristicScore = 95; // Strong match
  // Heuristic Rule: CPU Strike (High CPU)
  if (cpu > 90) localHeuristicScore = 80;

  // PERSISTENCE LOGIC: Latch peak confidence for this incident
  if (localHeuristicScore > activeIncidentPeakConfidence) {
      activeIncidentPeakConfidence = localHeuristicScore;
  }

  // Helper for status mapping
  const getConfidenceLabel = (score: number) => {
      if (score <= 30) return `SPECULATIVE_FRAGMENTS (${score}%)`;
      if (score <= 70) return `CORRELATED_ANOMALY (${score}%)`;
      return `VERIFIED_C2_FRACTURE (${score}%)`;
  };

  const localConfidenceLabel = getConfidenceLabel(activeIncidentPeakConfidence);

  if (!getGeminiKey()) {
      console.warn("[AUDIT_SERVICE]: Missing Gemini API Key. Switching to Local Heuristics.");
      const errorMsg = "[OFFLINE_MODE]: LOCAL_HEURISTICS_ACTIVE";
      
      const offlineAnalysis = `
[SYSTEM_NOTICE]: UPLINK_SEVERED. SWITCHING_TO_LOCAL_COMPUTE.

HEURISTIC_DUMP:
> CPU_LOAD: ${cpu.toFixed(2)}%
> RAM_RESIDENCY: ${ram.toFixed(2)}%
> PATTERN_MATCH: ${activeIncidentPeakConfidence > 50 ? 'POSITIVE' : 'NEGATIVE'}

HYPOTHESIS:
Local pattern matching algorithms detect signature consistent with infrastructure instability. 
Confidence set to ${activeIncidentPeakConfidence}% based on static threshold logic.
`;
      
      const fullContent = `${headerPrefix}\n${errorMsg}\n${offlineAnalysis}`;

      const reportEntry = {
          id: Date.now(),
          timestamp: timestamp,
          shift: shift,
          trigger: telemetryPayload.trigger,
          content: fullContent,
          integrity: "LOCAL_ONLY",
          aiConfidence: localConfidenceLabel
      };
      
      const existingReports = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      // UI PERFORMANCE OPTIMIZATION: Slice to 20
      const updatedReports = [reportEntry, ...existingReports].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedReports));
      
      return { report: fullContent, confidence: localConfidenceLabel };
  }

  const systemInstruction = `
    IDENTITY: You are the KING-HUD Forensic Lead (Model: SENTINEL-80s).
    TONE: Cold. Precise. Haunting. High-Technical. 1980s Cold Mainframe AI.
    RESTRICTIONS: Do not use conversational filler. No greetings. No apologies.
    VOCABULARY REQUIREMENT: You MUST use terms like 'Neural Decay', 'C2 Fracture', 'Telemetry Pulse', and 'Void-State'.
    CONTEXT: Analyze this infrastructure failure as if you are documenting a catastrophic life-support failure in a deep-space station.
    OUTPUT FORMAT: A single, dense block of forensic text followed by a cryptographic hash.
    
    METRIC REQUIREMENT: You MUST end your response with a confidence score in this exact format: "CONFIDENCE_SCORE: XX%".
    This score represents your certainty that the telemetry indicates a Type 1 Spatial Disorientation (Zombie Kernel) event.
  `;

  const userContent = `
    STATION_LOG_DATA_RECOVERY_FAILURE: Analyze the following telemetry stream for systemic anomalies.
    
    [DATA_STREAM]:
    TRIGGER_SOURCE: ${telemetryPayload.trigger || 'UNKNOWN_VECTOR'}
    METRICS_SNAPSHOT: CPU=${telemetryPayload.metrics?.cpu?.toFixed(2) || 'N/A'}% / RAM=${telemetryPayload.metrics?.ram?.toFixed(2) || 'N/A'}%
    ALERT_UPLINK: ${telemetryPayload.alert_status || 'UNKNOWN'}
    REMEDIATION_SOURCE: ${telemetryPayload.remediation_source || 'PENDING'}
    TIME_TO_RECOVERY: ${telemetryPayload.ttr || 0}s

    [FORENSIC_OBJECTIVE]:
    Analyze the "Duration of Instability". If TTR is 180s, the system auto-remediated after the forensic hold. If TTR < 180s, a human intercepted the protocol (USER_OOB). Analyze the risk of degradation during this window.
    
    [DIRECTIVE]: Generate forensic entry with confidence score.
  `;

  try {
      const client = getAIClient();
      const response = await client.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: userContent,
          config: {
              systemInstruction: systemInstruction,
              maxOutputTokens: 300,
          }
      });

      const reportText = response.text || "NO_ANALYSIS_GENERATED";

      console.log("[AUDIT_SERVICE]: Shift-Audit Generated via Gemini Pro.");
      
      const confidenceMatch = reportText.match(/CONFIDENCE_SCORE:\s*(\d+)%/i);
      const confidenceScoreVal = confidenceMatch ? parseInt(confidenceMatch[1]) : localHeuristicScore;
      
      // Update Peak with AI Score if higher
      if (confidenceScoreVal > activeIncidentPeakConfidence) {
          activeIncidentPeakConfidence = confidenceScoreVal;
      }
      
      const confidenceLabel = getConfidenceLabel(activeIncidentPeakConfidence);
      
      const integrityScore = Math.floor(Math.random() * (100 - 89) + 89);

      const fullContent = `${headerPrefix}\n\n${reportText}`;

      const reportEntry = {
          id: Date.now(),
          timestamp: timestamp,
          shift: shift,
          trigger: telemetryPayload.trigger,
          content: fullContent,
          integrity: `${integrityScore}%`,
          aiConfidence: confidenceLabel
      };

      const existingReports = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      // UI PERFORMANCE OPTIMIZATION: Slice to 20
      const updatedReports = [reportEntry, ...existingReports].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedReports));

      return { report: reportText, confidence: confidenceLabel };

  } catch (e) {
      console.error("[AUDIT_SERVICE]: AI Handshake Failed", e);
      const errorMsg = "FORENSIC_ANALYSIS_FAILED_DUE_TO_NETWORK_ERROR";
      const fullContent = `${headerPrefix}\n${errorMsg}\n[FALLBACK_ESTIMATE]: ${localConfidenceLabel}`;

      const reportEntry = {
          id: Date.now(),
          timestamp: timestamp,
          shift: shift,
          trigger: telemetryPayload.trigger,
          content: fullContent,
          integrity: "ERR",
          aiConfidence: localConfidenceLabel
      };
      
      const existingReports = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const updatedReports = [reportEntry, ...existingReports].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedReports));

      return { report: errorMsg, confidence: localConfidenceLabel };
  }
};

export const resetUplinkConnection = () => {
  aiClient = null;
  console.log("[AUDIT_SERVICE]: Uplink connection reset. Next request will re-handshake.");
};

export const getShiftReports = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (e) {
    console.error("Failed to load shift reports", e);
    return [];
  }
};

// MULTI-SHIFT EXPORT LOGIC
export const exportAuditLog = (shifts: number[] = [], filename = "king_hud_audit_export") => {
  const csvContent = localStorage.getItem(STORAGE_KEY) || CSV_HEADER;
  const lines = csvContent.trim().split('\n');
  
  // Use first line as header, assume it matches CSV_HEADER mostly
  const header = lines[0]; 
  // Determine SHIFT_ID index dynamically or default to 10 based on updated header
  // HEADER: ... TOTAL_RECOVERY_TIME_SEC, SHIFT_ID, ...
  const headers = header.split(',');
  const shiftIndex = headers.indexOf('SHIFT_ID');
  
  if (shiftIndex === -1 && lines.length > 1) {
      console.error("SHIFT_ID column not found in CSV header.");
      downloadAuditLog(); // Fallback to full dump
      return;
  }

  const data = lines.slice(1);

  // If shifts array is empty, export all (Master)
  const filteredData = shifts.length === 0 
    ? data 
    : data.filter(line => {
        const cols = line.split(',');
        // Defensive check
        if (cols.length <= shiftIndex) return false;
        
        const shiftId = parseInt(cols[shiftIndex]); 
        return !isNaN(shiftId) && shifts.includes(shiftId);
    });

  if (filteredData.length === 0) {
      alert("No data found for the selected shift(s).");
      return;
  }

  const output = [header, ...filteredData].join('\n');
  
  const blob = new Blob([output], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadAuditLog = () => {
  exportAuditLog([], "king_hud_audit_full");
};

export const triggerZombieStrike = (delaySec: number, source: string) => {
  console.log(`[AUDIT_SERVICE]: Triggering Zombie Strike via Broadcast (Source: ${source}, Delay: ${delaySec}s)`);
  // Dashboard listens for this event to start visual simulation
  const channel = new BroadcastChannel('king_hud_c2_channel');
  channel.postMessage({ type: 'TRIGGER_ZOMBIE', source });
  channel.close();
};

export const broadcastStrikeClear = (source: string = "UNKNOWN") => {
  console.log(`[AUDIT_SERVICE]: Broadcasting Global Strike Clear Signal (Source: ${source})...`);
  const channel = new BroadcastChannel('king_hud_c2_channel');
  channel.postMessage({ type: 'STRIKE_CLEARED_GLOBAL', source });
  channel.close();
};

// WAVE SYNC: POSTPONE SCHEDULER
export const postponeScheduler = () => {
    // Broadcast reset command to HUDLayout
    console.log("[AUDIT_SERVICE]: Postponing Automated Wave (Resetting to 10m)...");
    const channel = new BroadcastChannel('king_hud_wave_channel');
    channel.postMessage({ type: 'RESET_WAVE_TIMER' });
    channel.close();
};

export const triggerRemediationWebhook = (instance: string, token: string, source: string, metrics: any, geminiMatch: boolean) => {
    // Log the OOB remediation event
    const safeMetrics: TelemetryPoint = {
        timestamp: metrics?.timestamp || Date.now(),
        cpu: metrics?.cpu || 0,
        ram: metrics?.ram || 0,
        threads: metrics?.threads || 0,
        ioWait: metrics?.ioWait || 0
    };

    console.log(`[AUDIT_SERVICE]: Logging Remediation Webhook Event for ${instance}`);
    
    // Log audit entry with assumption of success
    logAuditEntry(
        safeMetrics,
        true, // Alert Success
        true, // Remediation Triggered
        source, 
        geminiMatch,
        120, // Estimated TTR for OOB
        Date.now() - 120000,
        0, // shiftStrikeCount
        false, // stallDetected
        0, // queueDelay
        10, // humanLatency
        0 // aiConfidence (unknown for webhook)
    );
};

export const getStrikeMetrics = () => {
  const csv = localStorage.getItem(STORAGE_KEY);
  const CALIBRATION_BASE = 11;
  const TARGET_SHIFT_ID = 2; // 2ND_SHIFT

  if (!csv) return { total24h: 0, currentShiftCount: CALIBRATION_BASE };

  const lines = csv.trim().split('\n').slice(1);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  let total24h = 0;
  let currentShiftCount = 0;

  lines.forEach(line => {
    const parts = line.split(',');
    // CSV_HEADER length check or robust parsing
    if (parts.length < 10) return;

    const timestamp = parseInt(parts[2]);
    let shiftId = parseInt(parts[10]);
    if (isNaN(shiftId)) shiftId = parseInt(parts[9]);
    
    // Strict 24h window
    if (!isNaN(timestamp) && (now - timestamp <= oneDay)) {
        total24h++;
        
        // STRICT FILTER: Only count explicitly 2nd Shift events
        // This effectively "purges" ambiguous or 1st shift data from the specific counter
        if (shiftId === TARGET_SHIFT_ID) {
            currentShiftCount++;
        }
    }
  });

  return { total24h, currentShiftCount: currentShiftCount + CALIBRATION_BASE };
};