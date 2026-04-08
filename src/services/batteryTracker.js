import { atom } from "nanostores";
import { batteryHealthStore, addRangeDiaryEntry, addSocDropAnomaly, classifyWeatherCondition, getActiveVehicleModel } from "../stores/batteryHealthStore";
import { vehicleStore } from "../stores/vehicleStore";

const isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
const ACTIVE_TRIP_STORAGE_KEY = "vf_active_trip_v1";
const TICK_MS = 15_000;
const DEFAULT_TRACKER_CONFIG = {
  idleTimeoutMs: 5 * 60 * 1000,
  countdownDurationMs: 5 * 60 * 1000,
  maxResumeGapMs: 30 * 60 * 1000,
};

let trackerTimer = null;
let activeTrip = null;
let idleSince = null;
let pausedSince = null;
let countdownEndsAt = null;
let pauseMode = null;
let tripState = "idle";
let serviceStarted = false;
let needsResumePrompt = false;
let restoredFromStorage = false;
let lastHeartbeat = null;
let restoreAgeMs = null;
let visibilityListenersBound = false;

const DEFAULT_TRACKER_STATUS = {
  running: false,
  tripInProgress: false,
  idleSince: null,
  pausedSince: null,
  countdownEndsAt: null,
  tripState: "idle",
  tripStartedAt: null,
  lastHeartbeat: null,
  restoreAgeMs: null,
  currentSoc: null,
  currentSpeed: 0,
  currentRangeKm: null,
  currentOdometer: null,
  outsideTempC: null,
  acClimateActive: false,
  socStart: null,
  socCurrent: null,
  distanceKm: 0,
  estimatedKwhUsed: 0,
  liveKwhPer100km: 0,
  elapsedMinutes: 0,
  avgSpeedKmh: null,
  pauseMode: null,
  needsResumePrompt: false,
  restoredFromStorage: false,
  manualStarted: false,
  idleTimeoutMs: DEFAULT_TRACKER_CONFIG.idleTimeoutMs,
  countdownDurationMs: DEFAULT_TRACKER_CONFIG.countdownDurationMs,
};

export const trackerStatusStore = atom(DEFAULT_TRACKER_STATUS);

function num(value) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTrackerConfig() {
  const config = batteryHealthStore.get()?.trackerConfig ?? {};
  return {
    idleTimeoutMs: num(config.idleTimeoutMs) ?? DEFAULT_TRACKER_CONFIG.idleTimeoutMs,
    countdownDurationMs: num(config.countdownDurationMs) ?? DEFAULT_TRACKER_CONFIG.countdownDurationMs,
    maxResumeGapMs: num(config.maxResumeGapMs) ?? DEFAULT_TRACKER_CONFIG.maxResumeGapMs,
  };
}

function getOutsideTemp(state) {
  return num(state.outside_temp) ?? num(state.weather_outside_temp);
}

function isDriving(state) {
  const speed = num(state.speed) ?? 0;
  return speed > 0;
}

function shouldPersistTrip(entry) {
  return entry.distanceKm >= 2 && Math.abs(entry.socEnd - entry.socStart) >= 2;
}

function weatherAdjustedExpected(model, outsideTempC) {
  let expected = model.expectedKwhPer100km;
  if (outsideTempC !== null && outsideTempC !== undefined) {
    if (outsideTempC >= 35) expected *= 1.12;
    if (outsideTempC <= 15) expected *= 1.15;
  }
  return expected;
}

async function invokeForeground(command, args) {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(command, args);
  } catch {
    // Ignore when plugin not available on web/desktop.
  }
}

function ensureForegroundService(vehicle) {
  if (!activeTrip || !isTauri) return;
  if (!serviceStarted) {
    serviceStarted = true;
    invokeForeground("plugin:foreground-service|startBatteryTracker", {
      title: "VFDashboard",
      content: "Đang theo dõi chuyến đi và sức khỏe pin…",
    });
  }
  invokeForeground("plugin:foreground-service|updateBatteryTrackerNotification", {
    soc: num(vehicle?.battery_level) ?? -1,
    temp: getOutsideTemp(vehicle) ?? -1,
    rangeKm: num(vehicle?.range) ?? -1,
  });
}

function stopForegroundService() {
  if (isTauri && serviceStarted) {
    serviceStarted = false;
    invokeForeground("plugin:foreground-service|stopBatteryTracker");
  }
}

