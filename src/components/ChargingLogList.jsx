import React, { useState } from "react";
import { useStore } from "@nanostores/react";
import {
  chargingLiveStore,
  deleteSession,
  getSessionHealthScore,
} from "../stores/chargingLiveStore";
import { exportSessionAsCSV, exportSessionAsJSON } from "../utils/chargingLogExport";
import ChargingLogModal from "./ChargingLogModal";

function formatDate(ts) {
  if (!ts) return "--";
  const d = new Date(ts);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function formatDuration(start, end) {
  if (!start) return "--";
  const ms = (end || Date.now()) - start;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const GRADE_STYLES = {
  A: { text: "text-green-600", bg: "#f0fdf4" },
  B: { text: "text-blue-600", bg: "#eff6ff" },
  C: { text: "text-yellow-600", bg: "#fefce8" },
  D: { text: "text-red-600", bg: "#fef2f2" },
};

export default function ChargingLogList() {
  const live = useStore(chargingLiveStore);
  const [selectedSession, setSelectedSession] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Sort newest first (store already keeps them newest-first, but be explicit)
  const sessions = [...live.sessions].sort((a, b) => b.startTime - a.startTime);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-gray-700">No charging sessions recorded</p>
          <p className="text-sm text-gray-400 mt-1">
            Sessions are recorded automatically when charging starts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 pb-4">
        <div className="px-1 mb-1">
          <span className="text-xs text-gray-400">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} stored locally
          </span>
        </div>

        {sessions.map((session) => {
          const score = getSessionHealthScore(
            session.max_cell_v_delta_mv,
            session.max_cell_t_delta,
            session.soh_at_end ?? session.soh_at_start,
          );
          const gradeStyle = GRADE_STYLES[score.grade] ?? GRADE_STYLES.D;
          const linkedCount = session.linkedHistoryIds?.length ?? 0;

          return (
            <div
              key={session.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
            >
              {/* Card header */}
              <div className="flex items-start gap-3 mb-3">
                {/* Grade badge */}
                <button
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: gradeStyle.bg }}
                  onClick={() => setSelectedSession(session)}
                  aria-label="Open session detail"
                >
                  <span className={`text-lg font-black ${gradeStyle.text}`}>{score.grade}</span>
                </button>

                {/* Info */}
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900">
                      {formatDate(session.startTime)}
                    </span>
                    {session.connector_type !== "unknown" && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          session.connector_type === "DC"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {session.connector_type}
                      </span>
                    )}
                    {linkedCount > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        🔗 {linkedCount} linked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-600">
                      {session.initial_soc !== null ? `${Math.round(session.initial_soc)}%` : "?"}
                      {" → "}
                      {session.final_soc !== null ? `${Math.round(session.final_soc)}%` : "?"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDuration(session.startTime, session.endTime)}
                    </span>
                    {session.peak_power_kw !== null && (
                      <span className="text-xs text-gray-400">
                        ⚡ {Number(session.peak_power_kw).toFixed(1)} kW peak
                      </span>
                    )}
                    <span className="text-xs text-gray-300">
                      {session.snapshots.length} snap{session.snapshots.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSession(session)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl py-2 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Details
                </button>
                <button
                  onClick={() => exportSessionAsCSV(session)}
                  className="flex items-center justify-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl px-3 py-2 transition-colors"
                >
                  CSV
                </button>
                <button
                  onClick={() => exportSessionAsJSON(session)}
                  className="flex items-center justify-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors"
                >
                  JSON
                </button>
                <button
                  onClick={() => setConfirmDeleteId(session.id)}
                  className="flex items-center justify-center text-xs font-bold text-red-400 bg-red-50 hover:bg-red-100 rounded-xl px-3 py-2 transition-colors"
                  aria-label="Delete session"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Delete confirmation */}
              {confirmDeleteId === session.id && (
                <div className="mt-2 bg-red-50 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-xs text-red-700 flex-1">Delete this session permanently?</span>
                  <button
                    onClick={() => {
                      deleteSession(session.id);
                      setConfirmDeleteId(null);
                    }}
                    className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg px-3 py-1 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-xs font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg px-3 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Log detail modal */}
      {selectedSession && (
        <ChargingLogModal session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </>
  );
}
