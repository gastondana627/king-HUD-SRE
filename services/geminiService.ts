import { GoogleGenAI, Type } from "@google/genai";
import { TelemetryPoint, DiagnosticResult, SystemStatus, DixonStage, Intervention } from "../types";
import { KING_HUD_SYSTEM_INSTRUCTION } from "../constants";

// Safe Environment Variable Retrieval
const getGeminiKey = () => {
  try {
    // @ts-ignore
    const meta = import.meta;
    // @ts-ignore
    if (meta && meta.env) {
      // @ts-ignore
      return meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {
    // ignore import.meta errors
  }

  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env.API_KEY;
    }
  } catch (e) {
    // ignore process errors
  }
  return "";
};

const apiKey = getGeminiKey();
const ai = new GoogleGenAI({ apiKey });

export const analyzeSystemState = async (
  telemetry: TelemetryPoint,
  recentLogs: string[]
): Promise<DiagnosticResult> => {
  try {
    const prompt = `
      CURRENT TELEMETRY:
      CPU: ${telemetry.cpu.toFixed(2)}%
      RAM: ${telemetry.ram.toFixed(2)}%
      Active Threads: ${telemetry.threads}
      IO Wait: ${telemetry.ioWait}%

      RECENT LOGS:
      ${recentLogs.slice(-5).join('\n')}

      Analyze this state. If CPU is < 5% and RAM > 80%, identify as ZOMBIE_KERNEL.
      Otherwise, assess as NOMINAL, WARNING, or CRITICAL based on standard SRE metrics.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: KING_HUD_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: [SystemStatus.NOMINAL, SystemStatus.WARNING, SystemStatus.CRITICAL, SystemStatus.ZOMBIE_KERNEL] },
            analysis: { type: Type.STRING },
            dixonStage: { type: Type.STRING, enum: [DixonStage.NONE, DixonStage.WIPEOUT, DixonStage.UNDERTOW, DixonStage.RECOVERY] },
            interventions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  confidence: { type: Type.STRING, enum: ["HIGH", "LOW"] },
                  protocol: { type: Type.STRING },
                  action: { type: Type.STRING },
                  cliCommand: { type: Type.STRING },
                  description: { type: Type.STRING },
                  dixonStage: { type: Type.STRING, enum: [DixonStage.NONE, DixonStage.WIPEOUT, DixonStage.UNDERTOW, DixonStage.RECOVERY] }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return {
        ...result,
        timestamp: Date.now()
      };
    }

    throw new Error("No response from AI");
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Fallback heuristic if AI fails
    const isZombie = telemetry.cpu < 5 && telemetry.ram > 80;
    return {
      status: isZombie ? SystemStatus.ZOMBIE_KERNEL : SystemStatus.WARNING,
      analysis: "AI Link Failure. Fallback Heuristics Engaged. Pattern match indicates potential Type 1 SD.",
      dixonStage: isZombie ? DixonStage.UNDERTOW : DixonStage.NONE,
      interventions: isZombie ? [{
        id: "fallback-1",
        confidence: "HIGH",
        protocol: "Safe-Restart",
        action: "Initiate Hard Reboot",
        cliCommand: "gcloud compute instances reset [INSTANCE_NAME] --zone [ZONE]",
        description: "Fallback heuristic detected Zombie Kernel signature.",
        dixonStage: DixonStage.UNDERTOW
      }] : [],
      timestamp: Date.now()
    };
  }
};