function clearPersistedTrip() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function saveActiveTripToStorage() {
  if (typeof window === "undefined") return;
  if (!activeTrip) {
    clearPersistedTrip();
    return;
  }
  try {
    window.localStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, JSON.stringify({
      activeTrip,
      idleSince,
      pausedSince,
      countdownEndsAt,
      pauseMode,
      tripState,
      lastHeartbeat,
      restoredFromStorage,
      restoreAgeMs,
    }));
  } catch {
    // Ignore quota errors.
  }
}

function loadActiveTripFromStorage() {
  if (typeof window === "undefined" || activeTrip) return;
  try {
    const raw = window.localStorage.getItem(ACTIVE_TRIP_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.activeTrip || typeof parsed.activeTrip !== "object") {
      clearPersistedTrip();
      return;
    }
    activeTrip = parsed.activeTrip;
    idleSince = num(parsed.idleSince);
    pausedSince = num(parsed.pausedSince);
    countdownEndsAt = num(parsed.countdownEndsAt);
    pauseMode = typeof parsed.pauseMode === "string" ? parsed.pauseMode : null;
    tripState = typeof parsed.tripState === "string" ? parsed.tripState : "paused";
    lastHeartbeat = num(parsed.lastHeartbeat);
    const gapMs = lastHeartbeat === null ? null : Math.max(0, Date.now() - lastHeartbeat);
    restoreAgeMs = gapMs;
    restoredFromStorage = true;
    needsResumePrompt = Boolean(gapMs !== null && gapMs > getTrackerConfig().maxResumeGapMs);
    if (activeTrip && tripState === "idle") {
      tripState = "paused";
    }
  } catch {
    clearPersistedTrip();
  }
}

function createTripSnapshot(state, options = {}) {
  const soc = num(state.battery_level);
  const odometer = num(state.odometer);
  const rangeStart = num(state.range);
  if (soc === null || (odometer === null && rangeStart === null)) return null;
  return {
    timestamp: Date.now(),
    socStart: soc,
    odometerStart: odometer,
    rangeStart,
    totalPausedMs: 0,
    pauseStartedAt: null,
    manualStarted: Boolean(options.manualStarted),
  };
}

function getTripDistance(start, endState) {
  const odoEnd = num(endState.odometer);
  const rangeEnd = num(endState.range);
  let distanceKm = 0;
  let distanceSource = "odometer";

  if (start.odometerStart !== null && start.odometerStart !== undefined && odoEnd !== null) {
    distanceKm = +(Math.max(0, odoEnd - start.odometerStart)).toFixed(1);
  } else if (start.rangeStart !== null && start.rangeStart !== undefined && rangeEnd !== null) {
    distanceKm = +(Math.max(0, start.rangeStart - rangeEnd)).toFixed(1);
    distanceSource = "range_estimate";
  }

  return {
    distanceKm,
    distanceSource,
    odometerEnd: odoEnd ?? start.odometerStart ?? 0,
    rangeEnd,
  };
}

function getLiveTripMetrics(vehicle) {
  if (!activeTrip) {
    return {
      socCurrent: num(vehicle.battery_level),
      distanceKm: 0,
      estimatedKwhUsed: 0,
      kwhPer100km: 0,
      durationMinutes: 0,
      avgSpeedKmh: null,
    };
  }

  const state = batteryHealthStore.get();
  const model = getActiveVehicleModel(state);
  const socCurrent = num(vehicle.battery_level) ?? activeTrip.socStart;
  const { distanceKm } = getTripDistance(activeTrip, vehicle);
  const deltaSoc = Math.max(0, (activeTrip.socStart ?? socCurrent ?? 0) - (socCurrent ?? 0));
  const estimatedKwhUsed = +((deltaSoc * model.nominalCapacityKwh) / 100).toFixed(2);
  const activePausedMs = activeTrip.pauseStartedAt ? Date.now() - activeTrip.pauseStartedAt : 0;
  const elapsedMs = Math.max(0, Date.now() - activeTrip.timestamp - (activeTrip.totalPausedMs ?? 0) - activePausedMs);
  const durationMinutes = Math.max(0, Math.round(elapsedMs / 60000));
  const avgSpeedKmh = durationMinutes > 0 ? +((distanceKm / durationMinutes) * 60).toFixed(1) : null;
  const kwhPer100km = distanceKm > 0 ? +((estimatedKwhUsed / distanceKm) * 100).toFixed(1) : 0;

  return {
    socCurrent,
    distanceKm,
    estimatedKwhUsed,
    kwhPer100km,
    durationMinutes,
    avgSpeedKmh,
  };
}

