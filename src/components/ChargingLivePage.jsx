import React, { useCallback, useRef, useState, useEffect } from "react";
import { useStore } from "@nanostores/react";
import { useTranslation } from "react-i18next";
import { vehicleStore } from "../stores/vehicleStore";
import { mqttStore } from "../stores/mqttStore";
import {
  chargingLiveStore,
  setSampleRate,
  saveSession,
  getCellVoltageDeltaHealth,
  getCellTempDeltaHealth,
  getSohHealth,
  getSessionHealthScore,
} from "../stores/chargingLiveStore";
import {
  exportSessionAsCSV,
  exportSessionAsJSON,
  exportAllSessionsAsJSON,
  importSessionsFromFile,
  getLogFolderPath,
} from "../utils/chargingLogExport";

// --- Reusable small components ---

const HEALTH_COLORS = {
  excellent: { text: "text-green-600", bg: "bg-green-50", bar: "bg-green-400", border: "border-green-200" },
  good: { text: "text-blue-600", bg: "bg-blue-50", bar: "bg-blue-400", border: "border-blue-200" },
  watch: { text: "text-yellow-600", bg: "bg-yellow-50", bar: "bg-yellow-400", border: "border-yellow-200" },
  concern: { text: "text-orange-600", bg: "bg-orange-50", bar: "bg-orange-400", border: "border-orange-200" },
  critical: { text: "text-red-600", bg: "bg-red-50", bar: "bg-red-500", border: "border-red-200" },
  unknown: { text: "text-gray-400", bg: "bg-gray-50", bar: "bg-gray-300", border: "border-gray-200" },
};

