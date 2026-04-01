import { map } from "nanostores";
import { vehicleStore } from "./vehicleStore";
import { mqttStore } from "./mqttStore";
import { addCapacityEstimate, addDcPeakRecord, deleteCapacityEstimate, getActiveVehicleModel } from "./batteryHealthStore";

// Detect Tauri runtime (Android / desktop)
const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(cmd, args);
  } catch {
    // Non-fatal: service may not be registered on desktop
  }
}

// --- Cell health thresholds ---

export const CELL_VOLTAGE_DELTA_MV = {
  excellent: 30,
  good: 80,
  watch: 150,
  concern: 300,
} as const;

export const CELL_TEMP_DELTA_C = {
  excellent: 3,
  good: 5,
  watch: 8,
  concern: 15,
} as const;

export const SOH_THRESHOLDS = {
  excellent: 90,
  good: 80,
  fair: 70,
} as const;

export type HealthLevel = "excellent" | "good" | "watch" | "concern" | "critical" | "unknown";

export function getCellVoltageDeltaHealth(deltaMv: number | null): HealthLevel {
  if (deltaMv === null || !Number.isFinite(deltaMv)) return "unknown";
  if (deltaMv <= CELL_VOLTAGE_DELTA_MV.excellent) return "excellent";
  if (deltaMv <= CELL_VOLTAGE_DELTA_MV.good) return "good";
  if (deltaMv <= CELL_VOLTAGE_DELTA_MV.watch) return "watch";
  if (deltaMv <= CELL_VOLTAGE_DELTA_MV.concern) return "concern";
  return "critical";
}

export function getCellTempDeltaHealth(deltaC: number | null): HealthLevel {
  if (deltaC === null || !Number.isFinite(deltaC)) return "unknown";
  if (deltaC <= CELL_TEMP_DELTA_C.excellent) return "excellent";
  if (deltaC <= CELL_TEMP_DELTA_C.good) return "good";
  if (deltaC <= CELL_TEMP_DELTA_C.watch) return "watch";
  if (deltaC <= CELL_TEMP_DELTA_C.concern) return "concern";
  return "critical";
}

export function getSohHealth(soh: number | null): HealthLevel {
  if (soh === null || !Number.isFinite(soh)) return "unknown";
  if (soh >= SOH_THRESHOLDS.excellent) return "excellent";
  if (soh >= SOH_THRESHOLDS.good) return "good";
  if (soh >= SOH_THRESHOLDS.fair) return "watch";
  return "concern";
}

/** Composite session health score A/B/C/D */
export function getSessionHealthScore(
  voltDelta: number | null,
  tempDelta: number | null,
  soh: number | null,
): { grade: "A" | "B" | "C" | "D"; label: string; color: string } {
  const vH = getCellVoltageDeltaHealth(voltDelta);
  const tH = getCellTempDeltaHealth(tempDelta);
  const sH = getSohHealth(soh);

  const levelScore: Record<HealthLevel, number> = {
    excellent: 4, good: 3, watch: 2, concern: 1, critical: 0, unknown: 3,
  };
  const scores = [levelScore[vH], levelScore[tH], levelScore[sH]];
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avg >= 3.5) return { grade: "A", label: "Excellent", color: "text-green-600" };
  if (avg >= 2.5) return { grade: "B", label: "Good", color: "text-blue-600" };
  if (avg >= 1.5) return { grade: "C", label: "Watch", color: "text-yellow-600" };
  return { grade: "D", label: "Concern", color: "text-red-600" };
}

// --- Types ---

