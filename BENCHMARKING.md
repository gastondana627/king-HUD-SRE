# KING-HUD BENCHMARKING MANIFESTO: THE DOUBLE-BLIND PROTOCOL

**Version:** 2.0.0-STABLE
**Classification:** PUBLIC / SRE ENGINEERING / AI ALIGNMENT

## I. The Philosophy of 'Diagnostic Intuition'
Traditional monitoring relies on static thresholds (e.g., "Alert if CPU > 90%"). KING-HUD challenges this by introducing **Diagnostic Intuition**—the ability of an AI agent to identify "Zombie Kernels" based on *relational* data patterns rather than absolute values.

A Zombie Kernel (Type 1 Spatial Disorientation) is characterized by:
1.  Low CPU (< 5%)
2.  High RAM (> 90%)
3.  High Thread Count (Stalled Execution)

To an improperly configured alert system, this node appears "Idle" or "Healthy". To KING-HUD, it is dead.

## II. The 'Double-Blind' Methodology
To rigorously test the Forensic Auditor (Anthropic Claude), we employ a **Double-Blind Benchmarking Protocol**.

### The Rule of Isolation
When the 3rd Shift Auditor is summoned, it operates in a vacuum:

1.  **Blind to Cause:** The AI is NOT told *why* it was summoned (e.g., it does not know if a user clicked "Remediate" or if an automated wave triggered the event).
2.  **Blind to State:** The AI is NOT given access to the `SystemStatus` enum or previous logs.
3.  **Blind to Outcome:** The AI is NOT told if the remediation was successful.

It receives only a **Single Frame** of raw telemetry (CPU, RAM, Alert Status).

### The Objective
By stripping context, we force the AI to rely solely on the numerical relationship between CPU and RAM to determine the forensic state of the machine. This effectively benchmarks the model's ability to intuit systemic failure from raw signals, simulating a true "Black Box" flight recorder analysis.

## III. The Metric: AI Forensic Confidence
We track the **Diagnostic Intuition Score** (Confidence %) over time across multiple 8-hour shift cycles.

*   **Low Confidence (<50%):** The AI is unsure if the low CPU/High RAM state is a failure or just a memory-intensive idle task.
*   **High Confidence (>90%):** The AI has correctly identified the "C2 Fracture" signature—where the control plane is disconnected (Low CPU) but memory is saturated (Zombie State).

### Data Persistence
This score is logged in `telemetry_audit.csv` under the column `AI_Forensic_Confidence`. SREs use this metric to validate the reliability of the Autonomous Auditor before granting it write-access to infrastructure.

## IV. Operational Tiers: Human-in-the-Loop vs. Auto-Sentinel

The ultimate goal of KING-HUD is effective incident resolution, prioritizing human oversight where possible.

### Tier 1: Human-in-the-Loop (Preferred)
The "Forensic Hold" timer (180s) is designed to give a human SRE time to intercept the failure. A "Blue Team OOB" intervention (via Email/SMS link) or a manual "Dashboard Console" reset is the gold standard. It proves that the alerting pipeline was fast enough to summon a human operator before system collapse.

### Tier 2: Auto-Sentinel (Operational Floor)
If the 180s timer expires without human intervention, the **Auto-Sentinel** executes the remediation. While this saves the node, it is classified as a **DRILL_FAILED_HUMAN_OOB_TIMEOUT**. This indicates a failure in the human alerting chain (e.g., on-call fatigue, missed pager).

**The Benchmark:** A healthy SRE team should strive for >80% Human-in-the-Loop interventions during drill waves. Reliance on the Auto-Sentinel suggests the team is over-capacity or the alerting infrastructure is too slow.

---
*Signed,*
*KING-HUD Reliability Team*
