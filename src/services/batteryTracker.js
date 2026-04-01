import { batteryHealthStore, addRangeDiaryEntry, addSocDropAnomaly, classifyWeatherCondition, getActiveVehicleModel } from "../stores/batteryHealthStore";
import { vehicleStore } from "../stores/vehicleStore";

const isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

let trackerTimer = null;
let activeTrip = null;
let idleSince = null;
let serviceStarted = false;

function num(value) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function getOutsideTemp(state) {
  return num(state.outside_temp) ?? num(state.weather_outside_temp);
}

function isDriving(state) {
  const speed = num(state.speed) ?? 0;
  const ignition = state.ignition_status;
  return speed > 0 || ignition === 1 || ignition === true || ignition === "ON";
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

function buildTripEntry(start, endState) {
  const state = batteryHealthStore.get();
  const model = getActiveVehicleModel(state);
  const socEnd = num(endState.battery_level);
  const odoEnd = num(endState.odometer);
  if (socEnd === null || odoEnd === null) return null;
  const distanceKm = +(odoEnd - start.odometerStart).toFixed(1);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  const deltaSoc = Math.max(0, start.socStart - socEnd);
  const estimatedKwhUsed = +((deltaSoc * model.nominalCapacityKwh) / 100).toFixed(2);
  const kwhPer100km = distanceKm > 0 ? +((estimatedKwhUsed / distanceKm) * 100).toFixed(1) : 0;
  const durationMinutes = Math.max(1, Math.round((Date.now() - start.timestamp) / 60000));
  const outsideTempC = getOutsideTemp(endState);
  return {
    id: `${start.timestamp}`,
    type: "auto",
    timestamp: start.timestamp,
    socStart: start.socStart,
    socEnd,
    odometerStart: start.odometerStart,
    odometerEnd: odoEnd,
    distanceKm,
    estimatedKwhUsed,
    kwhPer100km,
    durationMinutes,
    avgSpeedKmh: durationMinutes > 0 ? +((distanceKm / durationMinutes) * 60).toFixed(1) : null,
    outsideTempC,
    weatherCondition: classifyWeatherCondition(outsideTempC, num(endState.weather_code)),
    acClimateActive: (num(endState.fan_speed) ?? 0) > 0,
    rangeEstimateStart: start.rangeStart,
    rangeEstimateEnd: num(endState.range),
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

function tick() {
  const tracker = batteryHealthStore.get();
  const vehicle = vehicleStore.get();

  if (!tracker.autoRecordEnabled) {
    activeTrip = null;
    idleSince = null;
    return;
  }

  const driving = isDriving(vehicle);
  const soc = num(vehicle.battery_level);
  const odometer = num(vehicle.odometer);

  if (driving && soc !== null && odometer !== null) {
    idleSince = null;
    if (!activeTrip) {
      activeTrip = {
        timestamp: Date.now(),
        socStart: soc,
        odometerStart: odometer,
        rangeStart: num(vehicle.range),
      };
    }
    if (isTauri && !serviceStarted) {
      serviceStarted = true;
      invokeForeground("plugin:foreground-service|startBatteryTracker", {
        title: "VFDashboard",
        content: "Đang theo dõi sức khỏe pin…",
      });
    }
    if (isTauri && serviceStarted) {
      invokeForeground("plugin:foreground-service|updateBatteryTrackerNotification", {
        soc: soc !== null ? Math.round(soc) : -1,
        temp: getOutsideTemp(vehicle) ?? -1,
        rangeKm: num(vehicle.range) ?? -1,
      });
    }
    return;
  }

  if (activeTrip && idleSince === null) {
    idleSince = Date.now();
    return;
  }

  if (activeTrip && idleSince !== null && Date.now() - idleSince >= 120000) {
    const entry = buildTripEntry(activeTrip, vehicle);
    if (entry && shouldPersistTrip(entry)) {
      addRangeDiaryEntry(entry);
      maybePersistAnomaly(entry);
    }
    activeTrip = null;
    idleSince = null;
    if (isTauri && serviceStarted) {
      serviceStarted = false;
      invokeForeground("plugin:foreground-service|stopBatteryTracker");
    }
  }
}

export function startBatteryTracker() {
  if (trackerTimer || typeof window === "undefined") return;
  trackerTimer = window.setInterval(tick, 60000);
  tick();
}

export function stopBatteryTracker() {
  if (trackerTimer) {
    window.clearInterval(trackerTimer);
    trackerTimer = null;
  }
  activeTrip = null;
  idleSince = null;
  if (isTauri && serviceStarted) {
    serviceStarted = false;
    invokeForeground("plugin:foreground-service|stopBatteryTracker");
  }
}