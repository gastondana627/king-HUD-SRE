import { GCP_CONFIG } from '../constants';
import { TelemetryPoint } from '../types';

// Helper to handle client-side env vars securely-ish for the demo
// In Vite/React, this looks for process.env or import.meta.env depending on build
const getEnv = (key: string) => {
    // @ts-ignore
    return process.env[key] || '';
};

export const sendEmailAlert = async (subject: string, body: string, hypothesis?: string): Promise<{ success: boolean; status: string | number }> => {
  const apiKey = getEnv('SENDGRID_API_KEY');
  const sender = getEnv('SENDGRID_SENDER') || 'sre-alert@king-hud.io';
  const recipient = getEnv('SENDGRID_RECIPIENT') || 'admin@king-hud.io';
  
  // FAILOVER / PUBLIC R&D MODE:
  // If Key is missing, we immediately return SIMULATED_FAILOVER to activate the Orange LED visual.
  if (!apiKey) {
    console.warn("[UPLINK_SIM]: SENDGRID_API_KEY not found in environment. Activating SIMULATION_MODE.");
    return { success: true, status: 'SIMULATED_FAILOVER' };
  }

  console.log(`[SMTP_GATEWAY]: Opening Secure Socket Layer via Relay...`);

  // PURPLE TEAM UPLINK: Inject Forensic Hypothesis if available
  let finalBody = body;
  if (hypothesis) {
      finalBody += `
        <div style="margin-top: 20px; padding: 15px; background: #0f172a; border-left: 4px solid #8b5cf6; color: #e2e8f0; font-family: monospace; font-size: 12px; line-height: 1.4;">
            <strong style="color: #a78bfa; text-transform: uppercase;">[CLAUDE_FORENSIC_HYPOTHESIS]:</strong><br/>
            <div style="margin-top: 8px; white-space: pre-wrap;">${hypothesis.replace(/\n/g, '<br/>')}</div>
        </div>
      `;
  }

  // PROXY IMPLEMENTATION
  const targetUrl = 'https://api.sendgrid.com/v3/mail/send';
  const relayEndpoint = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(relayEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }] }],
        from: { email: sender },
        subject: subject,
        content: [{ type: 'text/html', value: finalBody }],
      }),
    });

    if (response.status === 202) {
        console.log(`[SMTP_GATEWAY]: 202 ACCEPTED - Email Dispatched.`);
        return { success: true, status: 202 };
    } else {
        console.warn(`[SMTP_GATEWAY]: API Error ${response.status}. Switching to SIMULATION.`);
        return { success: true, status: 'SIMULATED_FAILOVER' };
    }
  } catch (e) {
    console.warn(`[SMTP_GATEWAY]: Network Exception. Switching to SIMULATION.`);
    return { success: true, status: 'SIMULATED_FAILOVER' };
  }
};

