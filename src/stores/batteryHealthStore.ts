import { map } from "nanostores";

export interface VehicleModelProfile {
  id: string;
  name: string;
  nominalCapacityKwh: number;
  acChargerEfficiency: number;
  expectedKwhPer100km: number;
  maxDcPowerKw: number;
  batteryChemistry: string;
  anomalyThresholdMultiplier: number;
  isBuiltIn?: boolean;
}

export interface CapacityEstimate {
  id: string;
  date: number;
  socStart: number;
  socEnd: number;
  deltaSoc: number;
  gridEnergyKwh: number | null;
  packEnergyKwh: number;
  estimatedPackKwh: number;
  estimatedSoh: number;
  chargeType: "AC" | "DC" | "unknown";
  sourceLogId?: string;
  sourceHistoryId?: string;
}

export interface SocDropAnomaly {
  id: string;
  timestamp: number;
  socStart: number;
  socEnd: number;
  distanceKm: number;
  durationMinutes: number;
  actualKwhPer100km: number;
  expectedKwhPer100km: number;
  severityMultiplier: number;
  odometerStart: number;
  odometerEnd: number;
  outsideTempC?: number | null;
  weatherCondition?: string;
  weatherRelated?: boolean;
}

export interface DcPeakRecord {
  id: string;
  date: number;
  peakPowerKw: number;
  cRate: number;
  socAtPeak: number | null;
  sourceLogId?: string;
}

export interface RangeDiaryEntry {
  id: string;
  type: "auto" | "manual";
  timestamp: number;
  socStart: number;
  socEnd: number;
  odometerStart: number;
  odometerEnd: number;
  distanceKm: number;
  estimatedKwhUsed: number;
  kwhPer100km: number;
  durationMinutes: number;
  avgSpeedKmh: number | null;
  outsideTempC?: number | null;
  weatherCondition?: string;
  acClimateActive?: boolean;
  rangeEstimateStart?: number | null;
  rangeEstimateEnd?: number | null;
  distanceSource?: "odometer" | "range_estimate";
  note?: string;
}

export interface TrackerConfig {
  idleTimeoutMs: number;
  countdownDurationMs: number;
  maxResumeGapMs: number;
}

interface BatteryHealthState {
  vehicleModels: VehicleModelProfile[];
  activeModelId: string;
  capacityEstimates: CapacityEstimate[];
  socDropAnomalies: SocDropAnomaly[];
  dcPeakPowerHistory: DcPeakRecord[];
  rangeDiary: RangeDiaryEntry[];
  autoRecordEnabled: boolean;
  trackerConfig: TrackerConfig;
}

const STORAGE_KEY = "vf_battery_health_v1";

const VF5_MODEL: VehicleModelProfile = {
  id: "vf5_lfp",
  name: "VinFast VF5",
  nominalCapacityKwh: 37.23,
  acChargerEfficiency: 0.88,
  expectedKwhPer100km: 12,
  maxDcPowerKw: 55,
  batteryChemistry: "LFP",
  anomalyThresholdMultiplier: 1.4,
  isBuiltIn: true,
};

const MAX_CAPACITY_ESTIMATES = 200;
const MAX_ANOMALIES = 100;
const MAX_DC_PEAKS = 120;
const MAX_RANGE_DIARY = 300;

const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  idleTimeoutMs: 5 * 60 * 1000,
  countdownDurationMs: 5 * 60 * 1000,
  maxResumeGapMs: 30 * 60 * 1000,
};

function defaultState(): BatteryHealthState {
  return {
    vehicleModels: [VF5_MODEL],
    activeModelId: VF5_MODEL.id,
    capacityEstimates: [],
    socDropAnomalies: [],
    dcPeakPowerHistory: [],
    rangeDiary: [],
    autoRecordEnabled: true,
    trackerConfig: DEFAULT_TRACKER_CONFIG,
  };
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeModel(raw: any): VehicleModelProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  const name = typeof raw.name === "string" && raw.name ? raw.name : null;
  const nominalCapacityKwh = safeNumber(raw.nominalCapacityKwh);
  const acChargerEfficiency = safeNumber(raw.acChargerEfficiency);
  const expectedKwhPer100km = safeNumber(raw.expectedKwhPer100km);
  const maxDcPowerKw = safeNumber(raw.maxDcPowerKw);
  const anomalyThresholdMultiplier = safeNumber(raw.anomalyThresholdMultiplier);
  if (
    !id ||
    !name ||
    nominalCapacityKwh === null ||
    acChargerEfficiency === null ||
    expectedKwhPer100km === null ||
    maxDcPowerKw === null ||
    anomalyThresholdMultiplier === null
  ) {
    return null;
  }
  return {
    id,
    name,
    nominalCapacityKwh,
    acChargerEfficiency,
    expectedKwhPer100km,
    maxDcPowerKw,
    batteryChemistry: typeof raw.batteryChemistry === "string" && raw.batteryChemistry ? raw.batteryChemistry : "Unknown",
    anomalyThresholdMultiplier,
    isBuiltIn: Boolean(raw.isBuiltIn),
  };
}

