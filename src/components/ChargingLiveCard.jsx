import React, { useRef } from "react";
import { useStore } from "@nanostores/react";
import { useTranslation } from "react-i18next";
import { vehicleStore } from "../stores/vehicleStore";
import {
  chargingLiveStore,
  setSampleRate,
  getCellVoltageDeltaHealth,
  getCellTempDeltaHealth,
  getSohHealth,
  getSessionHealthScore,
} from "../stores/chargingLiveStore";
import { exportSessionAsCSV as dlCSV, exportSessionAsJSON as dlJSON } from "../utils/chargingLogExport";

const HEALTH_COLORS = {
  excellent: { text: "text-green-600", bg: "bg-green-50", dot: "bg-green-400" },
  good: { text: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-400" },
  watch: { text: "text-yellow-600", bg: "bg-yellow-50", dot: "bg-yellow-400" },
  concern: { text: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-400" },
  critical: { text: "text-red-600", bg: "bg-red-50", dot: "bg-red-500" },
  unknown: { text: "text-gray-400", bg: "bg-gray-50", dot: "bg-gray-300" },
};

function HealthDot({ level }) {
  const c = HEALTH_COLORS[level] ?? HEALTH_COLORS.unknown;
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${c.dot}`} />;
}

function HealthBadge({ level, label }) {
  const c = HEALTH_COLORS[level] ?? HEALTH_COLORS.unknown;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${c.text} ${c.bg}`}>
      <HealthDot level={level} />
      {label}
    </span>
  );
}