function HealthPill({ level, children }) {
  const c = HEALTH_COLORS[level] ?? HEALTH_COLORS.unknown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${c.text} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.bar}`} />
      {children}
    </span>
  );
}

function BigMetric({ value, unit, label, sub, color = "text-gray-900" }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-baseline gap-1">
        <span className={`text-4xl font-black tracking-tighter leading-none ${color}`}>
          {value ?? <span className="text-gray-200">--</span>}
        </span>
        {unit && <span className="text-base text-gray-400 font-medium">{unit}</span>}
      </div>
      {label && <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{label}</span>}
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

function InfoRow({ label, value, unit, valueClass = "text-gray-800" }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${valueClass}`}>
        {value ?? "--"}{unit && <span className="font-normal text-gray-400 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

function SectionCard({ title, icon, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${className}`}>
      {title && (
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
          {icon}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function formatElapsed(startTime) {
  if (!startTime) return "--";
  const sec = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(mins) {
  if (mins === null || mins === undefined || !Number.isFinite(Number(mins))) return "--";
  const h = Math.floor(Number(mins) / 60);
  const m = Number(mins) % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// --- SVG Sparkline ---
function Sparkline({ data, color = "#2563eb", height = 40, strokeWidth = 1.5 }) {
  if (!data || data.length < 2) {
    return <div style={{ height }} className="flex items-center justify-center text-[10px] text-gray-300">No data</div>;
  }
  const filtered = data.filter((v) => v !== null && Number.isFinite(v));
  if (filtered.length < 2) return null;

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const range = max - min || 1;
  const w = 300;
  const h = height;
  const pad = 4;

  const points = filtered.map((v, i) => {
    const x = pad + ((i / (filtered.length - 1)) * (w - pad * 2));
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <polyline fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// --- SOC Arc (mobile, larger) ---
function SocArcLarge({ soc, target }) {
  const pct = Number.isFinite(Number(soc)) ? Math.max(0, Math.min(100, Number(soc))) : 0;
  const targetPct = Number.isFinite(Number(target)) ? Math.max(0, Math.min(100, Number(target))) : 0;
  const r = 56;
  const size = 136;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeColor = pct > 20 ? "#2563eb" : "#ef4444";

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} stroke="#f3f4f6" strokeWidth="10" fill="none" />
        {targetPct > 0 && (
          <circle cx={cx} cy={cy} r={r} stroke="#dbeafe" strokeWidth="10" fill="none"
            strokeDasharray={`${(targetPct / 100) * circumference} ${circumference}`}
            strokeLinecap="round" />
        )}
        {pct > 0 && (
          <circle cx={cx} cy={cy} r={r} stroke={strokeColor} strokeWidth="10" fill="none"
            strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-gray-900 leading-none">
          {Number.isFinite(pct) ? Math.round(pct) : "--"}
          <span className="text-sm text-gray-400">%</span>
        </span>
        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">SOC</span>
      </div>
    </div>
  );
}

// --- Sample rate selector ---
const SAMPLE_RATES = [
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
  { label: "2m", value: 120000 },
];

export default function ChargingLivePage() {
  const v = useStore(vehicleStore);
  const live = useStore(chargingLiveStore);
  const mqtt = useStore(mqttStore);
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null); // { imported, skipped, error }
  const [savedToast, setSavedToast] = useState(null); // { path: string } | null
  const [folderPath, setFolderPath] = useState(null);
  const savedToastTimer = useRef(null);

  // Resolve folder path once on mount (Tauri only)
  useEffect(() => {
    getLogFolderPath().then((p) => p && setFolderPath(p));
  }, []);

  function showSavedToast(path) {
    clearTimeout(savedToastTimer.current);
    setSavedToast({ path: path ?? folderPath ?? "Downloaded" });
    savedToastTimer.current = setTimeout(() => setSavedToast(null), 4000);
  }

  async function handleExportCSV(s) {
    const path = await exportSessionAsCSV(s);
    showSavedToast(path);
  }

  async function handleExportJSON(s) {
    const path = await exportSessionAsJSON(s);
    showSavedToast(path);
  }

  async function handleExportAll(sessions) {
    const path = await exportAllSessionsAsJSON(sessions);
    showSavedToast(path);
  }

  const { charging_status, battery_level, range, remaining_charging_time, target_soc } = v;
  const isCharging = charging_status === 1 || charging_status === true || Number(charging_status) === 2;

  const power = v.charging_power_kw;
  const voltage = v.charging_voltage_v;
  const current = v.charging_current_a;
  const packTemp = v.bms_pack_temp;
  const cellTMin = v.bms_cell_temp_min;
  const cellTMax = v.bms_cell_temp_max;

  const toMv = (raw) => {
    if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return null;
    const n = Number(raw);
    return n < 10 ? Math.round(n * 1000) : Math.round(n);
  };

  const cellVMin = toMv(v.bms_cell_voltage_min_mv);
  const cellVMax = toMv(v.bms_cell_voltage_max_mv);
  const cellVDelta = cellVMin !== null && cellVMax !== null ? cellVMax - cellVMin : null;
  const cellTDelta = cellTMin !== null && cellTMax !== null && Number.isFinite(Number(cellTMin)) && Number.isFinite(Number(cellTMax))
    ? +(Number(cellTMax) - Number(cellTMin)).toFixed(1) : null;

  const vHealth = getCellVoltageDeltaHealth(cellVDelta);
  const tHealth = getCellTempDeltaHealth(cellTDelta);
  const sohHealth = getSohHealth(v.soh_percentage !== null ? Number(v.soh_percentage) : null);
  const score = getSessionHealthScore(cellVDelta, cellTDelta, v.soh_percentage !== null ? Number(v.soh_percentage) : null);

  const connectorType = Number(v.dc_charging_gun) === 1 ? "DC" : Number(v.ac_charging_gun) === 1 ? "AC" : null;
  const session = live.currentSession;

  // MQTT status chip
  const mqttChip = (() => {
    const age = mqtt.lastMessageTime ? Math.floor((Date.now() - mqtt.lastMessageTime) / 1000) : null;
    if (mqtt.status === "connected" && age !== null && age < 30)
      return { label: "Live", color: "text-green-600 bg-green-50", dot: "bg-green-500", pulse: true };
    if (mqtt.status === "connected" && age !== null)
      return { label: age < 3600 ? `${Math.floor(age / 60)}m ago` : "stale", color: "text-yellow-700 bg-yellow-50", dot: "bg-yellow-400", pulse: false };
    if (mqtt.status === "connecting")
      return { label: "Reconnecting…", color: "text-blue-600 bg-blue-50", dot: "bg-blue-400", pulse: true };
    return { label: "MQTT offline", color: "text-red-600 bg-red-50", dot: "bg-red-500", pulse: false };
  })();

  // Extract sparkline data from current session
  const snaps = session?.snapshots ?? [];
  const socData = snaps.map((s) => s.soc_pct);
  const powerData = snaps.map((s) => s.power_kw);
  const vDeltaData = snaps.map((s) => s.cell_voltage_delta_mv);
  const tDeltaData = snaps.map((s) => s.cell_temp_delta);

  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);
    try {
      const { imported, skipped, errors } = await importSessionsFromFile(file, live.sessions);
      for (const s of imported) saveSession(s);
      setImportStatus({ imported: imported.length, skipped, errors });
    } catch (err) {
      setImportStatus({ error: err.message });
    }
    e.target.value = "";
  }, [live.sessions]);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto scrollbar-none pb-4 relative">

      {/* ── Saved path toast ── */}
      {savedToast && (
        <div className="fixed bottom-24 left-4 right-4 z-50 flex items-start gap-2 bg-gray-900 text-white text-xs rounded-2xl px-4 py-3 shadow-xl animate-fade-in">
          <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-green-400 mb-0.5">Saved to device</div>
            <div className="text-gray-300 break-all leading-tight">{savedToast.path}</div>
          </div>
          <button onClick={() => setSavedToast(null)} className="text-gray-500 hover:text-white shrink-0 ml-1">✕</button>
        </div>
      )}

      {/* ── 1. Status Header ── */}
      <div className="flex items-center gap-2 px-1 flex-wrap">
        {isCharging ? (
          <>
            <span className="flex items-center gap-1.5 text-sm font-bold text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              Charging
            </span>
            {connectorType && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${connectorType === "DC" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                {connectorType}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm font-bold text-gray-400">Not Charging</span>
        )}
        {live.isRecording && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            REC
          </span>
        )}
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${mqttChip.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${mqttChip.dot}${mqttChip.pulse ? " animate-pulse" : ""}`} />
          {mqttChip.label}
        </span>
        <span className={`ml-auto text-lg font-black ${score.color}`}>
          {score.grade} <span className="text-xs font-normal text-gray-400">health</span>
        </span>
      </div>

      {/* ── 2. SOC Section ── */}
      <SectionCard>
        <div className="flex items-center gap-4">
          <SocArcLarge soc={battery_level} target={target_soc} />
          <div className="flex flex-col gap-2 flex-1">
            <BigMetric
              value={power !== null ? Number(power).toFixed(1) : null}
              unit="kW"
              label="Power"
              color={isCharging ? "text-green-600" : "text-gray-300"}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <div className="text-sm font-bold text-gray-700">{formatTime(remaining_charging_time)}</div>
                <div className="text-[9px] text-gray-400 uppercase">Remaining</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <div className="text-sm font-bold text-gray-700">{target_soc !== null ? `${Number(target_soc)}%` : "--"}</div>
                <div className="text-[9px] text-gray-400 uppercase">Target</div>
              </div>
            </div>
            {range !== null && (
              <div className="text-xs text-gray-400 text-center">{Math.round(Number(range))} km remaining</div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── 3. Power Metrics ── */}
      <SectionCard>
        <div className="grid grid-cols-3 gap-3 text-center">
          <BigMetric value={power !== null ? Number(power).toFixed(1) : null} unit="kW" label="Power" />
          <BigMetric value={voltage !== null ? Number(voltage).toFixed(0) : null} unit="V" label="Voltage" />
          <BigMetric value={current !== null ? Number(current).toFixed(0) : null} unit="A" label="Current" />
        </div>
        {(v.bms_pack_voltage !== null || v.bms_pack_current !== null) && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {v.bms_pack_voltage !== null && (
              <InfoRow label="Pack voltage" value={Number(v.bms_pack_voltage).toFixed(1)} unit="V" />
            )}
            {v.bms_pack_current !== null && (
              <InfoRow label="Pack current" value={Number(v.bms_pack_current).toFixed(1)} unit="A" />
            )}
          </div>
        )}
      </SectionCard>

      {/* ── 4. Cell Health ── */}
      <SectionCard
        title="Cell Health"
        icon={<svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
      >
        {/* Cell Voltage */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600">Cell Voltage</span>
            <HealthPill level={vHealth}>{vHealth}</HealthPill>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Min", value: cellVMin, unit: "mV" },
              { label: "Max", value: cellVMax, unit: "mV" },
              { label: "Δ Delta", value: cellVDelta, unit: "mV", highlight: true },
            ].map(({ label, value, unit, highlight }) => {
              const c = HEALTH_COLORS[vHealth];
              return (
                <div key={label} className={`rounded-xl p-2.5 text-center ${highlight ? c.bg : "bg-gray-50"}`}>
                  <div className={`text-base font-black ${highlight ? c.text : "text-gray-800"}`}>
                    {value !== null ? value : "--"}
                  </div>
                  <div className="text-[10px] text-gray-400">{label}</div>
                  <div className="text-[9px] text-gray-300">{unit}</div>
                </div>
              );
            })}
          </div>
          {/* Cell V Delta sparkline */}
          {vDeltaData.filter((v) => v !== null).length > 2 && (
            <div className="mt-2">
              <div className="text-[10px] text-gray-400 mb-1">Voltage delta trend</div>
              <Sparkline data={vDeltaData} color={HEALTH_COLORS[vHealth].bar.replace("bg-", "#").replace("green-400", "22c55e").replace("blue-400", "60a5fa").replace("yellow-400", "facc15").replace("orange-400", "fb923c").replace("red-500", "ef4444").replace("gray-300", "d1d5db")} height={36} />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        {/* Thermal */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600">Thermal</span>
            <HealthPill level={tHealth}>{tHealth}</HealthPill>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Min", value: cellTMin !== null ? Number(cellTMin).toFixed(1) : null, unit: "°C" },
              { label: "Max", value: cellTMax !== null ? Number(cellTMax).toFixed(1) : null, unit: "°C" },
              { label: "Δ Delta", value: cellTDelta, unit: "°C", highlight: true },
            ].map(({ label, value, unit, highlight }) => {
              const c = HEALTH_COLORS[tHealth];
              return (
                <div key={label} className={`rounded-xl p-2.5 text-center ${highlight ? c.bg : "bg-gray-50"}`}>
                  <div className={`text-base font-black ${highlight ? c.text : "text-gray-800"}`}>
                    {value !== null ? value : "--"}
                  </div>
                  <div className="text-[10px] text-gray-400">{label}</div>
                  <div className="text-[9px] text-gray-300">{unit}</div>
                </div>
              );
            })}
          </div>
          {tDeltaData.filter((v) => v !== null).length > 2 && (
            <div className="mt-2">
              <div className="text-[10px] text-gray-400 mb-1">Temp delta trend</div>
              <Sparkline data={tDeltaData} color="#f97316" height={36} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 5. BMS Detail ── */}
      <SectionCard
        title="BMS Detail"
        icon={<svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>}
      >
        <InfoRow label="SOH" value={v.soh_percentage !== null ? `${Math.round(Number(v.soh_percentage))}` : null} unit="%" valueClass={HEALTH_COLORS[sohHealth].text} />
        <InfoRow label="Pack temp" value={packTemp !== null ? Number(packTemp).toFixed(1) : null} unit="°C" />
        {v.bms_coolant_inlet_temp !== null && (
          <InfoRow label="Coolant inlet" value={Number(v.bms_coolant_inlet_temp).toFixed(1)} unit="°C" />
        )}
        {v.bms_coolant_outlet_temp !== null && (
          <InfoRow label="Coolant outlet" value={Number(v.bms_coolant_outlet_temp).toFixed(1)} unit="°C" />
        )}
        <InfoRow label="Balancing" value={Number(v.bms_balance_active) === 1 ? "Active" : "Idle"}
          valueClass={Number(v.bms_balance_active) === 1 ? "text-blue-600" : "text-gray-400"} />
        <InfoRow label="Nominal capacity" value={v.battery_nominal_capacity_kwh !== null ? Number(v.battery_nominal_capacity_kwh).toFixed(1) : null} unit="kWh" />
        {session?.snapshots.at(-1)?.estimated_capacity_kwh && (
          <InfoRow label="Est. capacity (this session)" value={Number(session.snapshots.at(-1).estimated_capacity_kwh).toFixed(1)} unit="kWh" />
        )}
        {session?.snapshots.at(-1)?.capacity_retention_pct && (
          <InfoRow label="Capacity retention" value={Number(session.snapshots.at(-1).capacity_retention_pct).toFixed(1)} unit="%" />
        )}

        {/* Thermal runaway warning */}
        {Number(v.bms_thermal_runaway) === 1 && (
          <div className="flex items-center gap-2 mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 animate-pulse">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm font-bold text-red-700">⚠ Thermal Runaway Warning</span>
          </div>
        )}
      </SectionCard>

      {/* ── 6. Session Log ── */}
      <SectionCard
        title="Session Log"
        icon={<svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
      >
        {session ? (
          <>
            <InfoRow label="Status" value={live.isRecording ? "Recording" : "Stopped"} valueClass={live.isRecording ? "text-red-600" : "text-gray-500"} />
            <InfoRow label="Elapsed" value={formatElapsed(session.startTime)} />
            <InfoRow label="Snapshots" value={session.snapshots.length} />
            <InfoRow label="Initial SOC" value={session.initial_soc !== null ? `${Math.round(session.initial_soc)}%` : null} />
            <InfoRow label="Energy added" value={session.snapshots.at(-1)?.session_energy_kwh?.toFixed(2) ?? null} unit="kWh" />
            {session?.gaps?.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded-lg px-2 py-1.5">
                <svg className="w-3.5 h-3.5 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>{session.gaps.length} interruption{session.gaps.length > 1 ? "s" : ""}</span>
                {session.segmentCount > 1 && (
                  <span className="text-yellow-500">· {session.segmentCount} segments</span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-400 py-2 text-center">
            {isCharging ? "Starting session..." : "No active session"}
          </div>
        )}

        {/* Sample rate */}
        <div className="mt-3 mb-2">
          <div className="text-xs text-gray-500 mb-1.5">Sample rate</div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {SAMPLE_RATES.map((r) => (
              <button key={r.value}
                onClick={() => setSampleRate(r.value)}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-colors ${live.sampleRateMs === r.value ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export buttons */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            disabled={!session}
            onClick={() => session && handleExportCSV(session)}
            className="flex items-center justify-center gap-1.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 rounded-xl py-2.5 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            disabled={!session}
            onClick={() => session && handleExportJSON(session)}
            className="flex items-center justify-center gap-1.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded-xl py-2.5 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2h-5L12 4H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export JSON
          </button>
        </div>

        {/* Export all + Import */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            disabled={live.sessions.length === 0}
            onClick={() => handleExportAll(live.sessions)}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 rounded-xl py-2 transition-colors">
            Export All
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl py-2 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Log
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

        {/* Import status */}
        {importStatus && (
          <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${importStatus.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {importStatus.error
              ? `Import failed: ${importStatus.error}`
              : `Imported ${importStatus.imported} session(s). ${importStatus.skipped > 0 ? `${importStatus.skipped} duplicate(s) skipped.` : ""}`}
          </div>
        )}

        {/* Log folder path button */}
        {folderPath && (
          <button
            onClick={() => setSavedToast({ path: folderPath })}
            className="w-full flex items-center gap-2 mt-2 text-xs text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2 transition-colors text-left">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <span className="truncate">{folderPath}</span>
          </button>
        )}

        {/* Log count */}
        {live.sessions.length > 0 && (
          <div className="text-[10px] text-gray-400 text-center mt-2">
            {live.sessions.length} session{live.sessions.length > 1 ? "s" : ""} stored locally
          </div>
        )}
      </SectionCard>

      {/* ── 7. Sparklines ── */}
      {snaps.length >= 3 && (
        <SectionCard
          title="Session Trends"
          icon={<svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>}
        >
          <div className="flex flex-col gap-3">
            {[
              { label: "SOC (%)", data: socData, color: "#2563eb" },
              { label: "Power (kW)", data: powerData, color: "#16a34a" },
              { label: "Cell V Delta (mV)", data: vDeltaData, color: "#d97706" },
              { label: "Cell T Delta (°C)", data: tDeltaData, color: "#ea580c" },
            ].map(({ label, data, color }) => {
              const valid = data.filter((v) => v !== null);
              if (valid.length < 2) return null;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-gray-500">{label}</span>
                    <span className="text-[10px] font-bold text-gray-700">{valid.at(-1)?.toFixed(1)}</span>
                  </div>
                  <Sparkline data={data} color={color} height={32} />
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
