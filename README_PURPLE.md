# PURPLE TEAM CONVERGENCE: THE KING-HUD PROTOCOL

**Classification:** PUBLIC R&D
**Sector:** Cognitive SRE / Adversary Emulation
**Status:** ACTIVE

## I. Overview

The "Purple Team" architecture of KING-HUD is not merely about having attackers (Red) and defenders (Blue) in the same room. It is about **Systemic Integration**.

In this architecture, the Red Cell (The Adversary) and the Blue Cell (The SRE) communicate through a shared "Forensic Buffer." The goal is not to prevent the attack, but to train the AI Auditor (3rd Shift) to recognize the *signature* of the attack versus a natural failure.

## II. The Architecture of Convergence

### 1. The Red Cell (Adversary Emulation)
*   **Console:** `/admin/strike`
*   **Trigger:** `ADMIN_REMOTE_STRIKE`
*   **Payload:** "Zombie Kernel" Injection (Type 1 Spatial Disorientation).
*   **Objective:** To silently saturate memory (RAM > 95%) while suppressing CPU signals (CPU < 5%) to evade standard threshold alerts.

### 2. The Blue Cell (Heuristic Defense)
*   **Console:** `Dashboard.tsx`
*   **Trigger:** `HEURISTIC_PATTERN_MATCH`
*   **Response:**
    1.  **Detection:** Identifying the disconnect between CPU and RAM.
    2.  **Hypothesis:** Generating a "Purple Team Uplink" via Claude AI to guess the root cause.
    3.  **Remediation:** Executing a cloud-native instance reset.

### 3. The 180s Forensic Buffer (The Handshake)
When a fracture is detected, the system does not immediately reboot. It enters a **180-Second Forensic Hold**.

*   **Why?** To allow the "Witness" (The 3rd Shift AI) to observe the state of the machine as it dies.
*   **The Convergence:** During this window, the Red Team's payload is active, and the Blue Team's diagnostics are recording. This overlap creates the "Training Data" needed to build better automated defenses.

## III. How to Run a Purple Team Exercise

1.  **Open two tabs:**
    *   **Tab A (Defense):** The Main Dashboard (`/`). Monitor the `Adversary Radar`.
    *   **Tab B (Offense):** The Admin Console (`/admin/strike`). Password: `RED_SQUADRON_ALPHA`.

2.  **Initiate Strike:**
    *   In Tab B, click **[INITIATE_REMOTE_ZOMBIE_STRIKE]**.
    *   Observe the "Weapon Status" change to active.

3.  **Observe Defense:**
    *   In Tab A, watch the `Adversary Radar` spike in thermal/RAM metrics.
    *   Watch the status flip to `ZOMBIE_KERNEL` or `C2_FRACTURE`.
    *   Note the "Purple Team Uplink" attempting to generate a forensic hypothesis.

4.  **Simulation Mode (Failover):**
    *   If you do not have active Twilio/SendGrid keys, the `Uplink Status` LED will turn **ORANGE**.
    *   The console will log: `[UPLINK_SIM]: Satellite Link Degradation Detected`.
    *   This confirms the logic paths are working, even without a paid carrier signal.

---
*Built for the Kaggle "AI in SRE" Open Challenge.*
