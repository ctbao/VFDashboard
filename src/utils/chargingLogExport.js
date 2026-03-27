/**
 * Charging log export/import utilities.
 * Supports CSV (Excel-friendly) and JSON formats.
 *
 * On Tauri (Android/desktop): writes directly to Downloads/VFDashboard/ on device.
 * On web: uses Web Share API (mobile OS share sheet) or anchor-download fallback.
 */

// Detect Tauri runtime
const isTauri =
  typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

// Subdirectory inside Downloads
const LOG_SUBDIR = "VFDashboard";

const CSV_HEADERS = [
  "datetime",
  "elapsed_sec",
  "soc_pct",
  "power_kw",
  "voltage_v",
  "current_a",
  "remaining_time_min",
  "target_soc",
  "connector_type",
  "pack_temp_c",
  "cell_temp_min_c",
  "cell_temp_max_c",
  "cell_temp_delta_c",
  "coolant_inlet_c",
  "coolant_outlet_c",
  "cell_v_min_mv",
  "cell_v_max_mv",
  "cell_v_delta_mv",
  "bms_pack_voltage_v",
  "bms_pack_current_a",
  "soh_pct",
  "balancing_active",
  "nominal_capacity_kwh",
  "session_energy_kwh",
  "estimated_capacity_kwh",
  "capacity_retention_pct",
];

function esc(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function snapshotToRow(snap) {
  return [
    new Date(snap.timestamp).toISOString(),
    snap.elapsed_sec,
    snap.soc_pct,
    snap.power_kw,
    snap.voltage_v,
    snap.current_a,
    snap.remaining_time_min,
    snap.target_soc,
    snap.connector_type,
    snap.pack_temp,
    snap.cell_temp_min,
    snap.cell_temp_max,
    snap.cell_temp_delta,
    snap.coolant_inlet_temp,
    snap.coolant_outlet_temp,
    snap.cell_voltage_min_mv,
    snap.cell_voltage_max_mv,
    snap.cell_voltage_delta_mv,
    snap.bms_pack_voltage,
    snap.bms_pack_current,
    snap.soh_pct,
    snap.balancing_active ? 1 : 0,
    snap.nominal_capacity_kwh,
    snap.session_energy_kwh,
    snap.estimated_capacity_kwh,
    snap.capacity_retention_pct,
  ].map(esc).join(",");
}

function sessionMetaRows(session) {
  const meta = [
    `# Session ID: ${session.id}`,
    `# VIN: ${session.vin}`,
    `# Start: ${new Date(session.startTime).toISOString()}`,
    `# End: ${session.endTime ? new Date(session.endTime).toISOString() : "in-progress"}`,
    `# Connector: ${session.connector_type}`,
    `# Initial SOC: ${session.initial_soc ?? "--"}%`,
    `# Final SOC: ${session.final_soc ?? "--"}%`,
    `# Peak Power: ${session.peak_power_kw ?? "--"} kW`,
    `# Max Cell V Delta: ${session.max_cell_v_delta_mv ?? "--"} mV`,
    `# Max Cell T Delta: ${session.max_cell_t_delta ?? "--"} °C`,
    `# SOH at Start: ${session.soh_at_start ?? "--"}%`,
    `# SOH at End: ${session.soh_at_end ?? "--"}%`,
    `# Total Energy Added: ${session.total_energy_added_kwh ?? "--"} kWh`,
    `# Estimated Capacity: ${session.estimated_capacity_kwh ?? "--"} kWh`,
    `# Capacity Retention: ${session.capacity_retention_pct ?? "--"}%`,
    `# Nominal Capacity: ${session.nominal_capacity_kwh ?? "--"} kWh`,
    `# Anomaly Flags at snapshots: ${session.anomaly_flags?.join(", ") || "none"}`,
    `# Snapshots: ${session.snapshots.length}`,
    `# Generated: ${new Date().toISOString()}`,
    `# VFDashboard Charging Log`,
  ];
  return meta.join("\n");
}

/**
 * Save file to device storage (Tauri) or share/download (web).
 * Returns the device file path when saved on Tauri, null otherwise.
 * @returns {Promise<string|null>} Absolute path of saved file, or null
 */
async function triggerDownload(content, filename, mimeType) {
  // --- Tauri path: write directly to Downloads/VFDashboard/ on device ---
  if (isTauri) {
    try {
      const { writeTextFile, mkdir, BaseDirectory } = await import("@tauri-apps/plugin-fs");
      const { downloadDir } = await import("@tauri-apps/api/path");

      // Ensure VFDashboard subdirectory exists
      await mkdir(LOG_SUBDIR, {
        baseDir: BaseDirectory.Download,
        recursive: true,
      }).catch(() => {}); // ignore if already exists

      const relPath = `${LOG_SUBDIR}/${filename}`;
      await writeTextFile(relPath, content, { baseDir: BaseDirectory.Download });

      // Resolve absolute path for display
      const base = await downloadDir();
      return `${base}/${relPath}`.replace(/\/\//g, "/");
    } catch (err) {
      console.error("[chargingLogExport] Tauri write failed:", err);
      // Fall through to web share as fallback
    }
  }

  // --- Web path: OS share sheet (mobile) or anchor download (desktop) ---
  const blob = new Blob([content], { type: mimeType });

  if (typeof navigator !== "undefined" && navigator.canShare) {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return null;
      } catch (err) {
        if (err?.name === "AbortError") return null;
      }
    }
  }

  // Anchor download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return null;
}