function syncTrackerStatus() {
  const vehicle = vehicleStore.get();
  const config = getTrackerConfig();
  const metrics = getLiveTripMetrics(vehicle);
  trackerStatusStore.set({
    running: Boolean(trackerTimer),
    tripInProgress: Boolean(activeTrip && ["driving", "paused", "countdown"].includes(tripState)),
    idleSince,
    pausedSince,
    countdownEndsAt,
    tripState: activeTrip ? tripState : "idle",
    tripStartedAt: activeTrip?.timestamp ?? null,
    lastHeartbeat,
    restoreAgeMs,
    currentSoc: num(vehicle.battery_level),
    currentSpeed: num(vehicle.speed) ?? 0,
    currentRangeKm: num(vehicle.range),
    currentOdometer: num(vehicle.odometer),
    outsideTempC: getOutsideTemp(vehicle),
    acClimateActive: (num(vehicle.fan_speed) ?? 0) > 0,
    socStart: activeTrip?.socStart ?? null,
    socCurrent: metrics.socCurrent,
    distanceKm: metrics.distanceKm,
    estimatedKwhUsed: metrics.estimatedKwhUsed,
    liveKwhPer100km: metrics.kwhPer100km,
    elapsedMinutes: metrics.durationMinutes,
    avgSpeedKmh: metrics.avgSpeedKmh,
    pauseMode,
    needsResumePrompt: Boolean(needsResumePrompt && activeTrip),
    restoredFromStorage: Boolean(restoredFromStorage && activeTrip),
    manualStarted: Boolean(activeTrip?.manualStarted),
    idleTimeoutMs: config.idleTimeoutMs,
    countdownDurationMs: config.countdownDurationMs,
  });
}

function buildTripEntry(start, endState) {
  const state = batteryHealthStore.get();
  const model = getActiveVehicleModel(state);
  const socEnd = num(endState.battery_level);
  if (socEnd === null) return null;

  const { distanceKm, distanceSource, odometerEnd, rangeEnd } = getTripDistance(start, endState);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;

  const deltaSoc = Math.max(0, start.socStart - socEnd);
  const estimatedKwhUsed = +((deltaSoc * model.nominalCapacityKwh) / 100).toFixed(2);
  const activePausedMs = start.pauseStartedAt ? Date.now() - start.pauseStartedAt : 0;
  const durationMinutes = Math.max(1, Math.round((Date.now() - start.timestamp - (start.totalPausedMs ?? 0) - activePausedMs) / 60000));
  const outsideTempC = getOutsideTemp(endState);
  return {
    id: `${start.timestamp}`,
    type: "auto",
    timestamp: start.timestamp,
    socStart: start.socStart,
    socEnd,
    odometerStart: start.odometerStart ?? odometerEnd ?? 0,
    odometerEnd,
    distanceKm,
    estimatedKwhUsed,
    kwhPer100km: distanceKm > 0 ? +((estimatedKwhUsed / distanceKm) * 100).toFixed(1) : 0,
    durationMinutes,
    avgSpeedKmh: durationMinutes > 0 ? +((distanceKm / durationMinutes) * 60).toFixed(1) : null,
    outsideTempC,
    weatherCondition: classifyWeatherCondition(outsideTempC, num(endState.weather_code)),
    acClimateActive: (num(endState.fan_speed) ?? 0) > 0,
    rangeEstimateStart: start.rangeStart,
    rangeEstimateEnd: rangeEnd,
    distanceSource,
    note: start.manualStarted ? "Bản ghi được bắt đầu thủ công." : undefined,
  };
}

function maybePersistAnomaly(entry) {
  const state = batteryHealthStore.get();
  const model = getActiveVehicleModel(state);
  const expectedKwhPer100km = weatherAdjustedExpected(model, entry.outsideTempC ?? null);
  if (!expectedKwhPer100km || entry.kwhPer100km <= 0) return;
  const severityMultiplier = +(entry.kwhPer100km / expectedKwhPer100km).toFixed(2);
  if (severityMultiplier < model.anomalyThresholdMultiplier) return;
  const weatherRelated = entry.outsideTempC !== null && entry.outsideTempC !== undefined
    ? entry.outsideTempC >= 35 || entry.outsideTempC <= 15
    : false;
  addSocDropAnomaly({
    id: `anomaly_${entry.id}`,
    timestamp: entry.timestamp,
    socStart: entry.socStart,
    socEnd: entry.socEnd,
    distanceKm: entry.distanceKm,
    durationMinutes: entry.durationMinutes,
    actualKwhPer100km: entry.kwhPer100km,
    expectedKwhPer100km: +expectedKwhPer100km.toFixed(1),
    severityMultiplier,
    odometerStart: entry.odometerStart,
    odometerEnd: entry.odometerEnd,
    outsideTempC: entry.outsideTempC,
    weatherCondition: entry.weatherCondition,
    weatherRelated,
  });
}