function MetricRow({ label, value, unit, sub }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide shrink-0">{label}</span>
      <div className="text-right">
        <span className="text-sm font-bold text-gray-800">
          {value ?? <span className="text-gray-300">--</span>}
        </span>
        {unit && <span className="text-[10px] text-gray-400 ml-0.5">{unit}</span>}
        {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

function SocArc({ soc, target }) {
  const pct = Number.isFinite(Number(soc)) ? Math.max(0, Math.min(100, Number(soc))) : 0;
  const targetPct = Number.isFinite(Number(target)) ? Math.max(0, Math.min(100, Number(target))) : 0;
  const r = 36;
  const cx = 44, cy = 44;
  const circumference = 2 * Math.PI * r;
  const strokeDash = (pct / 100) * circumference;
  const targetDash = (targetPct / 100) * circumference;
  const strokeColor = pct > 20 ? "#2563eb" : "#ef4444";

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        {/* Background */}
        <circle cx={cx} cy={cy} r={r} stroke="#f3f4f6" strokeWidth="7" fill="none" />
        {/* Target arc (faint) */}
        {targetPct > 0 && (
          <circle cx={cx} cy={cy} r={r} stroke="#dbeafe" strokeWidth="7" fill="none"
            strokeDasharray={`${targetDash} ${circumference - targetDash}`}
            strokeLinecap="round" />
        )}
        {/* SOC arc */}
        {pct > 0 && (
          <circle cx={cx} cy={cy} r={r} stroke={strokeColor} strokeWidth="7" fill="none"
            strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-gray-900 leading-none">
          {Number.isFinite(pct) ? `${Math.round(pct)}` : "--"}
          <span className="text-xs text-gray-400 font-bold">%</span>
        </span>
        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">SOC</span>
      </div>
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
  return `${m}m ${s}s`;
}

function formatTime(mins) {
  if (!mins || !Number.isFinite(Number(mins))) return "--";
  const h = Math.floor(Number(mins) / 60);
  const m = Number(mins) % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function RecordingBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
      REC
    </span>
  );
}

const SAMPLE_RATES = [
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
];

export default function ChargingLiveCard() {
  const v = useStore(vehicleStore);
  const live = useStore(chargingLiveStore);

  const { charging_status, battery_level, range, remaining_charging_time, target_soc } = v;
  const isCharging = charging_status === 1 || charging_status === true || Number(charging_status) === 2;

  const power = v.charging_power_kw;
  const voltage = v.charging_voltage_v;
  const current = v.charging_current_a;
  const packTemp = v.bms_pack_temp;
  const cellTMin = v.bms_cell_temp_min;
  const cellTMax = v.bms_cell_temp_max;
  const cellVMin = v.bms_cell_voltage_min_mv;
  const cellVMax = v.bms_cell_voltage_max_mv;
  const soh = v.soh_percentage;
  const nominal = v.battery_nominal_capacity_kwh;

  const toMv = (raw) => {
    if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return null;
    const n = Number(raw);
    return n < 10 ? Math.round(n * 1000) : Math.round(n);
  };

  const cellVMinMv = toMv(cellVMin);
  const cellVMaxMv = toMv(cellVMax);
  const cellVDelta = cellVMinMv !== null && cellVMaxMv !== null ? cellVMaxMv - cellVMinMv : null;
  const cellTDelta = cellTMin !== null && cellTMax !== null && Number.isFinite(Number(cellTMin)) && Number.isFinite(Number(cellTMax))
    ? +(Number(cellTMax) - Number(cellTMin)).toFixed(1) : null;

  const vHealth = getCellVoltageDeltaHealth(cellVDelta);
  const tHealth = getCellTempDeltaHealth(cellTDelta);
  const sohHealth = getSohHealth(soh !== null ? Number(soh) : null);

  const connectorType = Number(v.dc_charging_gun) === 1 ? "DC" : Number(v.ac_charging_gun) === 1 ? "AC" : null;

  const session = live.currentSession;
  const score = getSessionHealthScore(cellVDelta, cellTDelta, soh !== null ? Number(soh) : null);

  // Not charging: compact chip
  if (!isCharging) {
    return (
      <div className="rounded-2xl bg-white p-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs text-gray-400 font-medium">Charging Live</span>
          <span className="ml-auto text-xs font-bold text-gray-500">{battery_level !== null ? `${Math.round(Number(battery_level))}%` : "--"}</span>
          <span className="text-[10px] text-gray-400">Not charging</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm border border-gray-100 flex flex-col gap-2.5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-xs font-bold text-gray-800">Charging Live</span>
        {connectorType && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${connectorType === "DC" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
            {connectorType}
          </span>
        )}
        {live.isRecording && <RecordingBadge />}
        <span className={`ml-auto text-sm font-black ${score.color}`}>{score.grade}</span>
      </div>

      {/* SOC + Power strip */}
      <div className="flex items-center gap-3">
        <SocArc soc={battery_level} target={target_soc} />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-gray-900 leading-none">
              {power !== null ? Number(power).toFixed(1) : "--"}
            </span>
            <span className="text-xs text-gray-400">kW</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <MetricRow label="V" value={voltage !== null ? Number(voltage).toFixed(0) : null} unit="V" />
            <MetricRow label="A" value={current !== null ? Number(current).toFixed(0) : null} unit="A" />
          </div>
          {range !== null && (
            <div className="text-[10px] text-gray-400">{Math.round(Number(range))} km remaining</div>
          )}
        </div>
      </div>

      {/* Time row */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-gray-50 rounded-xl p-2">
          <div className="text-xs font-bold text-gray-700">{formatTime(remaining_charging_time)}</div>
          <div className="text-[9px] text-gray-400 uppercase tracking-wide">Remaining</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <div className="text-xs font-bold text-gray-700">{target_soc !== null ? `${Number(target_soc)}%` : "--"}</div>
          <div className="text-[9px] text-gray-400 uppercase tracking-wide">Target</div>
        </div>
      </div>

      {/* Cell Voltage */}
      <div className="bg-gray-50 rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Cell Voltage</span>
          <HealthBadge level={vHealth} label={vHealth} />
        </div>
        <div className="grid grid-cols-3 gap-1 text-center">
          {[
            { label: "Min", val: cellVMinMv, unit: "mV" },
            { label: "Max", val: cellVMaxMv, unit: "mV" },
            { label: "Δ", val: cellVDelta, unit: "mV", highlight: true },
          ].map(({ label, val, unit, highlight }) => (
            <div key={label} className={`rounded-lg p-1.5 ${highlight ? HEALTH_COLORS[vHealth].bg : "bg-white"}`}>
              <div className={`text-xs font-bold ${highlight ? HEALTH_COLORS[vHealth].text : "text-gray-700"}`}>
                {val !== null ? val : "--"}<span className="text-[9px] ml-0.5 font-normal">{unit}</span>
              </div>
              <div className="text-[9px] text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Thermal */}
      <div className="bg-gray-50 rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Thermal</span>
          <HealthBadge level={tHealth} label={tHealth} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <MetricRow label="Pack" value={packTemp !== null ? Number(packTemp).toFixed(1) : null} unit="°C" />
          <MetricRow label="ΔT" value={cellTDelta !== null ? `${cellTDelta}` : null} unit="°C" />
          <MetricRow label="Min cell" value={cellTMin !== null ? Number(cellTMin).toFixed(1) : null} unit="°C" />
          <MetricRow label="Max cell" value={cellTMax !== null ? Number(cellTMax).toFixed(1) : null} unit="°C" />
          {v.bms_coolant_inlet_temp !== null && (
            <MetricRow label="Coolant in" value={Number(v.bms_coolant_inlet_temp).toFixed(1)} unit="°C" />
          )}
          {v.bms_coolant_outlet_temp !== null && (
            <MetricRow label="Coolant out" value={Number(v.bms_coolant_outlet_temp).toFixed(1)} unit="°C" />
          )}
        </div>
      </div>

      {/* Battery Health */}
      <div className="bg-gray-50 rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Battery Health</span>
          <HealthBadge level={sohHealth} label={`SOH ${soh !== null ? `${Math.round(Number(soh))}%` : "--"}`} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <MetricRow label="Nominal cap" value={nominal !== null ? Number(nominal).toFixed(1) : null} unit="kWh" />
          {session?.estimated_capacity_kwh && (
            <MetricRow label="Est. cap" value={Number(session.snapshots.at(-1)?.estimated_capacity_kwh ?? 0).toFixed(1)} unit="kWh" />
          )}
          {session?.snapshots.at(-1)?.capacity_retention_pct && (
            <MetricRow label="Retention" value={session.snapshots.at(-1).capacity_retention_pct.toFixed(1)} unit="%" />
          )}
          <div className="col-span-2 flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-400">Balancing</span>
            <span className={`text-[10px] font-bold ${v.bms_balance_active === 1 ? "text-blue-600" : "text-gray-400"}`}>
              {v.bms_balance_active === 1 ? "Active" : "Idle"}
            </span>
          </div>
        </div>
      </div>

      {/* Session stats */}
      {session && (
        <div className="bg-gray-50 rounded-xl p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Session Log</span>
            {live.isRecording && <RecordingBadge />}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <MetricRow label="Elapsed" value={formatElapsed(session.startTime)} />
            <MetricRow label="Snapshots" value={session.snapshots.length} />
            <MetricRow label="Energy added" value={session.snapshots.at(-1)?.session_energy_kwh?.toFixed(2) ?? "--"} unit="kWh" />
            <MetricRow label="Initial SOC" value={session.initial_soc !== null ? `${Math.round(session.initial_soc)}%` : "--"} />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Sample rate */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {SAMPLE_RATES.map((r) => (
            <button key={r.value}
              onClick={() => setSampleRate(r.value)}
              className={`text-[9px] font-bold px-1.5 py-1 rounded-md transition-colors ${live.sampleRateMs === r.value ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {r.label}
            </button>
          ))}
        </div>
        {session && (
          <>
            <button onClick={() => dlCSV(session)}
              className="flex-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg px-2 py-1.5 transition-colors">
              CSV
            </button>
            <button onClick={() => dlJSON(session)}
              className="flex-1 text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1.5 transition-colors">
              JSON
            </button>
          </>
        )}
      </div>

      {/* Thermal runaway critical warning */}
      {Number(v.bms_thermal_runaway) === 1 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 animate-pulse">
          <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-xs font-bold text-red-700">⚠ Thermal Runaway Warning</span>
        </div>
      )}
    </div>
  );
}
