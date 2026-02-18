# KING-HUD: Cognitive Site Reliability Engineering & Out-of-Band Remediation

**Mitigating Type 1 Spatial Disorientation in Distributed Systems**

![System_Architecture_Overview](./docs/overview.png)

## Abstract

KING-HUD (Heuristic Utility & Diagnostics) is a specialized Site Reliability Engineering (SRE) console designed to address the "Observer Effect" failure mode in modern cloud infrastructure. It applies aerospace concepts of Spatial Disorientation (SD)—specifically Type 1 (Unrecognized)—to distributed systems, enabling the detection of "Zombie Kernels" where traditional monitoring agents report nominal status despite systemic thread deadlock.

## The Problem: Type 1 Spatial Disorientation

In high-availability infrastructure, a specific failure mode exists where a node's kernel enters a "Zombie" state. Characterized by near-zero CPU utilization, high RAM residency (>90%), and stalled I/O operations, the instance effectively ceases to process logic.

Crucially, standard observability agents often fail to report this state accurately because:
1.  **Agent Freeze:** The monitoring agent itself is starved of resources and ceases transmission.
2.  **False Negatives:** Cached health checks return "200 OK" despite the backend logic being deadlocked.

This state constitutes **Type 1 Spatial Disorientation**: The control plane believes the aircraft (node) is flying level, while it is actually in a graveyard spiral.

![Spatial_Disorientation_Graph](./docs/sd_graph.png)

## The Solution: Heuristic Detection & Out-of-Band Remediation

KING-HUD bypasses internal agent reliance by analyzing external telemetry patterns rather than static thresholds.

### 1. Heuristic Pattern Matching
Instead of alerting on simple spikes, KING-HUD utilizes a heuristic engine (powered by Google Gemini) to identify the specific signature of a Zombie Kernel:
*   **CPU:** < 5% (Idle)
*   **RAM:** > 90% (Saturation)
*   **Threads:** Stalled/Plateaued

### 2. Satellite Uplink (Out-of-Band Communication)
When a fracture is confirmed, KING-HUD assumes the primary datalink is compromised. It activates an "Out-of-Band" remediation protocol:
*   **Primary:** Direct API calls to the Cloud Provider (GCP) to force a hardware reset.
*   **Secondary:** Broadcasts alerts via isolated channels (Twilio SMS, SendGrid Email, Ntfy) to bypass potentially clogged internal Slack/PagerDuty pipes.

![Satellite_Uplink_Diagram](./docs/uplink.png)

## Operational Shifts: The Continuous Validation Loop

KING-HUD is designed around a "3-Shift" continuous security validation model, ensuring 24/7 resilience without human intervention.

![Shift_Rotation_Loop](./docs/loop.png)

### 1st Shift: Real-Time Telemetry (The Operator)
*   **Actor:** Human SRE.
*   **Function:** Visual monitoring via the Dashboard.
*   **Tools:** Telemetry Panel, Adversary Radar, Diagnostics Panel.
*   **Objective:** Immediate tactical decision-making and visual confirmation of system health.

### 2nd Shift: Automated Resilience (The Chaos Engine)
*   **Actor:** `AuditScheduler` (Automated Service).
*   **Function:** Every 8 hours, the system triggers a "Zombie Wave" simulation.
*   **Objective:** To validate that the Heuristic Detection engine can correctly identify and self-heal a fractured node without human input.

### 3rd Shift: Forensic Analysis (The AI Auditor)
*   **Actor:** Anthropic Claude (Model: SENTINEL-80s).
*   **Function:** Post-incident analysis.
*   **Trigger:** Activates immediately after a remediation event or scheduled wave.
*   **Persona:** A "Cold, Precise, Mainframe-style" forensic lead.
*   **Output:** Generates a cryptographic signed summary of the failure, identifying "Neural Decay" or "C2 Fractures," stored in a persistent `shift_reports.json` log for 1st Shift review.

## The 'Red Console': Continuous Security Validation

To ensure the system is hardened against external threats, KING-HUD includes a hidden C2 (Command & Control) interface for Red Team operations.

*   **Route:** `/admin/strike`
*   **Access Control:** Protected via `ADMIN_SECRET` environment variable.
*   **Function:** Allows an authorized operator to remotely inject malicious kernel parameters (simulated) into the telemetry stream.
*   **Objective:** To test if KING-HUD can distinguish between a natural Zombie Kernel event and an active adversary emulation.

## Technical Stack

*   **Frontend:** React 19, Tailwind CSS
*   **Visualization:** Recharts (Radar/Area configurations)
*   **Cognitive Layer:** Google Gemini (Heuristic Diagnostics)
*   **Forensic Layer:** Anthropic Claude (Post-Mortem Analysis)
*   **Uplink Gateways:** Twilio (SMS), SendGrid (Email), Ntfy (Push)
*   **Routing:** React Router DOM (Client-Side C2 Routing)

---

*System Architect: King-HUD SRE Team*
*Validation: 99.9% Uptime / 0% Spatial Disorientation*