function clearTripState() {
  activeTrip = null;
  idleSince = null;
  pausedSince = null;
  countdownEndsAt = null;
  pauseMode = null;
  tripState = "idle";
  needsResumePrompt = false;
  restoredFromStorage = false;
  restoreAgeMs = null;
  lastHeartbeat = null;
  clearPersistedTrip();
  stopForegroundService();
}

function beginTrip(vehicle, options = {}) {
  const snapshot = createTripSnapshot(vehicle, options);
  if (!snapshot) return false;
  activeTrip = snapshot;
  tripState = isDriving(vehicle) ? "driving" : "paused";
  idleSince = tripState === "paused" ? Date.now() : null;
  pausedSince = tripState === "paused" ? Date.now() : null;
  pauseMode = tripState === "paused" && options.manualStarted ? "manual" : null;
  if (tripState === "paused") {
    activeTrip.pauseStartedAt = Date.now();
  }
  countdownEndsAt = null;
  needsResumePrompt = false;
  restoredFromStorage = false;
  restoreAgeMs = null;
  lastHeartbeat = Date.now();
  saveActiveTripToStorage();
  syncTrackerStatus();
  return true;
}

function finalizeTrip({ save = true, forceSave = false, startNew = false } = {}) {
  const currentVehicle = vehicleStore.get();
  const entry = activeTrip ? buildTripEntry(activeTrip, currentVehicle) : null;
  if (entry && save && (forceSave || shouldPersistTrip(entry))) {
    addRangeDiaryEntry(entry);
    maybePersistAnomaly(entry);
  }
  clearTripState();
  if (startNew) {
    beginTrip(currentVehicle, { manualStarted: true });
    ensureForegroundService(currentVehicle);
  }
  syncTrackerStatus();
}

function updateTripSnapshot(vehicle) {
  if (!activeTrip) return;
  activeTrip.lastSoc = num(vehicle.battery_level);
  activeTrip.lastOdometer = num(vehicle.odometer);
  activeTrip.lastRangeKm = num(vehicle.range);
}

function bindVisibilityListeners() {
  if (visibilityListenersBound || typeof window === "undefined") return;
  visibilityListenersBound = true;

  const handleAppVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    tick();
  };

  window.addEventListener("focus", handleAppVisible);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleAppVisible);
  }
}

function tick() {
  const tracker = batteryHealthStore.get();
  const config = getTrackerConfig();
  const vehicle = vehicleStore.get();
  const driving = isDriving(vehicle);
  const soc = num(vehicle.battery_level);
  const odometer = num(vehicle.odometer);
  const rangeKm = num(vehicle.range);

  if (needsResumePrompt && activeTrip) {
    syncTrackerStatus();
    return;
  }

  if (!tracker.autoRecordEnabled && !activeTrip?.manualStarted) {
    clearTripState();
    syncTrackerStatus();
    return;
  }

  if (!activeTrip) {
    if (driving && soc !== null && (odometer !== null || rangeKm !== null)) {
      beginTrip(vehicle, { manualStarted: false });
      ensureForegroundService(vehicle);
    } else {
      syncTrackerStatus();
    }
    return;
  }

  lastHeartbeat = Date.now();
  updateTripSnapshot(vehicle);

  if (driving) {
    if (activeTrip.pauseStartedAt) {
      activeTrip.totalPausedMs = (activeTrip.totalPausedMs ?? 0) + Math.max(0, Date.now() - activeTrip.pauseStartedAt);
      activeTrip.pauseStartedAt = null;
    }
    idleSince = null;
    pausedSince = null;
    countdownEndsAt = null;
    pauseMode = null;
    tripState = "driving";
    ensureForegroundService(vehicle);
    saveActiveTripToStorage();
    syncTrackerStatus();
    return;
  }

  if (pausedSince === null) {
    pausedSince = Date.now();
    idleSince = pausedSince;
  }
  if (!activeTrip.pauseStartedAt) {
    activeTrip.pauseStartedAt = pausedSince;
  }

  if (pauseMode === "manual") {
    tripState = "paused";
    ensureForegroundService(vehicle);
    saveActiveTripToStorage();
    syncTrackerStatus();
    return;
  }

  const pausedMs = Date.now() - pausedSince;
  if (pausedMs < config.idleTimeoutMs) {
    tripState = "paused";
    countdownEndsAt = null;
  } else {
    tripState = "countdown";
    if (!countdownEndsAt) {
      countdownEndsAt = pausedSince + config.idleTimeoutMs + config.countdownDurationMs;
    }
    if (Date.now() >= countdownEndsAt) {
      finalizeTrip({ save: true, forceSave: false, startNew: false });
      return;
    }
  }

  ensureForegroundService(vehicle);
  saveActiveTripToStorage();
  syncTrackerStatus();
}