function normalizeList<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeTrackerConfig(raw: any): TrackerConfig {
  const idleTimeoutMs = safeNumber(raw?.idleTimeoutMs);
  const countdownDurationMs = safeNumber(raw?.countdownDurationMs);
  const maxResumeGapMs = safeNumber(raw?.maxResumeGapMs);
  return {
    idleTimeoutMs: idleTimeoutMs !== null && idleTimeoutMs >= 60_000 ? idleTimeoutMs : DEFAULT_TRACKER_CONFIG.idleTimeoutMs,
    countdownDurationMs: countdownDurationMs !== null && countdownDurationMs >= 60_000 ? countdownDurationMs : DEFAULT_TRACKER_CONFIG.countdownDurationMs,
    maxResumeGapMs: maxResumeGapMs !== null && maxResumeGapMs >= 5 * 60_000 ? maxResumeGapMs : DEFAULT_TRACKER_CONFIG.maxResumeGapMs,
  };
}

function loadState(): BatteryHealthState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const models = normalizeList<any>(parsed?.vehicleModels)
      .map(normalizeModel)
      .filter(Boolean) as VehicleModelProfile[];
    const mergedModels = [VF5_MODEL, ...models.filter((model) => model.id !== VF5_MODEL.id)];
    const activeModelId =
      typeof parsed?.activeModelId === "string" && mergedModels.some((model) => model.id === parsed.activeModelId)
        ? parsed.activeModelId
        : VF5_MODEL.id;
    return {
      vehicleModels: mergedModels,
      activeModelId,
      capacityEstimates: normalizeList<CapacityEstimate>(parsed?.capacityEstimates),
      socDropAnomalies: normalizeList<SocDropAnomaly>(parsed?.socDropAnomalies),
      dcPeakPowerHistory: normalizeList<DcPeakRecord>(parsed?.dcPeakPowerHistory),
      rangeDiary: normalizeList<RangeDiaryEntry>(parsed?.rangeDiary),
      autoRecordEnabled: parsed?.autoRecordEnabled !== false,
      trackerConfig: normalizeTrackerConfig(parsed?.trackerConfig),
    };
  } catch {
    return defaultState();
  }
}

function persistState(state: BatteryHealthState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors.
  }
}

function updateState(partial: Partial<BatteryHealthState>) {
  const next = { ...batteryHealthStore.get(), ...partial };
  persistState(next);
  batteryHealthStore.set(next);
}

export const batteryHealthStore = map<BatteryHealthState>(defaultState());

let _initialized = false;

export function initBatteryHealthStore() {
  if (_initialized) return;
  _initialized = true;
  batteryHealthStore.set(loadState());
}

export function getActiveVehicleModel(state = batteryHealthStore.get()): VehicleModelProfile {
  return state.vehicleModels.find((model) => model.id === state.activeModelId) ?? VF5_MODEL;
}

export function setActiveVehicleModel(id: string) {
  const state = batteryHealthStore.get();
  if (!state.vehicleModels.some((model) => model.id === id)) return;
  updateState({ activeModelId: id });
}

export function addVehicleModel(model: Omit<VehicleModelProfile, "id" | "isBuiltIn"> & { id?: string }) {
  const state = batteryHealthStore.get();
  const baseId = (model.id || model.name || "custom-model")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `custom-${Date.now()}`;
  let nextId = baseId;
  let suffix = 2;
  while (state.vehicleModels.some((item) => item.id === nextId)) {
    nextId = `${baseId}-${suffix++}`;
  }
  const nextModel: VehicleModelProfile = {
    ...model,
    id: nextId,
    isBuiltIn: false,
  };
  updateState({
    vehicleModels: [...state.vehicleModels, nextModel],
    activeModelId: nextModel.id,
  });
}

export function updateVehicleModel(id: string, patch: Partial<VehicleModelProfile>) {
  const state = batteryHealthStore.get();
  const vehicleModels = state.vehicleModels.map((model) => {
    if (model.id !== id) return model;
    const next = { ...model, ...patch, id: model.id, isBuiltIn: model.isBuiltIn };
    return next;
  });
  updateState({ vehicleModels });
}

