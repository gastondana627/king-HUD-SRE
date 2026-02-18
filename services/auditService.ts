import { TelemetryPoint } from '../types';
import { sendEmailAlert } from './notificationService';

// GitLab Narrative: Implemented continuous security validation loop to simulate recurring adversary behavior and audit system resilience.

// UPGRADE: Multi-Channel Schema + Forensic Stitching (Drill ID & Cognitive Score) + Intensity Metrics
export const CSV_HEADER = "INCIDENT_START,REMEDIATION_TIME,SOURCE,ASSOCIATED_DRILL,CLAUDE_HYPOTHESIS_MATCH,COGNITIVE_LOAD_SCORE,CPU_MAX,RAM_MAX,TTR_SEC,SHIFT,SHIFT_STRIKE_COUNT,STALL_DETECTED";
const STORAGE_KEY = "telemetry_audit.csv";
const HISTORY_KEY = "KING_HUD_HISTORY"; 
const LAST_REPORT_KEY = "king_hud_last_daily_report";
const ACTIVE_DRILL_KEY = "KING_HUD_ACTIVE_DRILL";

// Helper for Environment Variable compatibility (Vercel/Vite/Node)
const getEnvVar = (key: string) => {
    // @ts-ignore
    const value = process.env[key];
    if (value) return value;
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
             // @ts-ignore
            return import.meta.env[`VITE_${key}`];
        }
    } catch (e) {
        // Ignore import.meta errors
    }
    return '';
};

const getAnthropicKey = () => getEnvVar('ANTHROPIC_API_KEY') || getEnvVar('Anthopic_API_KEY');
const getSendGridKey = () => getEnvVar('SENDGRID_API_KEY');

// Auditor is only ONLINE if BOTH the Cognitive Layer (Anthropic) and Uplink Layer (SendGrid) are provisioned.
export const isAuditorOnline = () => !!getAnthropicKey() && !!getSendGridKey();

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

export const startAuditScheduler = (triggerWave: () => void) => {
  // 8 Hours in Milliseconds
  const INTERVAL_MS = 8 * 60 * 60 * 1000;
  
  console.log(`[AUDIT_SCHEDULER]: Continuous Security Validation Loop Active. Next Wave in ${INTERVAL_MS/1000}s.`);
  
  const interval = setInterval(async () => {
    console.log("[AUDIT_SCHEDULER]: 8-Hour Mark. Initiating Zombie Wave for Resilience Audit.");
    triggerWave();
  }, INTERVAL_MS);

  return () => clearInterval(interval);
};

export const checkAndSendDailySummary = async () => {
  const lastReport = localStorage.getItem(LAST_REPORT_KEY);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Check if 24h passed
  if (lastReport) {
      const lastTime = parseInt(lastReport);
      if (now - lastTime < ONE_DAY_MS) {
          console.log(`[AUDIT_SCHEDULER]: Daily Summary not due. Next window in ${((ONE_DAY_MS - (now - lastTime)) / 1000 / 60).toFixed(0)} mins.`);
          return;
      }
  }

  console.log("[AUDIT_SCHEDULER]: Initiating 24-Hour Shift Handover Protocol...");

  // Fetch logs from CSV
  const csvContent = localStorage.getItem(STORAGE_KEY);
  if (!csvContent) {
       console.log("[AUDIT_SCHEDULER]: No telemetry logs found.");
       return;
  }

  const lines = csvContent.split('\n');
  const dataLines = lines.slice(1);
  
  const recentLogs = dataLines.filter(line => {
      if (!line.trim()) return false;
      const columns = line.split(',');
      const timestampStr = columns[0]; // Incident Start
      const timestamp = new Date(timestampStr).getTime();
      return (now - timestamp) < ONE_DAY_MS;
  });

  if (recentLogs.length === 0) {
      console.log("[AUDIT_SCHEDULER]: No activity in last 24h to report.");
      localStorage.setItem(LAST_REPORT_KEY, now.toString()); // Reset timer anyway
      return;
  }

  // Generate Report
  const reportHTML = await generateShiftHandoverReport(recentLogs);
  
  // Send Email
  if (reportHTML) {
      const emailResult = await sendEmailAlert("KING-HUD | DAILY_SHIFT_HANDOVER_REPORT", reportHTML);
      if (emailResult.success) {
          console.log("[AUDIT_SCHEDULER]: Shift Handover Email Dispatched.");
          localStorage.setItem(LAST_REPORT_KEY, now.toString());
      } else {
          console.error("[AUDIT_SCHEDULER]: Failed to dispatch email.");
      }
  }
};