export interface ChargingSnapshot {
  timestamp: number;          // epoch ms
  elapsed_sec: number;         // seconds since session start
  soc_pct: number | null;
  power_kw: number | null;
  voltage_v: number | null;
  current_a: number | null;
  remaining_time_min: number | null;
  target_soc: number | null;
  connector_type: "AC" | "DC" | "unknown";
  // BMS Pack
  pack_temp: number | null;
  bms_pack_voltage: number | null;
  bms_pack_current: number | null;
  // Cell Voltage (mV) — may be fractional V from MQTT converted to mV
  cell_voltage_min_mv: number | null;
  cell_voltage_max_mv: number | null;
  cell_voltage_delta_mv: number | null;   // derived: max - min
  // Cell Temp (°C)
  cell_temp_min: number | null;
  cell_temp_max: number | null;
  cell_temp_delta: number | null;         // derived: max - min
  // Coolant
  coolant_inlet_temp: number | null;
  coolant_outlet_temp: number | null;
  // Health
  soh_pct: number | null;
  balancing_active: boolean;
  nominal_capacity_kwh: number | null;
  // Derived per snapshot
  session_energy_kwh: number | null;      // cumulative energy added (soc_delta × nominal / 100)
  estimated_capacity_kwh: number | null;  // energy_added / soc_delta * 100
  capacity_retention_pct: number | null;  // estimated / nominal * 100
  isStale?: boolean;                      // true = captured during MQTT offline gap
}

export interface ChargingLogSession {
  id: string;              // "vin_startTimestamp"
  vin: string;
  startTime: number;       // epoch ms
  endTime: number | null;  // null = in progress
  connector_type: "AC" | "DC" | "unknown";
  initial_soc: number | null;
  final_soc: number | null;
  peak_power_kw: number | null;
  max_cell_v_delta_mv: number | null;
  max_cell_t_delta: number | null;
  soh_at_start: number | null;
  soh_at_end: number | null;
  nominal_capacity_kwh: number | null;
  total_energy_added_kwh: number | null;
  estimated_capacity_kwh: number | null;
  capacity_retention_pct: number | null;
  snapshots: ChargingSnapshot[];
  anomaly_flags: number[];  // snapshot indices where cell_voltage_delta spiked >2x previous
  // Gap tracking (optional — backward-compatible)
  gaps?: { startTime: number; endTime: number; durationMs: number }[];
  totalGapMs?: number;
  segmentCount?: number;    // number of continuous recording runs (segments separated by gaps)
  // Manual binding to API charging history sessions
  linkedHistoryIds?: string[];
}

interface ChargingLiveState {
  isRecording: boolean;
  isCharging: boolean;
  currentSession: ChargingLogSession | null;
  sessions: ChargingLogSession[];   // max 50, newest first
  sampleRateMs: number;             // default 10000
}

// --- Constants ---
const STORAGE_KEY = "vf_charging_live_sessions_v1";
const SETTINGS_KEY = "vf_charging_log_settings_v1";
const MAX_SESSIONS = 50;
const DEFAULT_SAMPLE_RATE_MS = 10_000;

// --- Store ---
export const chargingLiveStore = map<ChargingLiveState>({
  isRecording: false,
  isCharging: false,
  currentSession: null,
  sessions: [],
  sampleRateMs: DEFAULT_SAMPLE_RATE_MS,
});

// --- Internal state ---
let _samplingTimer: ReturnType<typeof setInterval> | null = null;
let _gapStart: number | null = null;  // epoch ms when MQTT offline gap started (null = no gap)

// --- Storage helpers ---

function loadSettings(): { sampleRateMs: number } {
  if (typeof window === "undefined") return { sampleRateMs: DEFAULT_SAMPLE_RATE_MS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { sampleRateMs: DEFAULT_SAMPLE_RATE_MS };
    const parsed = JSON.parse(raw);
    const rate = Number(parsed?.sampleRateMs);
    return { sampleRateMs: Number.isFinite(rate) && rate >= 5000 ? rate : DEFAULT_SAMPLE_RATE_MS };
  } catch {
    return { sampleRateMs: DEFAULT_SAMPLE_RATE_MS };
  }
}

function persistSettings(sampleRateMs: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sampleRateMs }));
  } catch { /* quota */ }
}