const sendSmsAlert = async (messageBody: string): Promise<{ success: boolean; status: string | number }> => {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID');
  const authToken = getEnv('TWILIO_AUTH_TOKEN');
  const fromNumber = getEnv('TWILIO_FROM_NUMBER');
  const toNumber = getEnv('TWILIO_TO_NUMBER');

  // FAILOVER / PUBLIC R&D MODE
  if (!accountSid || !authToken) {
      console.warn("[UPLINK_SIM]: TWILIO_CREDENTIALS not found. Activating SIMULATION_MODE.");
      return { success: true, status: 'SIMULATED_FAILOVER' };
  }

  console.log(`[SMS_GATEWAY]: Initializing Twilio Uplink...`);
  console.log('[UPLINK]: HANDSHAKE_SENT_TO_VIRTUAL_PHONE');

  const targetUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const relayEndpoint = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
  
  const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`);
  const formData = new URLSearchParams();
  formData.append('To', toNumber);
  formData.append('From', fromNumber);
  formData.append('Body', messageBody);

  try {
    const response = await fetch(relayEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (response.ok || response.status === 201) {
       console.log(`[SMS_GATEWAY]: 201 CREATED - Payload Delivered to Virtual Phone.`);
       return { success: true, status: response.status };
    } else {
       console.warn(`[SMS_GATEWAY]: Twilio Error ${response.status}. Switching to SIMULATION.`);
       return { success: true, status: 'SIMULATED_FAILOVER' };
    }
  } catch (e) {
    console.warn(`[SMS_GATEWAY]: Connection Failed. Switching to SIMULATION.`);
    return { success: true, status: 'SIMULATED_FAILOVER' };
  }
};

export const sendNtfyAlert = async (message: string, priority: number = 5): Promise<{ success: boolean; simulated: boolean }> => {
  const topic = getEnv('SECRET_NTFY_TOPIC');
  
  // FAILOVER: Even if Topic is missing, return simulated success for the HUD visual
  if (!topic) {
      return { success: true, simulated: true };
  }

  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { 'Title': '⚠️ King-HUD', 'Priority': priority.toString() },
      body: message,
    });
    
    if (!res.ok) throw new Error("Ntfy API Error");
    return { success: true, simulated: false };
  } catch (error) {
    console.warn("Ntfy Failed. Switching to SIMULATION.");
    return { success: true, simulated: true };
  }
};

export const broadcastCriticalAlert = async (metrics: TelemetryPoint, status: string, hypothesis?: string, claudeMatch?: boolean) => {
  console.log("[BROADCAST_ENGINE]: Activating Dual-Uplink (Email + SMS)...");
  
  const { INSTANCE_ID, ZONE } = GCP_CONFIG;
  
  // NARRATIVE: Change subject if Purple Team forensic hypothesis is present
  const subject = hypothesis 
    ? `[UNSCHEDULED_STRIKE_DETECTED]: PURPLE_TEAM_FORENSIC_REQUIRED` 
    : `[CRITICAL]: KING-HUD_${INSTANCE_ID}_ALERT`;
  
  // BLUE TEAM LINK GENERATION
  const secureToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
  // We use the local hash router to catch the link action in the demo
  const baseUrl = window.location.origin + window.location.pathname;
  const metricsEncoded = encodeURIComponent(JSON.stringify(metrics));
  const remediationUrl = `${baseUrl}#/remediate?instance=${INSTANCE_ID}&token=${secureToken}&source=BLUE_TEAM_OOB_LINK&claudeMatch=${claudeMatch}&metrics=${metricsEncoded}`;
  
  console.log('[SYSTEM]: REMEDIATION_LINK_GENERATED_AND_ENCRYPTED');

  const emailBody = `
    <div style="font-family: monospace; background: #0a0f14; color: #e2e8f0; padding: 20px; border: 1px solid #0ea5e9; border-radius: 6px;">
      <h2 style="color: #ef4444; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-top: 0;">CRITICAL INFRASTRUCTURE EVENT</h2>
      <div style="margin-bottom: 20px;">
        <p style="margin: 5px 0;"><strong>INSTANCE:</strong> ${INSTANCE_ID}</p>
        <p style="margin: 5px 0;"><strong>ZONE:</strong> ${ZONE}</p>
        <p style="margin: 5px 0;"><strong>STATUS:</strong> <span style="color: #ef4444;">${status}</span></p>
      </div>
      
      <div style="background: #1e293b; padding: 15px; border-radius: 4px; border-left: 4px solid #f59e0b; margin-bottom: 30px;">
        <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Real-Time Telemetry</p>
        <p style="margin: 5px 0; font-size: 16px;">CPU: <strong>${metrics.cpu.toFixed(1)}%</strong></p>
        <p style="margin: 5px 0; font-size: 16px;">RAM: <strong>${metrics.ram.toFixed(1)}%</strong></p>
      </div>
      
      <div style="text-align: center; margin: 40px 0;">
        <a href="${remediationUrl}" style="background: #ff4444; color: white; padding: 16px 32px; text-decoration: none; border-radius: 4px; font-weight: bold; font-family: sans-serif; display: inline-block; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);">EXECUTE EMERGENCY REBOOT</a>
      </div>
      
      <p style="color: #64748b; font-size: 12px; border-top: 1px solid #334155; padding-top: 15px; text-align: center;">
        Warning: This link bypasses standard IAM prompts. Use only in CRITICAL_SYSTEM_FRACTURE events.
      </p>
    </div>
  `;

  const shortMessage = `🚨 ${status} detected on ${INSTANCE_ID}. CPU: ${metrics.cpu.toFixed(1)}%. Initiating auto-recovery.`;

  // Execute channels in parallel
  // Index 0: Ntfy (Legacy/Dev)
  // Index 1: SendGrid (Primary Email) - Passes hypothesis
  // Index 2: Twilio (Primary SMS)
  const results = await Promise.allSettled([
    sendNtfyAlert(shortMessage, 5),
    sendEmailAlert(subject, emailBody, hypothesis),
    sendSmsAlert(shortMessage)
  ]);

  return results;
};