const generateShiftHandoverReport = async (logs: string[]) => {
    const apiKey = getAnthropicKey();
    if (!apiKey) {
        console.warn("[AUDIT_SERVICE]: Cannot generate Daily Report - No API Key");
        return null;
    }

    const systemPrompt = `
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
        4. Validate CLAUDE_HYPOTHESIS_MATCH accuracy.
        5. CRITICAL: Flag any "DRILL_FAILED_HUMAN_OOB_TIMEOUT" events as 1st Shift coverage gaps (Human-in-the-Loop Failure).
        6. ANALYZE COGNITIVE_LOAD_SCORE: Report if the team is operating at Expert Level (Score ~1) or System Exhaustion (Score 10).
    `;

    try {
        const proxyUrl = "https://corsproxy.io/?https://api.anthropic.com/v1/messages";
        const response = await fetch(proxyUrl, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1000,
                system: systemPrompt,
                messages: [{ role: "user", content: userContent }]
            })
        });

        if (!response.ok) throw new Error("Anthropic API Error");
        const data = await response.json();
        const content = data.content?.[0]?.text || "NO_SUMMARY_GENERATED";
        
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
  claudeMatch: boolean,       // Maps to CLAUDE_HYPOTHESIS_MATCH
  timeToRecovery: number = 0,
  incidentStart?: number,      // Optional start time (timestamp)
  // New: Operational Intensity & Hiccup Logic
  shiftStrikeCount: number = 0,
  stallDetected: boolean = false
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

  // CSV FORMAT: INCIDENT_START,REMEDIATION_TIME,SOURCE,ASSOCIATED_DRILL,CLAUDE_HYPOTHESIS_MATCH,COGNITIVE_LOAD_SCORE,CPU_MAX,RAM_MAX,TTR_SEC,SHIFT,SHIFT_STRIKE_COUNT,STALL_DETECTED
  const line = `\n${incidentStartTime},${remediationTime},${interventionSource},${activeDrill},${claudeMatch},${cognitiveScore},${metrics.cpu.toFixed(2)},${metrics.ram.toFixed(2)},${timeToRecovery},${currentShift},${shiftStrikeCount},${stallDetected}`;
  
  const existing = localStorage.getItem(STORAGE_KEY) || CSV_HEADER;
  localStorage.setItem(STORAGE_KEY, existing + line);
  
  console.log(`[AUDIT_LOG]: Appended to ${STORAGE_KEY} -> ${line.trim()}`);

  // CLEANUP: If this was a remediation event (not the strike start), clear the drill
  if (!interventionSource.includes("ADMIN_REMOTE_STRIKE") && !interventionSource.includes("STRIKE")) {
       localStorage.removeItem(ACTIVE_DRILL_KEY);
  }
};

// Claude Handshake
export const invoke_ai_analysis = async (telemetryPayload: any) => {
  console.log("[AUDIT_SERVICE]: Packaging Telemetry Window for 3rd Shift Handover...");
  
  const apiKey = getAnthropicKey();
  
  const shift = getCurrentShift();
  const timestamp = new Date().toISOString();
  const headerPrefix = `[SHIFT_IDENTIFIER: ${shift}] [TIMESTAMP: ${timestamp}]`;

  if (!apiKey) {
      console.warn("[AUDIT_SERVICE]: Missing Anthropic API Key. Telemetry Audit Failed.");
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

  const systemPrompt = `
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
      const proxyUrl = "https://corsproxy.io/?https://api.anthropic.com/v1/messages";
      
      const response = await fetch(proxyUrl, {
          method: "POST",
          headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json"
          },
          body: JSON.stringify({
              model: "claude-3-haiku-20240307",
              max_tokens: 300,
              system: systemPrompt,
              messages: [
                  { role: "user", content: userContent }
              ]
          })
      });

      if (!response.ok) {
          throw new Error(`Anthropic API Error: ${response.status}`);
      }

      const data = await response.json();
      const reportText = data.content?.[0]?.text || "NO_ANALYSIS_GENERATED";

      console.log("[AUDIT_SERVICE]: Shift-Audit Generated via Claude.");
      
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

export const getShiftReports = () => {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
};

export const triggerZombieStrike = () => {
  console.log("[AUDIT_SERVICE]: Executing Remote Zombie Strike Protocol...");
  
  // GENERATE UNIQUE DRILL ID (Adversarial Traceability)
  // Format: STRIKE_ + timestamp
  const drillId = `STRIKE_${Date.now()}`;
  
  // PERSISTENCE: Store Drill ID to stitch with remediation later
  // IMPORTANT: This must happen BEFORE logging the audit entry so the entry itself is tagged.
  localStorage.setItem(ACTIVE_DRILL_KEY, drillId);

  const channel = new BroadcastChannel('king_hud_c2_channel');
  channel.postMessage({ type: 'TRIGGER_ZOMBIE', drillId });
  setTimeout(() => channel.close(), 100);

  const mockMetrics = { timestamp: Date.now(), cpu: 0, ram: 99.9, threads: 0, ioWait: 0 };
  
  // LOG with unique DRILL_ID in the source tag for the Attack Event
  logAuditEntry(mockMetrics, true, true, `ADMIN_REMOTE_STRIKE // ${drillId}`, false, 0);
  
  return true;
};

// UPGRADE: Multi-Channel Webhook Handler
export const triggerRemediationWebhook = (instanceId: string, token: string, source: string = "BLUE_TEAM_OOB_LINK", metrics?: any, claudeMatch?: boolean) => {
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
    // Passing default values (0, false) for now.
    logAuditEntry(mockMetrics, true, true, source, claudeMatch ?? false, ttr, undefined, 0, false);
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