function loadSessions(): ChargingLogSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.id === "string");
  } catch {
    return [];
  }
}

function persistSessions(sessions: ChargingLogSession[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch { /* quota */ }
}

// --- Core snapshot capture ---

function captureSnapshot(session: ChargingLogSession): ChargingSnapshot {
  const v = vehicleStore.get();
  const now = Date.now();
  const elapsed_sec = Math.round((now - session.startTime) / 1000);

  const soc = v.battery_level !== null ? Number(v.battery_level) : null;
  const power = v.charging_power_kw !== null ? Number(v.charging_power_kw) : null;
  const voltage = v.charging_voltage_v !== null ? Number(v.charging_voltage_v) : null;
  const current = v.charging_current_a !== null ? Number(v.charging_current_a) : null;

  // Cell voltage — API may return in V; convert to mV if < 10 (i.e. value is in Volts)
  const toMv = (raw: number | null | undefined): number | null => {
    if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return null;
    const n = Number(raw);
    return n < 10 ? Math.round(n * 1000) : Math.round(n);
  };
  const cell_v_min = toMv(v.bms_cell_voltage_min_mv);
  const cell_v_max = toMv(v.bms_cell_voltage_max_mv);
  const cell_v_delta =
    cell_v_min !== null && cell_v_max !== null ? cell_v_max - cell_v_min : null;

  const cell_t_min = v.bms_cell_temp_min !== null ? Number(v.bms_cell_temp_min) : null;
  const cell_t_max = v.bms_cell_temp_max !== null ? Number(v.bms_cell_temp_max) : null;
  const cell_t_delta =
    cell_t_min !== null && cell_t_max !== null ? +(cell_t_max - cell_t_min).toFixed(1) : null;

  const nominal = v.battery_nominal_capacity_kwh
    ? Number(v.battery_nominal_capacity_kwh)
    : null;

  // Cumulative energy estimate: Σ(ΔSOC × nominal / 100)
  let session_energy_kwh: number | null = null;
  const initialSoc = session.initial_soc;
  if (soc !== null && initialSoc !== null && nominal !== null && nominal > 0) {
    const socDelta = soc - initialSoc;
    if (socDelta > 0) {
      session_energy_kwh = +(socDelta * nominal / 100).toFixed(3);
    }
  }

  let estimated_capacity_kwh: number | null = null;
  let capacity_retention_pct: number | null = null;
  if (session_energy_kwh !== null && session_energy_kwh > 0 && initialSoc !== null && soc !== null) {
    const socDelta = soc - initialSoc;
    if (socDelta > 5) { // only estimate when we have enough delta to be meaningful
      estimated_capacity_kwh = +(session_energy_kwh / (socDelta / 100)).toFixed(1);
      if (nominal !== null && nominal > 0) {
        capacity_retention_pct = +((estimated_capacity_kwh / nominal) * 100).toFixed(1);
      }
    }
  }

  const connector_type: "AC" | "DC" | "unknown" =
    Number(v.dc_charging_gun) === 1 ? "DC"
      : Number(v.ac_charging_gun) === 1 ? "AC"
      : "unknown";

  return {
    timestamp: now,
    elapsed_sec,
    soc_pct: soc,
    power_kw: power,
    voltage_v: voltage,
    current_a: current,
    remaining_time_min: v.remaining_charging_time !== null ? Number(v.remaining_charging_time) : null,
    target_soc: v.target_soc !== null ? Number(v.target_soc) : null,
    connector_type,
    pack_temp: v.bms_pack_temp !== null ? Number(v.bms_pack_temp) : null,
    bms_pack_voltage: v.bms_pack_voltage !== null ? Number(v.bms_pack_voltage) : null,
    bms_pack_current: v.bms_pack_current !== null ? Number(v.bms_pack_current) : null,
    cell_voltage_min_mv: cell_v_min,
    cell_voltage_max_mv: cell_v_max,
    cell_voltage_delta_mv: cell_v_delta,
    cell_temp_min: cell_t_min,
    cell_temp_max: cell_t_max,
    cell_temp_delta: cell_t_delta,
    coolant_inlet_temp: v.bms_coolant_inlet_temp !== null ? Number(v.bms_coolant_inlet_temp) : null,
    coolant_outlet_temp: v.bms_coolant_outlet_temp !== null ? Number(v.bms_coolant_outlet_temp) : null,
    soh_pct: v.soh_percentage !== null ? Number(v.soh_percentage) : null,
    balancing_active: Number(v.bms_balance_active) === 1,
    nominal_capacity_kwh: nominal,
    session_energy_kwh,
    estimated_capacity_kwh,
    capacity_retention_pct,
  };
}

function detectAnomaly(snapshots: ChargingSnapshot[]): number[] {
  const flags: number[] = [];
  for (let i = 2; i < snapshots.length; i++) {
    const prev = snapshots[i - 1].cell_voltage_delta_mv;
    const curr = snapshots[i].cell_voltage_delta_mv;
    if (prev !== null && curr !== null && prev > 0 && curr > prev * 2 && curr > 50) {
      flags.push(i);
    }
  }
  return flags;
}

function finalizeSession(session: ChargingLogSession): ChargingLogSession {
  const v = vehicleStore.get();
  const snaps = session.snapshots;
  const lastSnap = snaps[snaps.length - 1];
  const finalSoc = lastSnap?.soc_pct ?? (v.battery_level !== null ? Number(v.battery_level) : null);

  const peakPower = snaps.reduce<number | null>((max, s) => {
    if (s.power_kw === null) return max;
    return max === null ? s.power_kw : Math.max(max, s.power_kw);
  }, null);

  const maxVDelta = snaps.reduce<number | null>((max, s) => {
    if (s.cell_voltage_delta_mv === null) return max;
    return max === null ? s.cell_voltage_delta_mv : Math.max(max, s.cell_voltage_delta_mv);
  }, null);

  const maxTDelta = snaps.reduce<number | null>((max, s) => {
    if (s.cell_temp_delta === null) return max;
    return max === null ? s.cell_temp_delta : Math.max(max, s.cell_temp_delta);
  }, null);

  const lastEnergy = lastSnap?.session_energy_kwh ?? null;
  const lastEstCap = lastSnap?.estimated_capacity_kwh ?? null;
  const lastRetention = lastSnap?.capacity_retention_pct ?? null;
  const sohAtEnd = lastSnap?.soh_pct ?? null;

  return {
    ...session,
    endTime: Date.now(),
    final_soc: finalSoc,
    peak_power_kw: peakPower,
    max_cell_v_delta_mv: maxVDelta,
    max_cell_t_delta: maxTDelta,
    soh_at_end: sohAtEnd,
    total_energy_added_kwh: lastEnergy,
    estimated_capacity_kwh: lastEstCap,
    capacity_retention_pct: lastRetention,
    anomaly_flags: detectAnomaly(session.snapshots),
  };
}

function startSession() {
  const v = vehicleStore.get();
  const vin = v.vin;
  if (!vin) return;

  const startTime = Date.now();
  const soc = v.battery_level !== null ? Number(v.battery_level) : null;
  const connector_type: "AC" | "DC" | "unknown" =
    Number(v.dc_charging_gun) === 1 ? "DC"
      : Number(v.ac_charging_gun) === 1 ? "AC"
      : "unknown";

  const session: ChargingLogSession = {
    id: `${vin}_${startTime}`,
    vin,
    startTime,
    endTime: null,
    connector_type,
    initial_soc: soc,
    final_soc: null,
    peak_power_kw: null,
    max_cell_v_delta_mv: null,
    max_cell_t_delta: null,
    soh_at_start: v.soh_percentage !== null ? Number(v.soh_percentage) : null,
    soh_at_end: null,
    nominal_capacity_kwh: v.battery_nominal_capacity_kwh !== null ? Number(v.battery_nominal_capacity_kwh) : null,
    total_energy_added_kwh: null,
    estimated_capacity_kwh: null,
    capacity_retention_pct: null,
    snapshots: [],
    anomaly_flags: [],
  };

  // Capture first snapshot immediately
  const firstSnap = captureSnapshot(session);
  session.snapshots.push(firstSnap);

  chargingLiveStore.setKey("currentSession", session);
  chargingLiveStore.setKey("isRecording", true);
  chargingLiveStore.setKey("isCharging", true);

  const { sampleRateMs } = chargingLiveStore.get();

  // Start foreground service to keep app alive in background (Android)
  const socForNotif = session.initial_soc !== null ? Math.round(session.initial_soc) : -1;
  tauriInvoke("plugin:foreground-service|startService", {
    title: "VFDashboard",
    content: socForNotif >= 0 ? `Recording ${socForNotif}% — charging` : "Charging session recording…",
  });

  _samplingTimer = setInterval(() => {
    const state = chargingLiveStore.get();
    if (!state.currentSession) return;
    // Check if still charging
    const vNow = vehicleStore.get();
    const stillCharging = vNow.charging_status === 1 || vNow.charging_status === true || Number(vNow.charging_status) === 2;
    if (!stillCharging) {
      stopSession();
      return;
    }
    const snap = captureSnapshot(state.currentSession);
    const updatedSession = {
      ...state.currentSession,
      snapshots: [...state.currentSession.snapshots, snap],
    };
    chargingLiveStore.setKey("currentSession", updatedSession);

    // Update foreground service notification every 3rd snapshot
    const idx = updatedSession.snapshots.length;
    if (idx % 3 === 0) {
      const lastSnap = updatedSession.snapshots.at(-1);
      tauriInvoke("plugin:foreground-service|updateNotification", {
        soc: lastSnap?.soc_pct !== null ? Math.round(lastSnap!.soc_pct!) : -1,
        power: lastSnap?.power_kw ?? -1,
      });
    }
  }, sampleRateMs);
}

function stopSession() {
  if (_samplingTimer !== null) {
    clearInterval(_samplingTimer);
    _samplingTimer = null;
  }

  const state = chargingLiveStore.get();
  if (!state.currentSession) {
    chargingLiveStore.setKey("isRecording", false);
    chargingLiveStore.setKey("isCharging", false);
    return;
  }

  const finalized = finalizeSession(state.currentSession);

  // Stop foreground service
  tauriInvoke("plugin:foreground-service|stopService");

  // Prepend to sessions list, keep max 50
  const updated = [finalized, ...state.sessions].slice(0, MAX_SESSIONS);
  persistSessions(updated);

  chargingLiveStore.setKey("currentSession", null);
  chargingLiveStore.setKey("sessions", updated);
  chargingLiveStore.setKey("isRecording", false);
  chargingLiveStore.setKey("isCharging", false);
}

// --- Public API ---

/** Change the sampling interval. Takes effect on the next session. */
export function setSampleRate(ms: number) {
  const clamped = Math.max(5_000, Math.min(300_000, ms));
  chargingLiveStore.setKey("sampleRateMs", clamped);
  persistSettings(clamped);

  // If currently recording, restart the timer with new rate
  const state = chargingLiveStore.get();
  if (state.isRecording && _samplingTimer !== null) {
    clearInterval(_samplingTimer);
    _samplingTimer = setInterval(() => {
      const s = chargingLiveStore.get();
      if (!s.currentSession) return;
      const vNow = vehicleStore.get();
      const stillCharging = vNow.charging_status === 1 || vNow.charging_status === true || Number(vNow.charging_status) === 2;
      if (!stillCharging) { stopSession(); return; }
      const snap = captureSnapshot(s.currentSession);
      chargingLiveStore.setKey("currentSession", { ...s.currentSession, snapshots: [...s.currentSession.snapshots, snap] });
    }, clamped);
  }
}

/** Save a completed or imported session manually */
export function saveSession(session: ChargingLogSession) {
  const state = chargingLiveStore.get();
  const deduped = state.sessions.filter((s) => s.id !== session.id);
  const updated = [session, ...deduped].slice(0, MAX_SESSIONS);
  persistSessions(updated);
  chargingLiveStore.setKey("sessions", updated);

  const model = getActiveVehicleModel();
  const deltaSoc =
    session.initial_soc !== null && session.final_soc !== null
      ? +(session.final_soc - session.initial_soc).toFixed(1)
      : null;

  if (
    session.connector_type === "AC" &&
    deltaSoc !== null &&
    deltaSoc >= 20 &&
    session.initial_soc !== null &&
    session.final_soc !== null &&
    session.total_energy_added_kwh !== null &&
    session.total_energy_added_kwh > 0
  ) {
    const socStart = session.initial_soc;
    const socEnd = session.final_soc;
    const packEnergyKwh = +session.total_energy_added_kwh.toFixed(2);
    const gridEnergyKwh = +(packEnergyKwh / Math.max(model.acChargerEfficiency, 0.01)).toFixed(2);
    const estimatedPackKwh = +(packEnergyKwh / (deltaSoc / 100)).toFixed(2);
    const estimatedSoh = +((estimatedPackKwh / model.nominalCapacityKwh) * 100).toFixed(1);
    addCapacityEstimate({
      id: `cap_${session.id}`,
      date: session.endTime ?? session.startTime,
      socStart,
      socEnd,
      deltaSoc,
      gridEnergyKwh,
      packEnergyKwh,
      estimatedPackKwh,
      estimatedSoh,
      chargeType: session.connector_type,
      sourceLogId: session.id,
    });
  }

  if (session.connector_type === "DC" && session.peak_power_kw !== null && session.peak_power_kw > 0) {
    const peakSnapshot = session.snapshots.reduce<ChargingSnapshot | null>((selected, snap) => {
      if (snap.power_kw === null) return selected;
      if (!selected || (selected.power_kw ?? 0) < snap.power_kw) return snap;
      return selected;
    }, null);
    addDcPeakRecord({
      id: `dc_${session.id}`,
      date: session.endTime ?? session.startTime,
      peakPowerKw: +session.peak_power_kw.toFixed(1),
      cRate: +(session.peak_power_kw / model.nominalCapacityKwh).toFixed(2),
      socAtPeak: peakSnapshot?.soc_pct ?? null,
      sourceLogId: session.id,
    });
  }
}

/** Append new snapshots to an existing session (for joining two recording runs) */
export function appendToSession(
  baseSession: ChargingLogSession,
  newSnapshots: ChargingSnapshot[],
  gapMs: number,
): void {
  const gapStart = newSnapshots[0]?.timestamp ? newSnapshots[0].timestamp - gapMs : Date.now() - gapMs;
  const gapEnd = newSnapshots[0]?.timestamp ?? Date.now();
  const merged: ChargingLogSession = {
    ...baseSession,
    snapshots: [...baseSession.snapshots, ...newSnapshots].sort((a, b) => a.timestamp - b.timestamp),
    gaps: [...(baseSession.gaps ?? []), { startTime: gapStart, endTime: gapEnd, durationMs: gapMs }],
    totalGapMs: (baseSession.totalGapMs ?? 0) + gapMs,
    segmentCount: (baseSession.segmentCount ?? 1) + 1,
    anomaly_flags: [],
    endTime: baseSession.endTime ?? (newSnapshots.at(-1)?.timestamp ?? null),
  };
  // Re-finalize: update peak power, max deltas, final SOC, energy
  const snaps = merged.snapshots;
  const lastSnap = snaps.at(-1);
  merged.final_soc = lastSnap?.soc_pct ?? baseSession.final_soc;
  merged.soh_at_end = lastSnap?.soh_pct ?? baseSession.soh_at_end;
  merged.total_energy_added_kwh = lastSnap?.session_energy_kwh ?? baseSession.total_energy_added_kwh;
  merged.estimated_capacity_kwh = lastSnap?.estimated_capacity_kwh ?? baseSession.estimated_capacity_kwh;
  merged.capacity_retention_pct = lastSnap?.capacity_retention_pct ?? baseSession.capacity_retention_pct;
  merged.peak_power_kw = snaps.reduce<number | null>((m, s) => s.power_kw !== null ? Math.max(m ?? 0, s.power_kw) : m, null);
  merged.max_cell_v_delta_mv = snaps.reduce<number | null>((m, s) => s.cell_voltage_delta_mv !== null ? Math.max(m ?? 0, s.cell_voltage_delta_mv) : m, null);
  merged.max_cell_t_delta = snaps.reduce<number | null>((m, s) => s.cell_temp_delta !== null ? Math.max(m ?? 0, s.cell_temp_delta) : m, null);
  merged.anomaly_flags = detectAnomaly(merged.snapshots);
  saveSession(merged);
}

/** Delete a stored session by ID */
export function deleteSession(id: string): void {
  const state = chargingLiveStore.get();
  const updated = state.sessions.filter((s) => s.id !== id);
  persistSessions(updated);
  chargingLiveStore.setKey("sessions", updated);
}

/** Bind a local log session to an API charging history session */
export function bindLogToHistory(
  logSessionId: string,
  historySessionId: string,
  historyTotalKWh?: string | number | null,
): void {
  const state = chargingLiveStore.get();
  const updated = state.sessions.map((s) => {
    if (s.id !== logSessionId) return s;
    const ids = s.linkedHistoryIds ?? [];
    if (ids.includes(historySessionId)) return s;
    return { ...s, linkedHistoryIds: [...ids, historySessionId] };
  });
  persistSessions(updated);
  chargingLiveStore.setKey("sessions", updated);

  const targetSession = updated.find((item) => item.id === logSessionId) ?? null;

  // Use API grid energy (totalKWCharged) + linked log SOC to produce a more realistic AC capacity estimate.
  const model = getActiveVehicleModel();
  const gridEnergyKwh =
    historyTotalKWh === null || historyTotalKWh === undefined
      ? null
      : Number.isFinite(Number(historyTotalKWh))
        ? Number(historyTotalKWh)
        : Number.parseFloat(String(historyTotalKWh));
  if (
    targetSession &&
    Number.isFinite(gridEnergyKwh) &&
    gridEnergyKwh !== null &&
    gridEnergyKwh > 0 &&
    targetSession.initial_soc !== null &&
    targetSession.final_soc !== null
  ) {
    const deltaSoc = +(targetSession.final_soc - targetSession.initial_soc).toFixed(1);
    if (deltaSoc >= 20) {
      const packEnergyKwh = +(gridEnergyKwh * Math.max(model.acChargerEfficiency, 0.01)).toFixed(2);
      const estimatedPackKwh = +(packEnergyKwh / (deltaSoc / 100)).toFixed(2);
      const estimatedSoh = +((estimatedPackKwh / model.nominalCapacityKwh) * 100).toFixed(1);
      addCapacityEstimate({
        id: `cap_link_${logSessionId}_${historySessionId}`,
        date: targetSession.endTime ?? targetSession.startTime,
        socStart: targetSession.initial_soc,
        socEnd: targetSession.final_soc,
        deltaSoc,
        gridEnergyKwh: +gridEnergyKwh.toFixed(2),
        packEnergyKwh,
        estimatedPackKwh,
        estimatedSoh,
        chargeType: targetSession.connector_type,
        sourceLogId: targetSession.id,
        sourceHistoryId: historySessionId,
      });
    }
  }
}

/** Remove the binding between a local log session and an API history session */
export function unbindLogFromHistory(logSessionId: string, historySessionId: string): void {
  const state = chargingLiveStore.get();
  const updated = state.sessions.map((s) => {
    if (s.id !== logSessionId) return s;
    return { ...s, linkedHistoryIds: (s.linkedHistoryIds ?? []).filter((id) => id !== historySessionId) };
  });
  persistSessions(updated);
  chargingLiveStore.setKey("sessions", updated);

  // Remove capacity estimate that originated from this specific link.
  deleteCapacityEstimate(`cap_link_${logSessionId}_${historySessionId}`);
}

/** Find a session matching a charging history record by timestamp proximity */
export function findMatchingSession(pluggedTime: number): ChargingLogSession | null {
  const state = chargingLiveStore.get();
  return state.sessions.find((s) => Math.abs(s.startTime - pluggedTime) < 10 * 60 * 1000) ?? null;
}

// --- Initialize: load persisted data + watch vehicleStore ---

let _initialized = false;

export function initChargingLiveStore() {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;

  const { sampleRateMs } = loadSettings();
  const sessions = loadSessions();
  chargingLiveStore.setKey("sampleRateMs", sampleRateMs);
  chargingLiveStore.setKey("sessions", sessions);

  // Watch vehicleStore for charging status changes
  vehicleStore.subscribe((v) => {
    const isCharging = v.charging_status === 1 || v.charging_status === true || Number(v.charging_status) === 2;
    const state = chargingLiveStore.get();

    if (isCharging && !state.isRecording && _gapStart === null) {
      startSession();
    } else if (!isCharging && (state.isRecording || state.isCharging)) {
      stopSession();
    }
  });

  // Watch mqttStore for connection gaps mid-session (pause recording without ending the session)
  mqttStore.subscribe((mqtt) => {
    const state = chargingLiveStore.get();
    const isOffline = mqtt.status === "disconnected" || mqtt.status === "error";

    if (isOffline && state.isRecording && state.currentSession) {
      // MQTT went down — pause sampling, keep session alive
      if (_samplingTimer !== null) {
        clearInterval(_samplingTimer);
        _samplingTimer = null;
      }
      _gapStart = Date.now();
      chargingLiveStore.setKey("isRecording", false);
      // Keep isCharging = true so the session is not closed
    } else if (!isOffline && _gapStart !== null && state.isCharging && state.currentSession) {
      // MQTT reconnected — record gap, resume sampling
      const gapEnd = Date.now();
      const durationMs = gapEnd - _gapStart;
      const currentSession = state.currentSession;
      const updatedSession: ChargingLogSession = {
        ...currentSession,
        gaps: [...(currentSession.gaps ?? []), { startTime: _gapStart, endTime: gapEnd, durationMs }],
        totalGapMs: (currentSession.totalGapMs ?? 0) + durationMs,
        segmentCount: (currentSession.segmentCount ?? 1) + 1,
      };
      chargingLiveStore.setKey("currentSession", updatedSession);
      _gapStart = null;
      chargingLiveStore.setKey("isRecording", true);

      // Restart sampling timer
      const { sampleRateMs } = chargingLiveStore.get();
      _samplingTimer = setInterval(() => {
        const s = chargingLiveStore.get();
        if (!s.currentSession) return;
        const vNow = vehicleStore.get();
        const stillCharging = vNow.charging_status === 1 || vNow.charging_status === true || Number(vNow.charging_status) === 2;
        if (!stillCharging) { stopSession(); return; }
        const snap = captureSnapshot(s.currentSession);
        chargingLiveStore.setKey("currentSession", { ...s.currentSession, snapshots: [...s.currentSession.snapshots, snap] });
      }, sampleRateMs);
    }
  });
}
