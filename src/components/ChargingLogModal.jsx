import { useState, useEffect } from "react";
import { useStore } from "@nanostores/react";
import {
  chargingLiveStore,
  getSessionHealthScore,
  getCellVoltageDeltaHealth,
  getCellTempDeltaHealth,
  getSohHealth,
  bindLogToHistory,
  unbindLogFromHistory,
} from "../stores/chargingLiveStore";
import { chargingHistoryStore } from "../stores/chargingHistoryStore";
import { exportSessionAsCSV, exportSessionAsJSON } from "../utils/chargingLogExport";
import {
  collapseSnapshots,
  getCollapseStats,
  formatElapsedShort,
} from "../utils/chargingLogView";

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

function SparklineWithAxes({
  data,
  timestamps,
  color = "#2563eb",
  yMin = 0,
  yMax = 100,
  yUnit = "%",
  sessionStart,
  height = 72,
}) {
  const pointsData = (data || []).map((v, i) => ({ value: v, index: i })).filter((p) => p.value !== null && Number.isFinite(p.value));
  if (pointsData.length < 2) {
    return <div style={{ height: height + 20 }} className="flex items-center justify-center text-[10px] text-gray-300">No data</div>;
  }

  const w = 300;
  const lPad = 32;
  const rPad = 4;
  const tPad = 4;
  const bPad = 16;
  const h = height + bPad;
  const plotW = w - lPad - rPad;
  const plotH = height - tPad;
  const yRange = yMax - yMin || 1;

  const toX = (idx) => {
    if (pointsData.length <= 1) return lPad;
    return lPad + (idx / (pointsData.length - 1)) * plotW;
  };
  const toY = (val) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    return tPad + (1 - (clamped - yMin) / yRange) * plotH;
  };

  const linePoints = pointsData.map((p) => `${toX(p.index).toFixed(1)},${toY(p.value).toFixed(1)}`).join(" ");

  const yTicks = [0, 25, 50, 75, 100].map((v) => yMin + ((yMax - yMin) * v) / 100);
  const canLabelTime = Array.isArray(timestamps) && timestamps.length >= 2 && sessionStart;
  const timeTickCount = 4;
  const xTickIdx = Array.from({ length: timeTickCount }, (_, i) => {
    if (pointsData.length <= 1) return 0;
    return Math.round((i / (timeTickCount - 1)) * (pointsData.length - 1));
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      {yTicks.map((tick) => {
        const y = toY(tick);
        return (
          <g key={`y-${tick}`}>
            <line x1={lPad} y1={y} x2={w - rPad} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 2" />
            <text x={lPad - 4} y={y + 3} fontSize="8" fill="#6b7280" textAnchor="end">
              {Math.round(tick)}{yUnit}
            </text>
          </g>
        );
      })}

      <line x1={lPad} y1={tPad} x2={lPad} y2={height} stroke="#d1d5db" strokeWidth="1" />
      <line x1={lPad} y1={height} x2={w - rPad} y2={height} stroke="#d1d5db" strokeWidth="1" />

      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />

      {canLabelTime && xTickIdx.map((idx, i) => {
        const x = toX(idx);
        const ts = timestamps[idx];
        const label = ts ? formatElapsedShort(ts, sessionStart) : "--";
        return (
          <g key={`x-${i}`}>
            <line x1={x} y1={height} x2={x} y2={height + 3} stroke="#9ca3af" strokeWidth="1" />
            <text x={x} y={height + 12} fontSize="8" fill="#6b7280" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
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

// ─── Dual range slider (two separate sliders for start / end) ──────────────

function TimeRangeSlider({ snapshots, rangeStart, rangeEnd, onStartChange, onEndChange, onReset }) {
  const maxIdx = Math.max(0, snapshots.length - 1);
  const isFullRange = rangeStart === 0 && rangeEnd === maxIdx;

  function labelAt(idx) {
    const snap = snapshots[idx];
    if (!snap) return "--";
    return formatElapsedShort(snap.timestamp, snapshots[0].timestamp);
  }

  if (snapshots.length < 2) return null;

  return (
    <div className="bg-blue-50 rounded-2xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-blue-700">Time window</span>
        {!isFullRange && (
          <button
            onClick={onReset}
            className="text-[10px] font-bold text-blue-500 hover:text-blue-700 underline"
          >
            Reset
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>Start</span>
          <span className="font-bold text-blue-700">{labelAt(rangeStart)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={maxIdx}
          value={rangeStart}
          onChange={(e) => onStartChange(Math.min(Number(e.target.value), rangeEnd - 1))}
          className="w-full h-1.5 cursor-pointer accent-blue-500"
        />
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>End</span>
          <span className="font-bold text-blue-700">{labelAt(rangeEnd)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={maxIdx}
          value={rangeEnd}
          onChange={(e) => onEndChange(Math.max(Number(e.target.value), rangeStart + 1))}
          className="w-full h-1.5 cursor-pointer accent-blue-500"
        />
      </div>
      <div className="text-[10px] text-gray-400 text-center">
        Showing snapshots {rangeStart + 1}–{rangeEnd + 1} of {snapshots.length}
      </div>
    </div>
  );
}

// ─── Snapshot table ────────────────────────────────────────────────────────

function SnapshotTable({ session, snapshots }) {
  const [open, setOpen] = useState(false);
  const [hideStale, setHideStale] = useState(true);
  const [collapseDups, setCollapseDups] = useState(true);

  const entries = collapseSnapshots(snapshots, { hideStale, collapseDuplicates: collapseDups });
  const { staleCount, dupCount, visibleCount } = getCollapseStats(entries);
  const totalHidden = staleCount + dupCount;
  const sessionStart = session.startTime;

  function fmt(val, decimals = 1) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return "--";
    return Number(val).toFixed(decimals);
  }

  return (
    <div className="bg-gray-50 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-bold text-gray-700">Snapshots</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{snapshots.length} records</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-100">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideStale}
                onChange={(e) => setHideStale(e.target.checked)}
                className="accent-yellow-500 w-3.5 h-3.5"
              />
              <span className="text-[11px] text-gray-600">Hide stale</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={collapseDups}
                onChange={(e) => setCollapseDups(e.target.checked)}
                className="accent-blue-500 w-3.5 h-3.5"
              />
              <span className="text-[11px] text-gray-600">Collapse duplicates</span>
            </label>
          </div>

          {totalHidden > 0 && (
            <div className="px-4 py-1.5 bg-white border-b border-gray-100 text-[10px] text-gray-400">
              Showing {visibleCount} of {snapshots.length} records
              {staleCount > 0 && ` · ${staleCount} stale hidden`}
              {dupCount > 0 && ` · ${dupCount} duplicates collapsed`}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-100 text-gray-500">
                  <th className="px-3 py-1.5 text-left font-semibold">Time</th>
                  <th className="px-2 py-1.5 text-right font-semibold">SOC%</th>
                  <th className="px-2 py-1.5 text-right font-semibold">kW</th>
                  <th className="px-2 py-1.5 text-right font-semibold">V</th>
                  <th className="px-2 py-1.5 text-right font-semibold">A</th>
                  <th className="px-2 py-1.5 text-right font-semibold">°C</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  if (entry.type === "stale_gap") {
                    return (
                      <tr key={`stale-${idx}`} className="bg-yellow-50">
                        <td colSpan={6} className="px-3 py-1.5 text-yellow-600 text-[10px] font-medium">
                          ⚡ {entry.count} record{entry.count !== 1 ? "s" : ""} during offline gap
                          {" "}({formatElapsedShort(entry.startTime, sessionStart)}
                          {" – "}{formatElapsedShort(entry.endTime, sessionStart)})
                        </td>
                      </tr>
                    );
                  }
                  if (entry.type === "dup_group") {
                    return (
                      <tr key={`dup-${idx}`} className="bg-gray-50">
                        <td colSpan={6} className="px-3 py-1.5 text-gray-400 text-[10px] text-center">
                          ── {entry.count} duplicate record{entry.count !== 1 ? "s" : ""}
                          {" "}({formatElapsedShort(entry.startTime, sessionStart)}
                          {" – "}{formatElapsedShort(entry.endTime, sessionStart)}) ──
                        </td>
                      </tr>
                    );
                  }
                  const s = entry.data;
                  return (
                    <tr key={s.timestamp} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30">
                      <td className="px-3 py-1.5 text-gray-500 tabular-nums whitespace-nowrap">
                        {formatElapsedShort(s.timestamp, sessionStart)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold text-blue-700 tabular-nums">
                        {s.soc_pct !== null ? `${Math.round(s.soc_pct)}` : "--"}
                      </td>
                      <td className="px-2 py-1.5 text-right text-green-700 tabular-nums">
                        {fmt(s.power_kw)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-600 tabular-nums">
                        {fmt(s.voltage_v, 0)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-600 tabular-nums">
                        {fmt(s.current_a, 0)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-orange-600 tabular-nums">
                        {fmt(s.pack_temp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History binding panel ─────────────────────────────────────────────────

function BindingPanel({ session }) {
  const historyState = useStore(chargingHistoryStore);
  const liveState = useStore(chargingLiveStore);
  const [pickerOpen, setPickerOpen] = useState(false);

  const currentSession = liveState.sessions.find((s) => s.id === session.id) ?? session;
  const linkedIds = currentSession.linkedHistoryIds ?? [];
  const allHistorySessions = historyState.sessions ?? [];
  const linkedSessions = allHistorySessions.filter((hs) => linkedIds.includes(hs.id));

  function isSuggested(hs) {
    const plugged = hs.pluggedTime;
    const unplugged = hs.unpluggedTime;
    if (!plugged || !unplugged) return false;
    return currentSession.startTime >= plugged && currentSession.startTime <= unplugged;
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700">Linked History Sessions</span>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
        >
          {pickerOpen ? "Done" : "+ Link"}
        </button>
      </div>

      {linkedSessions.length === 0 && !pickerOpen && (
        <p className="text-[11px] text-gray-400">
          No history sessions linked. Tap + Link to connect this log to a billing record.
        </p>
      )}

      {linkedSessions.map((hs) => (
        <div key={hs.id} className="flex items-start gap-2 bg-white rounded-xl p-2.5 border border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">
              {hs.chargingStationName || "Charging station"}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {formatDate(hs.startChargeTime || hs.pluggedTime)} ·{" "}
              {hs.totalKWCharged ? `${Number(hs.totalKWCharged).toFixed(1)} kWh` : "--"}
            </p>
          </div>
          <button
            onClick={() => unbindLogFromHistory(currentSession.id, hs.id)}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors text-[11px] font-bold"
            aria-label="Unlink"
          >
            ×
          </button>
        </div>
      ))}

      {pickerOpen && (
        <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-none pr-0.5">
          {allHistorySessions.length === 0 && (
            <p className="text-[11px] text-gray-400 py-2 text-center">
              No history sessions loaded yet.
            </p>
          )}
          {allHistorySessions.map((hs) => {
            const isLinked = linkedIds.includes(hs.id);
            const suggested = isSuggested(hs);
            return (
              <button
                key={hs.id}
                onClick={() => {
                  if (isLinked) {
                    unbindLogFromHistory(currentSession.id, hs.id);
                  } else {
                    bindLogToHistory(currentSession.id, hs.id, hs.totalKWCharged);
                  }
                }}
                className={`w-full flex items-start gap-2 text-left rounded-xl p-2.5 border transition-colors ${
                  isLinked ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-gray-800 truncate">
                      {hs.chargingStationName || "Charging station"}
                    </span>
                    {suggested && !isLinked && (
                      <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">
                        Suggested
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatDate(hs.startChargeTime || hs.pluggedTime)} ·{" "}
                    {hs.totalKWCharged ? `${Number(hs.totalKWCharged).toFixed(1)} kWh` : "--"}
                  </p>
                </div>
                <div className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                  {isLinked ? (
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────

export default function ChargingLogModal({ session, onClose }) {
  const snaps = session?.snapshots ?? [];
  const maxIdx = Math.max(0, snaps.length - 1);

  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(maxIdx);

  useEffect(() => {
    setRangeStart(0);
    setRangeEnd(Math.max(0, (session?.snapshots?.length ?? 1) - 1));
  }, [session?.id]);

  if (!session) return null;

  const vHealth = getCellVoltageDeltaHealth(session.max_cell_v_delta_mv);
  const tHealth = getCellTempDeltaHealth(session.max_cell_t_delta);
  const sohHealth = getSohHealth(session.soh_at_end ?? session.soh_at_start);
  const score = getSessionHealthScore(session.max_cell_v_delta_mv, session.max_cell_t_delta, session.soh_at_end ?? session.soh_at_start);

  // Slice snapshots to current time window; derive chart data from window
  const visibleSnaps = snaps.slice(rangeStart, rangeEnd + 1);
  const socData = visibleSnaps.map((s) => s.soc_pct);
  const powerData = visibleSnaps.map((s) => s.power_kw);
  const vDeltaData = visibleSnaps.map((s) => s.cell_voltage_delta_mv);
  const tDeltaData = visibleSnaps.map((s) => s.cell_temp_delta);

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

          {/* Connector + snapshot count */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
            <span>Connector:</span>
            {session.connector_type && (
              <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${session.connector_type === "DC" ? "bg-purple-100 text-purple-700" : session.connector_type === "AC" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {session.connector_type}
              </span>
            )}
            <span className="ml-auto">{snaps.length} snapshots</span>
          </div>

          {/* ── Time window slider ── */}
          <TimeRangeSlider
            snapshots={snaps}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onStartChange={setRangeStart}
            onEndChange={setRangeEnd}
            onReset={() => { setRangeStart(0); setRangeEnd(maxIdx); }}
          />

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

          {/* SOC & Power sparklines (windowed) */}
          {socData.filter((v) => v !== null).length >= 2 && (
            <div className="bg-gray-50 rounded-2xl p-3">
              <div className="text-xs font-bold text-gray-600 mb-2">SOC over window</div>
              <SparklineWithAxes
                data={socData}
                timestamps={visibleSnaps.map((s) => s.timestamp)}
                color="#2563eb"
                yMin={0}
                yMax={100}
                yUnit="%"
                sessionStart={session.startTime}
                height={72}
              />
            </div>
          )}
          {powerData.filter((v) => v !== null).length >= 2 && (
            <div className="bg-gray-50 rounded-2xl p-3">
              <div className="text-xs font-bold text-gray-600 mb-2">Power (kW) over window</div>
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

          {/* ── Snapshot table ── */}
          {snaps.length > 0 && (
            <SnapshotTable session={session} snapshots={visibleSnaps} />
          )}

          {/* ── History binding ── */}
          <BindingPanel session={session} />

          {/* Export buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => exportSessionAsCSV(session)}
              className="flex items-center justify-center gap-1.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl py-2.5 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => exportSessionAsJSON(session)}
              className="flex items-center justify-center gap-1.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl py-2.5 transition-colors">
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
