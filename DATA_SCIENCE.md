# QUANTIFYING 'NEURAL DECAY' IN GPU CLUSTERS
## A Data Science Framework for High-Fidelity SRE Telemetry

**Project Goal:** To quantify the degradation of distributed systems ("Neural Decay") and the efficacy of human vs. autonomous remediation strategies through the analysis of high-frequency telemetry logs.

---

## 1. The Metric: Time-to-Recovery (TTR)

In the context of KING-HUD, **TTR** is not simply "uptime." It is a precise measurement of the **Operational Lag** between detection and resolution.

*   **T0 (Fracture Detection):** The exact millisecond the heuristic engine identifies a Type 1 Spatial Disorientation event (CPU < 5%, RAM > 90%).
*   **T1 (Satellite Remediation):** The timestamp when the remediation command (Reset) is successfully acknowledged by the Cloud Provider API.

$$ TTR = T1 - T0 $$

*   **Low TTR (< 60s):** Indicates "Expert Level" human intervention or efficient Out-of-Band reaction.
*   **High TTR (> 180s):** Indicates "System Exhaustion." The human operator failed to react, forcing the Auto-Sentinel to intervene.

---

## 2. The Data Dictionary

The `telemetry_audit.csv` dataset is structured to support multi-variate analysis of system reliability and operator fatigue.

| Column | Type | Utility |
| :--- | :--- | :--- |
| `INCIDENT_START` | Timestamp | T0: The start of the C2 Fracture (Zombie State). |
| `REMEDIATION_TIME` | Timestamp | T1: The moment of successful system reset. |
| `SOURCE` | String | The vector of intervention (e.g., `DASHBOARD`, `BLUE_TEAM_OOB`, `AUTO_SENTINEL`). |
| `ASSOCIATED_DRILL` | String | Unique ID linking a specific Red Team strike to the remediation event. |
| `SHIFT` | String | Categorical variable (`1ST_SHIFT`, `2ND_SHIFT`, `3RD_SHIFT`) for Fatigue Analysis. |
| `TTR_SEC` | Float | **Dependent Variable.** The efficiency benchmark for the SRE team. |
| `SHIFT_STRIKE_COUNT` | Integer | Operational Intensity metric. High counts correlate with increased TTR (Fatigue). |
| `STALL_DETECTED` | Boolean | **Leading Indicator.** True if the "Hiccup Monitor" detected RAM stagnation > 60s prior to fracture. |
| `COGNITIVE_LOAD_SCORE` | Integer | Heuristic score (1-10) representing the strain on the operator. |
| `GEMINI_HYPOTHESIS_MATCH`| Boolean | Ground Truth verification of the AI's forensic analysis accuracy. |

---

## 3. Experimental Design: The '10-Strike Stress Test'

To validate the resilience of the infrastructure, we execute a **10-Strike Stress Test** over a 24-hour period (across 3 shifts). This generates a dataset capturing three distinct remediation paths:

1.  **Manual (Dashboard):** The operator sees the visual alert (Red/Magenta LED) and clicks "COMMIT REMEDIATION."
    *   *Hypothesis:* Fastest TTR during 1st Shift; degrades during 3rd Shift.
2.  **Out-of-Band (Email/SMS):** The operator receives a notification on a secondary device and clicks the secure webhook link.
    *   *Hypothesis:* Medium TTR. Consistent across shifts but subject to network latency.
3.  **Autonomous (Sentinel):** The operator fails to react within the 180s Forensic Hold window. The system self-heals.
    *   *Hypothesis:* Fixed TTR Ceiling (180s). Represents the "Safety Net."

**Control Variable:** The "Zombie Kernel" payload is identical in every strike.
**Independent Variable:** The `SHIFT` (Operator Fatigue) and `SOURCE` (Remediation Method).

---

## 4. Visualization Strategy: 'Cognitive Brownout' Heatmap

We recommend visualizing the dataset using a **2D Density Heatmap**:

*   **X-Axis:** `SHIFT` (Time of Day)
*   **Y-Axis:** `TTR_SEC` (Response Time)
*   **Color Intensity:** `SHIFT_STRIKE_COUNT`

**Target Analysis:**
Look for clusters of **High TTR** events during the **3rd Shift** (01:00 - 09:00). These clusters indicate **"Cognitive Brownout"**—periods where human operators are physically present but cognitively delayed.

*   **Actionable Insight:** If 3rd Shift TTR consistently approaches the Auto-Sentinel limit (180s), the recommendation is to **automate 3rd Shift entirely**, removing the human-in-the-loop to eliminate variance.