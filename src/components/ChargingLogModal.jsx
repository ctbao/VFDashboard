import React from "react";
import { useStore } from "@nanostores/react";
import { chargingLiveStore, getSessionHealthScore, getCellVoltageDeltaHealth, getCellTempDeltaHealth, getSohHealth } from "../stores/chargingLiveStore";
import { exportSessionAsCSV, exportSessionAsJSON } from "../utils/chargingLogExport";

const HEALTH_COLORS = {
  excellent: { text: "text-green-600", bg: "bg-green-50", bar: "bg-green-400" },
  good: { text: "text-blue-600", bg: "bg-blue-50", bar: "bg-blue-400" },
  watch: { text: "text-yellow-600", bg: "bg-yellow-50", bar: "bg-yellow-400" },
  concern: { text: "text-orange-600", bg: "bg-orange-50", bar: "bg-orange-400" },
  critical: { text: "text-red-600", bg: "bg-red-50", bar: "bg-red-500" },
  unknown: { text: "text-gray-400", bg: "bg-gray-50", bar: "bg-gray-300" },
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

function Sparkline({ data, color = "#2563eb", height = 40 }) {
  const filtered = (data || []).filter((v) => v !== null && Number.isFinite(v));
  if (filtered.length < 2) {
    return <div style={{ height }} className="flex items-center justify-center text-[10px] text-gray-300">No data</div>;
  }
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const range = max - min || 1;
  const w = 300, h = height, pad = 4;
  const points = filtered.map((v, i) => {
    const x = pad + (i / (filtered.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function MiniStat({ label, value, unit, color = "text-gray-800" }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-lg font-black leading-none ${color}`}>
        {value ?? <span className="text-gray-300">--</span>}
      </span>
      {unit && <span className="text-[9px] text-gray-400">{unit}</span>}
      <span className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "--";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start, end) {
  if (!start) return "--";
  const ms = (end || Date.now()) - start;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ChargingLogModal({ session, onClose }) {
  if (!session) return null;

  const vHealth = getCellVoltageDeltaHealth(session.max_cell_v_delta_mv);
  const tHealth = getCellTempDeltaHealth(session.max_cell_t_delta);
  const sohHealth = getSohHealth(session.soh_at_end ?? session.soh_at_start);
  const score = getSessionHealthScore(session.max_cell_v_delta_mv, session.max_cell_t_delta, session.soh_at_end ?? session.soh_at_start);

  const snaps = session.snapshots || [];
  const socData = snaps.map((s) => s.soc_pct);
  const powerData = snaps.map((s) => s.power_kw);
  const vDeltaData = snaps.map((s) => s.cell_voltage_delta_mv);
  const tDeltaData = snaps.map((s) => s.cell_temp_delta);

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">Charging Log</h2>
              <span className={`text-sm font-black ${score.color}`}>{score.grade}</span>
              <HealthPill level={score.grade === "A" ? "excellent" : score.grade === "B" ? "good" : score.grade === "C" ? "watch" : "concern"}>
                {score.label}
              </HealthPill>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{formatDate(session.startTime)}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto scrollbar-none flex-1 px-5 py-4 flex flex-col gap-4">

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <MiniStat
              label="Energy"
              value={session.total_energy_added_kwh !== null ? Number(session.total_energy_added_kwh).toFixed(2) : null}
              unit="kWh"
              color="text-green-600"
            />
            <MiniStat
              label="Duration"
              value={formatDuration(session.startTime, session.endTime)}
              color="text-blue-600"
            />
            <MiniStat
              label="Peak"
              value={session.peak_power_kw !== null ? Number(session.peak_power_kw).toFixed(1) : null}
              unit="kW"
              color="text-purple-600"
            />
          </div>

          {/* SOC range */}
          <div className="grid grid-cols-3 gap-3 text-center bg-gray-50 rounded-2xl p-3">
            <MiniStat label="Start SOC" value={session.initial_soc !== null ? `${Math.round(session.initial_soc)}%` : null} />
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <MiniStat label="End SOC" value={session.final_soc !== null ? `${Math.round(session.final_soc)}%` : null} />
          </div>

          {/* Connector + Connector type */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
            <span>Connector:</span>
            {session.connector_type && (
              <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${session.connector_type === "DC" ? "bg-purple-100 text-purple-700" : session.connector_type === "AC" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {session.connector_type}
              </span>
            )}
            <span className="ml-auto">{snaps.length} snapshots</span>
          </div>

          {/* Cell Voltage health */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600">Cell Voltage Health</span>
              <HealthPill level={vHealth}>{`Δ max ${session.max_cell_v_delta_mv ?? "--"} mV`}</HealthPill>
            </div>
            {vDeltaData.filter((v) => v !== null).length >= 2 && (
              <Sparkline data={vDeltaData} color="#d97706" height={36} />
            )}
          </div>

          {/* Cell Temp health */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600">Thermal Health</span>
              <HealthPill level={tHealth}>{`Δ max ${session.max_cell_t_delta ?? "--"} °C`}</HealthPill>
            </div>
            {tDeltaData.filter((v) => v !== null).length >= 2 && (
              <Sparkline data={tDeltaData} color="#ea580c" height={36} />
            )}
          </div>

          {/* Battery / SOH */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600">Battery</span>
              <HealthPill level={sohHealth}>{`SOH ${session.soh_at_end ?? session.soh_at_start ?? "--"}%`}</HealthPill>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {session.nominal_capacity_kwh && (
                <div>
                  <span className="text-gray-400">Nominal cap:</span>
                  <span className="font-bold ml-1">{Number(session.nominal_capacity_kwh).toFixed(1)} kWh</span>
                </div>
              )}
              {session.estimated_capacity_kwh && (
                <div>
                  <span className="text-gray-400">Est. cap:</span>
                  <span className="font-bold ml-1">{Number(session.estimated_capacity_kwh).toFixed(1)} kWh</span>
                </div>
              )}
              {session.capacity_retention_pct && (
                <div>
                  <span className="text-gray-400">Retention:</span>
                  <span className="font-bold ml-1">{Number(session.capacity_retention_pct).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* SOC & Power sparklines */}
          {socData.filter((v) => v !== null).length >= 2 && (
            <div className="bg-gray-50 rounded-2xl p-3">
              <div className="text-xs font-bold text-gray-600 mb-2">SOC over session</div>
              <Sparkline data={socData} color="#2563eb" height={40} />
            </div>
          )}
          {powerData.filter((v) => v !== null).length >= 2 && (
            <div className="bg-gray-50 rounded-2xl p-3">
              <div className="text-xs font-bold text-gray-600 mb-2">Power (kW) over session</div>
              <Sparkline data={powerData} color="#16a34a" height={40} />
            </div>
          )}

          {/* Anomaly flags */}
          {session.anomaly_flags?.length > 0 && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-2xl px-3 py-2.5">
              <svg className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <div className="text-xs font-bold text-orange-700">Cell voltage anomalies detected</div>
                <div className="text-[10px] text-orange-600 mt-0.5">
                  Sudden voltage delta spike at snapshot{session.anomaly_flags.length > 1 ? "s" : ""}{" "}
                  {session.anomaly_flags.join(", ")}. May indicate cell imbalance under load.
                </div>
              </div>
            </div>
          )}

          {/* Export buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => exportSessionAsCSV(session)}
              className="flex items-center justify-center gap-1.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-2xl py-3 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => exportSessionAsJSON(session)}
              className="flex items-center justify-center gap-1.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl py-3 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2h-5L12 4H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Export JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
