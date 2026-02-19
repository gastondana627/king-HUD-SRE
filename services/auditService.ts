import { GoogleGenAI } from "@google/genai";
import { TelemetryPoint } from '../types';
import { sendEmailAlert } from './notificationService';

// GitLab Narrative: Implemented continuous security validation loop to simulate recurring adversary behavior and audit system resilience.

// UPGRADE: Multi-Channel Schema + Forensic Stitching (Drill ID & Cognitive Score) + Intensity Metrics + Queue Delay
export const CSV_HEADER = "INCIDENT_START,REMEDIATION_TIME,SOURCE,ASSOCIATED_DRILL,GEMINI_HYPOTHESIS_MATCH,COGNITIVE_LOAD_SCORE,CPU_MAX,RAM_MAX,TTR_SEC,SHIFT,SHIFT_STRIKE_COUNT,STALL_DETECTED,QUEUE_DELAY_SEC";
const STORAGE_KEY = "telemetry_audit.csv";
const HISTORY_KEY = "KING_HUD_HISTORY"; 
const LAST_REPORT_KEY = "king_hud_last_daily_report";
const ACTIVE_DRILL_KEY = "KING_HUD_ACTIVE_DRILL";

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

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: getGeminiKey() });

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
  const recentLogs = dataLines.filter(line => {
      if (!line.trim()) return false;
      const columns = line.split(',');
      const timestampStr = columns[0]; // Incident Start
      const timestamp = new Date(timestampStr).getTime();
      return (nowMs - timestamp) < ONE_DAY_MS;
  });

  if (recentLogs.length === 0) {
      console.log("[AUDIT_SCHEDULER]: No activity in last 24h to report.");
      localStorage.setItem(LAST_REPORT_KEY, nowMs.toString()); 
      return;
  }

  // Generate Report
  const reportHTML = await generateShiftHandoverReport(recentLogs);
  
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

const generateShiftHandoverReport = async (logs: string[]) => {
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

        [DIRECTIVE]:
        1. Summarize total incidents (Zombie Kernels vs Admin Strikes).
        2. Identify recurring vulnerabilities.
        3. Analyze Time-To-Recovery (TTR) trends between AUTO_SENTINEL and USER_OOB interventions.
        4. Validate GEMINI_HYPOTHESIS_MATCH accuracy.
        5. CRITICAL: Flag any "DRILL_FAILED_HUMAN_OOB_TIMEOUT" events as 1st Shift coverage gaps (Human-in-the-Loop Failure).
        6. ANALYZE COGNITIVE_LOAD_SCORE: Report if the team is operating at Expert Level (Score ~1) or System Exhaustion (Score 10).
        7. EOD DEEP ANALYSIS: Analyze the TTR (Time to Recovery) for all shifts. Compare human response (1st/2nd) vs. autonomous response (3rd). Identify if the hourly 3rd-shift stress caused any system fatigue or API rate-limiting.
    `;

    try {
        // UPGRADE: Using Pro for complex summarization and reasoning
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: userContent,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        const content = response.text || "NO_SUMMARY_GENERATED";
        
        // Wrap in a nice container for the email
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
  queueDelay: number = 0 // TRAFFIC CONTROL: Delay in seconds
) => {
  const remediationTime = new Date().toISOString();
  const incidentStartTime = incidentStart ? new Date(incidentStart).toISOString() : new Date(Date.now() - (timeToRecovery * 1000)).toISOString();
  const currentShift = getCurrentShift();
  
  let aiConfidence = "N/A";

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
          const analysisResult = await invoke_ai_analysis({
              trigger: `SOURCE_${interventionSource} // DRILL_${activeDrill}`, // Ensure Drill ID is in the trigger for the AI Report
              timestamp: Date.now(),
              metrics: metrics,
              alert_status: alertSuccess ? "TRANSMISSION_CONFIRMED" : "TRANSMISSION_FAILED",
              remediation_source: interventionSource,
              ttr: timeToRecovery
          });
          aiConfidence = analysisResult.confidence;
      } catch (err) {
          console.error("[AUDITOR]: Forensic Analysis Failed", err);
          aiConfidence = "ERROR";
      }
  }

  // CSV FORMAT: INCIDENT_START,REMEDIATION_TIME,SOURCE,ASSOCIATED_DRILL,GEMINI_HYPOTHESIS_MATCH,COGNITIVE_LOAD_SCORE,CPU_MAX,RAM_MAX,TTR_SEC,SHIFT,SHIFT_STRIKE_COUNT,STALL_DETECTED,QUEUE_DELAY_SEC
  const line = `\n${incidentStartTime},${remediationTime},${interventionSource},${activeDrill},${geminiMatch},${cognitiveScore},${metrics.cpu.toFixed(2)},${metrics.ram.toFixed(2)},${timeToRecovery},${currentShift},${shiftStrikeCount},${stallDetected},${queueDelay}`;
  
  const existing = localStorage.getItem(STORAGE_KEY) || CSV_HEADER;
  localStorage.setItem(STORAGE_KEY, existing + line);
  
  console.log(`[AUDIT_LOG]: Appended to ${STORAGE_KEY} -> ${line.trim()}`);

  // CLEANUP: If this was a remediation event (not the strike start), clear the drill
  if (!interventionSource.includes("ADMIN_REMOTE_STRIKE") && !interventionSource.includes("STRIKE")) {
       localStorage.removeItem(ACTIVE_DRILL_KEY);
       // Internal Queue Logic removed - Handled by App.tsx Traffic Controller
  }
};