function safeFilename(session) {
  const d = new Date(session.startTime);
  const date = d.toISOString().slice(0, 10);
  const vin = (session.vin || "UNKNOWN").slice(-6);
  return `charging_log_${vin}_${date}`;
}

/** Export a single session as CSV (Excel-friendly, UTF-8 BOM for Excel on Windows) */
export async function exportSessionAsCSV(session) {
  const s = compressSession(session);
  const metaBlock = sessionMetaRows(s);
  const rows = s.snapshots.map(snapshotToRow);
  const csv = "\uFEFF" + metaBlock + "\n" + CSV_HEADERS.join(",") + "\n" + rows.join("\n");
  return triggerDownload(csv, safeFilename(s) + ".csv", "text/csv;charset=utf-8;");
}

/** Export a single session as JSON */
export async function exportSessionAsJSON(session) {
  const s = compressSession(session);
  const json = JSON.stringify(s, null, 2);
  return triggerDownload(json, safeFilename(s) + ".json", "application/json");
}

/** Export all sessions as a JSON array */
export async function exportAllSessionsAsJSON(sessions) {
  const payload = {
    exported_at: new Date().toISOString(),
    app: "VFDashboard",
    session_count: sessions.length,
    sessions,
  };
  const json = JSON.stringify(payload, null, 2);
  return triggerDownload(json, `charging_logs_all_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
}

/**
 * Returns the absolute path of the VFDashboard log folder on device.
 * Only meaningful when running inside Tauri.
 * @returns {Promise<string|null>}
 */
export async function getLogFolderPath() {
  if (!isTauri) return null;
  try {
    const { downloadDir } = await import("@tauri-apps/api/path");
    const base = await downloadDir();
    return `${base}/${LOG_SUBDIR}`.replace(/\/\//g, "/");
  } catch {
    return null;
  }
}

/**
 * Returns true if a snapshot has at least one meaningful data field (not all null).
 * Used for export-time compression — stored data is never mutated.
 */
function isSnapshotMeaningful(snap) {
  return (
    snap.soc_pct !== null ||
    snap.power_kw !== null ||
    snap.cell_voltage_delta_mv !== null ||
    snap.cell_temp_delta !== null
  );
}

/**
 * Returns a shallow copy of the session with null-only snapshots removed.
 * Export-only — does NOT mutate the session in the store.
 */
export function compressSession(session) {
  const before = session.snapshots.length;
  const snapshots = session.snapshots.filter(isSnapshotMeaningful);
  return { ...session, snapshots, _compressedFrom: before };
}

/**
 * Import sessions from a File object (JSON).
 * Validates structure, deduplicates by session id.
 * @param {File} file
 * @param {ChargingLogSession[]} existingSessions - current sessions to deduplicate against
 * @returns {Promise<{ imported: ChargingLogSession[], skipped: number, errors: string[] }>}
 */
export async function importSessionsFromFile(file, existingSessions = []) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file");
  }

  // Accept single session, array, or { sessions: [...] } wrapper
  let candidates = [];
  if (Array.isArray(parsed)) {
    candidates = parsed;
  } else if (parsed && Array.isArray(parsed.sessions)) {
    candidates = parsed.sessions;
  } else if (parsed && typeof parsed.id === "string") {
    candidates = [parsed];
  } else {
    throw new Error("Unrecognized format. Expected a session object, array of sessions, or { sessions: [...] }.");
  }

  const existingIds = new Set(existingSessions.map((s) => s.id));
  const imported = [];
  const errors = [];
  let skipped = 0;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      errors.push("Skipped non-object entry");
      continue;
    }
    if (typeof candidate.id !== "string" || !candidate.id) {
      errors.push("Skipped entry with missing id");
      continue;
    }
    if (!Array.isArray(candidate.snapshots)) {
      errors.push(`Skipped session ${candidate.id}: missing snapshots array`);
      continue;
    }
    if (existingIds.has(candidate.id)) {
      skipped++;
      continue;
    }
    imported.push(candidate);
    existingIds.add(candidate.id);
  }

  return { imported, skipped, errors };
}