export function startTripManually() {
  const vehicle = vehicleStore.get();
  if (!activeTrip) {
    const started = beginTrip(vehicle, { manualStarted: true });
    if (started) ensureForegroundService(vehicle);
    return started;
  }
  needsResumePrompt = false;
  restoreAgeMs = null;
  restoredFromStorage = false;
  if (isDriving(vehicle)) {
    if (activeTrip.pauseStartedAt) {
      activeTrip.totalPausedMs = (activeTrip.totalPausedMs ?? 0) + Math.max(0, Date.now() - activeTrip.pauseStartedAt);
      activeTrip.pauseStartedAt = null;
    }
    tripState = "driving";
    pauseMode = null;
    pausedSince = null;
    idleSince = null;
    countdownEndsAt = null;
  } else {
    tripState = "paused";
    pauseMode = "manual";
    pausedSince = Date.now();
    idleSince = pausedSince;
    activeTrip.pauseStartedAt = activeTrip.pauseStartedAt ?? pausedSince;
  }
  lastHeartbeat = Date.now();
  activeTrip.manualStarted = true;
  ensureForegroundService(vehicle);
  saveActiveTripToStorage();
  syncTrackerStatus();
  return true;
}

export function resumeTripManually() {
  if (!activeTrip) return startTripManually();
  const vehicle = vehicleStore.get();
  needsResumePrompt = false;
  restoreAgeMs = null;
  activeTrip.manualStarted = true;
  if (activeTrip.pauseStartedAt && isDriving(vehicle)) {
    activeTrip.totalPausedMs = (activeTrip.totalPausedMs ?? 0) + Math.max(0, Date.now() - activeTrip.pauseStartedAt);
    activeTrip.pauseStartedAt = null;
  }
  pauseMode = null;
  pausedSince = isDriving(vehicle) ? null : Date.now();
  idleSince = pausedSince;
  countdownEndsAt = null;
  tripState = isDriving(vehicle) ? "driving" : "paused";
  lastHeartbeat = Date.now();
  ensureForegroundService(vehicle);
  saveActiveTripToStorage();
  syncTrackerStatus();
  return true;
}

export function pauseTripManually() {
  if (!activeTrip) return false;
  activeTrip.manualStarted = true;
  tripState = "paused";
  pauseMode = "manual";
  pausedSince = pausedSince ?? Date.now();
  idleSince = idleSince ?? pausedSince;
  activeTrip.pauseStartedAt = activeTrip.pauseStartedAt ?? Date.now();
  countdownEndsAt = null;
  lastHeartbeat = Date.now();
  saveActiveTripToStorage();
  syncTrackerStatus();
  return true;
}

export function extendTripCountdown(extraMs = getTrackerConfig().countdownDurationMs) {
  if (!activeTrip) return false;
  const extension = Math.max(60_000, num(extraMs) ?? getTrackerConfig().countdownDurationMs);
  const base = Math.max(countdownEndsAt ?? 0, Date.now());
  countdownEndsAt = base + extension;
  tripState = "countdown";
  pauseMode = null;
  pausedSince = pausedSince ?? Date.now();
  idleSince = idleSince ?? pausedSince;
  activeTrip.pauseStartedAt = activeTrip.pauseStartedAt ?? pausedSince;
  lastHeartbeat = Date.now();
  saveActiveTripToStorage();
  syncTrackerStatus();
  return true;
}

export function stopTripNow() {
  finalizeTrip({ save: true, forceSave: true, startNew: false });
}

export function saveAndStartNewTrip() {
  finalizeTrip({ save: true, forceSave: true, startNew: true });
}

export function discardActiveTrip() {
  clearTripState();
  syncTrackerStatus();
}

export function startBatteryTracker() {
  if (typeof window === "undefined") return;
  loadActiveTripFromStorage();
  if (trackerTimer) {
    syncTrackerStatus();
    return;
  }
  bindVisibilityListeners();
  trackerTimer = window.setInterval(tick, TICK_MS);
  syncTrackerStatus();
  tick();
}

export function stopBatteryTracker() {
  if (trackerTimer) {
    window.clearInterval(trackerTimer);
    trackerTimer = null;
  }
  saveActiveTripToStorage();
  stopForegroundService();
  syncTrackerStatus();
}