// Gemini Handshake
export const invoke_ai_analysis = async (telemetryPayload: any) => {
  console.log("[AUDIT_SERVICE]: Packaging Telemetry Window for 3rd Shift Handover...");
  
  const shift = getCurrentShift();
  const timestamp = new Date().toISOString();
  const headerPrefix = `[SHIFT_IDENTIFIER: ${shift}] [TIMESTAMP: ${timestamp}]`;

  if (!getGeminiKey()) {
      console.warn("[AUDIT_SERVICE]: Missing Gemini API Key. Telemetry Audit Failed.");
      const errorMsg = "ERROR: FORENSIC_UPLINK_UNAVAILABLE // CHECK_API_PROVISIONING.";
      
      const fullContent = `${headerPrefix}\n${errorMsg}`;

      const reportEntry = {
          id: Date.now(),
          timestamp: timestamp,
          shift: shift,
          trigger: telemetryPayload.trigger,
          content: fullContent,
          integrity: "0%",
          aiConfidence: "0%"
      };
      
      const existingReports = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const updatedReports = [reportEntry, ...existingReports].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedReports));
      
      return { report: errorMsg, confidence: "0%" };
  }

  const systemInstruction = `
    IDENTITY: You are the KING-HUD Forensic Lead (Model: SENTINEL-80s).
    TONE: Cold. Precise. Haunting. High-Technical. 1980s Mainframe style.
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
      // UPGRADE: Using Pro for forensic depth
      const response = await ai.models.generateContent({
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
      const confidenceScore = confidenceMatch ? `${confidenceMatch[1]}%` : "UNKNOWN";
      
      const integrityScore = Math.floor(Math.random() * (100 - 89) + 89);

      const fullContent = `${headerPrefix}\n\n${reportText}`;

      const reportEntry = {
          id: Date.now(),
          timestamp: timestamp,
          shift: shift,
          trigger: telemetryPayload.trigger,
          content: fullContent,
          integrity: `${integrityScore}%`,
          aiConfidence: confidenceScore
      };

      const existingReports = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const updatedReports = [reportEntry, ...existingReports].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedReports));

      return { report: reportText, confidence: confidenceScore };

  } catch (e) {
      console.error("[AUDIT_SERVICE]: AI Handshake Failed", e);
      return { report: "FORENSIC_ANALYSIS_FAILED_DUE_TO_NETWORK_ERROR", confidence: "ERR" };
  }
};

// Updated Trigger: Accepts queueDelay and passes it to logAuditEntry
export const triggerZombieStrike = (queueDelay: number = 0, source: string = "UNKNOWN") => {
  // TRAFFIC CONTROLLER: Handled in App.tsx. 
  // This function is now a dumb executor of the strike protocol.

  console.log(`[AUDIT_SERVICE]: Executing Remote Zombie Strike Protocol... (Source: ${source}, Queue Delay: ${queueDelay}s)`);
  
  // GENERATE UNIQUE DRILL ID (Adversarial Traceability)
  // Format: STRIKE_ + timestamp
  const drillId = `STRIKE_${Date.now()}`;
  
  // PERSISTENCE: Store Drill ID to stitch with remediation later
  // IMPORTANT: This must happen BEFORE logging the audit entry so the entry itself is tagged.
  localStorage.setItem(ACTIVE_DRILL_KEY, drillId);

  const channel = new BroadcastChannel('king_hud_c2_channel');
  // Pass the source to the dashboard for logic branching
  channel.postMessage({ type: 'TRIGGER_ZOMBIE', drillId, source });
  setTimeout(() => channel.close(), 100);

  const mockMetrics = { timestamp: Date.now(), cpu: 0, ram: 99.9, threads: 0, ioWait: 0 };
  
  // LOG with unique DRILL_ID and QUEUE DELAY
  logAuditEntry(mockMetrics, true, true, `SOURCE: ${source} // ${drillId}`, false, 0, undefined, 0, false, queueDelay);
  
  return true;
};

// UPGRADE: Multi-Channel Webhook Handler
export const triggerRemediationWebhook = (instanceId: string, token: string, source: string = "BLUE_TEAM_OOB_LINK", metrics?: any, geminiMatch?: boolean) => {
    console.log(`[WEBHOOK_LISTENER]: POST /api/remediate (Instance: ${instanceId}, Source: ${source})`);
    
    const mockMetrics: TelemetryPoint = metrics || { 
        timestamp: Date.now(), 
        cpu: 0.0, 
        ram: 99.9, 
        threads: 0, 
        ioWait: 0 
    };

    // Calculate TTR heuristically or use default
    const ttr = 120; // Avg time for OOB manual intercept

    // NOTE: Webhooks from email links don't have access to Dashboard State (shift count/stalls).
    // Passing default values (0, false, 0) for now.
    logAuditEntry(mockMetrics, true, true, source, geminiMatch ?? false, ttr, undefined, 0, false, 0);
    return { status: 200, message: "Remediation Executed via Webhook" };
};

export const downloadAuditLog = () => {
    const csvContent = localStorage.getItem(STORAGE_KEY) || CSV_HEADER;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "king_hud_telemetry_audit.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const getShiftReports = () => {
    try {
        const history = localStorage.getItem(HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (e) {
        console.error("Failed to parse shift reports", e);
        return [];
    }
};
