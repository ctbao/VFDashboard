# Charging Live — User Guide

VFDashboard's **Charging Live** feature records real-time battery telemetry during every charge session and lets you export structured logs for analysis. Data is streamed from the car over MQTT and sampled at a configurable interval.

---

## Table of Contents

1. [Status Header](#1-status-header)
2. [SOC Section](#2-soc-state-of-charge)
3. [Power Metrics](#3-power-metrics)
4. [Cell Health](#4-cell-health)
5. [BMS Details](#5-bms-details)
6. [Session Log](#6-session-log)
7. [Sparkline Trends](#7-sparkline-trends)
8. [Sample Rate](#8-sample-rate)
9. [Export & Import](#9-export--import)
10. [Dashboard Card](#10-dashboard-card)
11. [Charging Log Modal](#11-charging-log-modal)
12. [Health Scoring](#12-health-scoring)
13. [Background Recording (Android)](#13-background-recording-android)

---

## 1. Status Header

The top bar of the Charging Live screen provides a live summary of connection and recording state.

| Badge | Meaning |
|---|---|
| 🟢 **Charging** | Car reports active charge status |
| **DC / AC** (purple / green pill) | Detected connector type |
| 🔴 **REC** (pulsing) | Session is actively being recorded |
| **Live** (green, pulsing) | MQTT data is fresh (< 30 s old) |
| **Nm ago** (yellow) | Connected but last message was N minutes ago |
| **Reconnecting…** (blue, pulsing) | MQTT client is retrying connection |
| **MQTT offline** (red) | No MQTT connection — data is stale |
| **A / B / C / D** | Session battery health grade (see [Health Scoring](#12-health-scoring)) |

> **Tip:** If you see "MQTT offline" mid-charge, the app will automatically resume recording when the connection is restored. The gap is noted in the Session Log.

---

## 2. SOC (State of Charge)

A large circular arc gauge shows the current battery level at a glance.

- The **solid arc** (blue / red) represents current SOC. Turns red below 20%.
- The **faint background arc** (light blue) represents your target SOC.
- **Remaining time** until target is shown below the arc, formatted as `Xh Ym`.
- **Range** (km) and **target SOC %** are displayed alongside.

---

## 3. Power Metrics

Three large metrics show the instantaneous charging data:

| Metric | Unit | Description |
|---|---|---|
| Power | kW | Active power delivered to battery |
| Voltage | V | Charging voltage at inlet |
| Current | A | Charging current |

If BMS pack-level readings are available, **BMS pack voltage** and **BMS pack current** are shown as supplementary rows below.

---

## 4. Cell Health

This is the most important section for battery longevity monitoring.

### Cell Voltage Balance

| Health Level | Max Delta (mV) | Color |
|---|---|---|
| Excellent | ≤ 30 | Green |
| Good | ≤ 80 | Blue |
| Watch | ≤ 150 | Yellow |
| Concern | ≤ 300 | Orange |
| Critical | > 300 | Red |

Three cards show **Min cell voltage**, **Max cell voltage**, and **Δ Delta** (the spread). A sparkline below tracks voltage delta over the entire session — a widening spread may indicate a degraded cell.

### Thermal Balance

| Health Level | Max Delta (°C) | Color |
|---|---|---|
| Excellent | ≤ 3 | Green |
| Good | ≤ 5 | Blue |
| Watch | ≤ 8 | Yellow |
| Concern | ≤ 15 | Orange |
| Critical | > 15 | Red |

Three cards show **Min cell temp**, **Max cell temp**, and **Δ Delta**. A sparkline tracks thermal spread over the session.

> **Why it matters:** A high cell temperature delta during charging can accelerate degradation. A high voltage delta suggests cells are not balancing correctly.

---

## 5. BMS Details

Additional battery management system data collected during the session:

| Field | Description |
|---|---|
| **SOH** | State of Health percentage. Green ≥ 90%, Blue ≥ 80%, Yellow ≥ 70%, Orange < 70% |
| **Pack temperature** | Overall pack temperature in °C |
| **Coolant inlet / outlet** | Thermal management fluid temperatures (if available) |
| **Balancing** | "Active" (blue) = cell balancing is running; "Idle" = not needed yet |
| **Nominal capacity** | Factory battery capacity in kWh |
| **Est. capacity** | Capacity estimated from energy added this session |
| **Capacity retention** | Estimated ÷ Nominal × 100% — how much original capacity remains |

### ⚠ Thermal Runaway Warning

If the car reports `bms_thermal_runaway = 1`, a **red pulsing banner** appears. Stop charging and contact VinFast service immediately.

---

## 6. Session Log

The Session Log section tracks the active recording run.

| Field | Description |
|---|---|
| **Status** | "Recording" (red) or "Stopped" |
| **Elapsed** | Time since session start |
| **Snapshots** | Number of data points captured |
| **Initial SOC** | Battery % at session start |
| **Energy added** | Cumulative kWh delivered so far |

### Gap / Interruption Badges

If MQTT disconnected and reconnected during a session, a **yellow warning badge** appears:

> ⚠ 2 interruptions · 3 segments

- **Interruption** = a period where live data was unavailable (MQTT offline).
- **Segment** = a continuous recording run between interruptions.
- The session is kept intact across gaps; snapshots from each segment are merged by timestamp.
- Exported data will contain null-value rows around the gap periods (compressed out in exports).

---

## 7. Sparkline Trends

Once 3 or more snapshots are captured, four mini trend charts appear:

| Chart | Color | What to watch for |
|---|---|---|
| **SOC (%)** | Blue | Smooth upward curve = healthy charge rate |
| **Power (kW)** | Green | Flat then tapering = CC/CV charging pattern |
| **Cell V Delta (mV)** | Orange | Should stay flat or slightly decrease |
| **Cell T Delta (°C)** | Dark orange | Should stay stable; spikes = thermal stress |

Each chart header shows the current live value.

---

## 8. Sample Rate

Control how often a snapshot is captured. Tap any button to change the rate — it takes effect on the next interval.

| Option | Interval | Storage impact |
|---|---|---|
| **5s** | Every 5 seconds | ~720 snapshots/hour |
| **10s** | Every 10 seconds | ~360 snapshots/hour |
| **30s** *(default)* | Every 30 seconds | ~120 snapshots/hour |
| **60s** | Every minute | ~60 snapshots/hour |
| **2m** | Every 2 minutes | ~30 snapshots/hour |

> For a detailed analysis (e.g. rapid CC→CV transition), use **5s**. For long overnight sessions, **2m** is sufficient.

The chosen rate is saved and restored on next launch.

---

## 9. Export & Import

### Export Current Session

| Button | Format | Best for |
|---|---|---|
| **Export CSV** | UTF-8 BOM CSV (Excel-compatible) | Excel / Google Sheets analysis |
| **Export JSON** | Pretty-printed JSON | Scripting, programmatic analysis |

Both formats include a **metadata header** (session ID, VIN, start/end time, connector, peak power, health metrics) followed by one row/object per snapshot. Null-only snapshots are automatically filtered out before export.

**CSV columns (26 total):**
`datetime`, `elapsed_sec`, `soc_pct`, `power_kw`, `voltage_v`, `current_a`, `remaining_time_min`, `target_soc`, `connector_type`, `pack_temp_c`, `cell_temp_min_c`, `cell_temp_max_c`, `cell_temp_delta_c`, `coolant_inlet_c`, `coolant_outlet_c`, `cell_v_min_mv`, `cell_v_max_mv`, `cell_v_delta_mv`, `bms_pack_voltage_v`, `bms_pack_current_a`, `soh_pct`, `balancing_active`, `nominal_capacity_kwh`, `session_energy_kwh`, `estimated_capacity_kwh`, `capacity_retention_pct`

### Export All Sessions

**Export All** bundles every stored session into one JSON file:
```json
{
  "exported_at": "...",
  "app": "VFDashboard",
  "session_count": 12,
  "sessions": [ ... ]
}
```

### Import Sessions

Tap **Import Log** to load a `.json` file exported from another device or session.

- Accepts: single session object, array of sessions, or the `{ sessions: [...] }` wrapper format.
- **Duplicate sessions are skipped** (matched by session ID).
- Status feedback confirms how many sessions were imported vs. skipped.

### File Storage (Android / Desktop App)

On the native app (Tauri), files are written directly to the device:

```
~/Downloads/VFDashboard/charging_log_{VIN_last6}_{YYYY-MM-DD}.csv
```

After saving, a toast notification at the bottom of the screen shows the full path. Tap it to dismiss, or tap **View Folder** to copy the path. Files are accessible via USB file transfer.

On web (browser), the OS share sheet is shown on mobile, or the file downloads directly on desktop.

### Session Storage Limits

- Up to **50 sessions** are stored locally (localStorage on web, persisted on app).
- Oldest sessions are dropped when the limit is reached.
- The current session count is shown at the bottom of the Session Log section.

---

## 10. Dashboard Card

The **Charging Live card** on the main dashboard shows a compact summary without navigating to the full screen.

**When not charging:**
- Battery icon + "Charging Live" label + current SOC %

**When charging actively:**
- Connector type badge + REC badge + health grade
- SOC arc (small), power (kW), V/A grid
- Remaining time, target SOC
- Cell voltage and thermal cards with health badges
- Battery health (SOH, capacity)
- Session stats (elapsed, snapshots, energy added)

Tap the card to open the full Charging Live screen.

---

## 11. Charging Log Modal

Tap any historical session to open the **Charging Log Modal** for a detailed summary.

**Summary grid:**
- Energy added (kWh), Session duration, Peak power (kW)

**SOC range:**
- Start → End battery percentage (e.g. `32% → 80%`)

**Health charts:**
- Cell voltage delta trend + max delta badge
- Thermal delta trend + max delta badge
- SOH badge + capacity figures

**Trend sparklines:**
- SOC over session, Power over session

**Anomaly alerts:**
If an anomaly was detected, an orange banner shows which snapshots had a sudden voltage delta spike (> 2× previous value AND > 50 mV). This may indicate a weak cell under load and is worth monitoring over multiple sessions.

**Export buttons** at the bottom let you export that specific historical session as CSV or JSON.

---

## 12. Health Scoring

The health grade **A / B / C / D** is calculated at the end of the session (or live during recording) from three factors:

| Factor | Weight | Thresholds |
|---|---|---|
| **Cell voltage delta** | High | A: ≤30 mV · B: ≤80 · C: ≤150 · D: >150 |
| **Cell temperature delta** | Medium | A: ≤3°C · B: ≤5 · C: ≤8 · D: >8 |
| **SOH** | Medium | A: ≥90% · B: ≥80 · C: ≥70 · D: <70 |

The worst individual sub-score determines the overall grade. A session with excellent voltage balance but critical thermal spread will still receive **D**.

---

## 13. Background Recording (Android)

On Android, VFDashboard runs a **foreground service** while a charging session is active. This prevents the OS from killing the app when the screen is off or the app is backgrounded.

**What you'll see:**
- A persistent notification in the status bar: *"Recording 78% · 50.3 kW"*
- The notification updates every 3 snapshots with the latest SOC and power.

**MQTT disconnects mid-session:**
- Recording pauses automatically (the session is NOT ended).
- When MQTT reconnects, recording resumes and the gap is logged (see [Section 6](#6-session-log)).
- The foreground service stays alive throughout to keep the process warm.

**To stop recording:**
- Navigate to the Charging Live screen and tap **Stop** (recording stops when charging ends automatically).
- The notification is dismissed when the session ends.

---

*VFDashboard Charging Live — captures up to 50 sessions, 26 metrics per snapshot, with full export support.*