export function deleteVehicleModel(id: string) {
  const state = batteryHealthStore.get();
  const target = state.vehicleModels.find((model) => model.id === id);
  if (!target || target.isBuiltIn) return;
  const vehicleModels = state.vehicleModels.filter((model) => model.id !== id);
  updateState({
    vehicleModels,
    activeModelId: state.activeModelId === id ? VF5_MODEL.id : state.activeModelId,
  });
}

export function setAutoRecordEnabled(enabled: boolean) {
  updateState({ autoRecordEnabled: enabled });
}

export function updateTrackerConfig(patch: Partial<TrackerConfig>) {
  const state = batteryHealthStore.get();
  updateState({
    trackerConfig: {
      ...state.trackerConfig,
      ...patch,
    },
  });
}

export function addCapacityEstimate(entry: CapacityEstimate) {
  const state = batteryHealthStore.get();
  updateState({
    capacityEstimates: [entry, ...state.capacityEstimates.filter((item) => item.id !== entry.id)].slice(0, MAX_CAPACITY_ESTIMATES),
  });
}

export function deleteCapacityEstimate(id: string) {
  const state = batteryHealthStore.get();
  updateState({
    capacityEstimates: state.capacityEstimates.filter((item) => item.id !== id),
  });
}

export function addSocDropAnomaly(entry: SocDropAnomaly) {
  const state = batteryHealthStore.get();
  updateState({
    socDropAnomalies: [entry, ...state.socDropAnomalies.filter((item) => item.id !== entry.id)].slice(0, MAX_ANOMALIES),
  });
}

export function addDcPeakRecord(entry: DcPeakRecord) {
  const state = batteryHealthStore.get();
  updateState({
    dcPeakPowerHistory: [entry, ...state.dcPeakPowerHistory.filter((item) => item.id !== entry.id)].slice(0, MAX_DC_PEAKS),
  });
}

export function addRangeDiaryEntry(entry: RangeDiaryEntry) {
  const state = batteryHealthStore.get();
  updateState({
    rangeDiary: [entry, ...state.rangeDiary.filter((item) => item.id !== entry.id)].slice(0, MAX_RANGE_DIARY),
  });
}

export function updateRangeDiaryEntry(id: string, patch: Partial<RangeDiaryEntry>) {
  const state = batteryHealthStore.get();
  updateState({
    rangeDiary: state.rangeDiary.map((item) => (item.id === id ? { ...item, ...patch, id: item.id, type: item.type, timestamp: item.timestamp } : item)),
  });
}

export function deleteRangeDiaryEntry(id: string) {
  const state = batteryHealthStore.get();
  updateState({ rangeDiary: state.rangeDiary.filter((item) => item.id !== id) });
}

export function getLatestSohEstimate(state = batteryHealthStore.get()): CapacityEstimate | null {
  return state.capacityEstimates[0] ?? null;
}

export function getCapacityTrend(state = batteryHealthStore.get()): CapacityEstimate[] {
  return [...state.capacityEstimates].sort((a, b) => a.date - b.date);
}

export function getDcPeakTrend(state = batteryHealthStore.get()): DcPeakRecord[] {
  return [...state.dcPeakPowerHistory].sort((a, b) => a.date - b.date);
}

export function getRangeDiarySummary(state = batteryHealthStore.get()) {
  const entries = state.rangeDiary;
  const totalKm = entries.reduce((sum, entry) => sum + entry.distanceKm, 0);
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const avgKwhPer100km =
    entries.length > 0
      ? +(entries.reduce((sum, entry) => sum + entry.kwhPer100km, 0) / entries.length).toFixed(1)
      : null;
  return {
    totalEntries: entries.length,
    totalKm: +totalKm.toFixed(1),
    totalMinutes,
    avgKwhPer100km,
  };
}

export function getStorageUsageSummary(state = batteryHealthStore.get()) {
  return {
    diaryCount: state.rangeDiary.length,
    diaryMax: MAX_RANGE_DIARY,
    estimateCount: state.capacityEstimates.length,
    estimateMax: MAX_CAPACITY_ESTIMATES,
    anomalyCount: state.socDropAnomalies.length,
    anomalyMax: MAX_ANOMALIES,
    dcPeakCount: state.dcPeakPowerHistory.length,
    dcPeakMax: MAX_DC_PEAKS,
  };
}

export function classifyWeatherCondition(outsideTempC?: number | null, weatherCode?: number | null): string {
  if (outsideTempC !== null && outsideTempC !== undefined) {
    if (outsideTempC >= 35) return "hot";
    if (outsideTempC <= 15) return "cold";
  }
  if (weatherCode === null || weatherCode === undefined) return "clear";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(Number(weatherCode))) return "rain";
  if ([1, 2, 3, 45, 48].includes(Number(weatherCode))) return "cloudy";
  return "clear";
}

export const BUILT_IN_VEHICLE_MODEL = VF5_MODEL;