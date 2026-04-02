import { useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { vehicleStore } from "../stores/vehicleStore";
import {
  addRangeDiaryEntry,
  addVehicleModel,
  batteryHealthStore,
  BUILT_IN_VEHICLE_MODEL,
  classifyWeatherCondition,
  deleteRangeDiaryEntry,
  deleteVehicleModel,
  getActiveVehicleModel,
  getCapacityTrend,
  getDcPeakTrend,
  getLatestSohEstimate,
  getRangeDiarySummary,
  setActiveVehicleModel,
  setAutoRecordEnabled,
  updateRangeDiaryEntry,
  updateVehicleModel,
} from "../stores/batteryHealthStore";
import { getCellTempDeltaHealth, getCellVoltageDeltaHealth, getSohHealth } from "../stores/chargingLiveStore";
import { startBatteryTracker, stopBatteryTracker, trackerStatusStore } from "../services/batteryTracker";
import BatteryReportModal from "./BatteryReportModal";

function Sparkline({ values, color = "#2563eb" }) {
  const points = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
  if (points.length < 2) {
    return <div className="h-14 flex items-center justify-center text-xs text-gray-300">Chưa đủ dữ liệu</div>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 320;
  const height = 56;
  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * (width - 8) + 4;
    const y = height - 4 - ((Number(value) - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-14">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={coords} />
    </svg>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="mb-3">
        <h3 className="text-sm font-black text-gray-900">{title}</h3>
        {hint && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, sub, tone = "text-gray-900" }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-2xl font-black mt-1 ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "--";
  }
}

function formatDuration(minutes) {
  if (!minutes || !Number.isFinite(Number(minutes))) return "--";
  const total = Number(minutes);
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h > 0 ? `${h}h ${m}m` : `${m} phút`;
}

function weatherBadge(condition) {
  switch (condition) {
    case "hot": return "🔥 Nóng";
    case "cold": return "❄️ Lạnh";
    case "rain": return "🌧️ Mưa";
    case "cloudy": return "☁️ Nhiều mây";
    default: return "☀️ Bình thường";
  }
}

export default function BatteryHealthPage() {
  const battery = useStore(batteryHealthStore);
  const vehicle = useStore(vehicleStore);
  const trackerStatus = useStore(trackerStatusStore);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelFormMode, setModelFormMode] = useState("add");
  const [editingModelId, setEditingModelId] = useState(null);
  const [modelFormError, setModelFormError] = useState("");
  const [capSourceFilter, setCapSourceFilter] = useState("all");
  const [capSortMode, setCapSortMode] = useState("newest");
  const [capShowAll, setCapShowAll] = useState(false);
  const [socBarScale, setSocBarScale] = useState("full");
  const [diaryFilter, setDiaryFilter] = useState("all");
  const [diaryShowAll, setDiaryShowAll] = useState(false);
  const [editingDiaryId, setEditingDiaryId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [editDiaryForm, setEditDiaryForm] = useState({
    outsideTempC: "",
    weatherCondition: "clear",
    durationMinutes: "",
    acClimateActive: false,
    note: "",
  });
  const [manualForm, setManualForm] = useState({
    socStart: vehicle.battery_level ? String(Math.round(Number(vehicle.battery_level))) : "",
    socEnd: vehicle.battery_level ? String(Math.round(Number(vehicle.battery_level))) : "",
    distanceKm: "",
    durationMinutes: "",
    outsideTempC: vehicle.outside_temp !== null && vehicle.outside_temp !== undefined ? String(Number(vehicle.outside_temp)) : "",
    note: "",
    acClimateActive: (Number(vehicle.fan_speed) || 0) > 0,
  });
  const [modelForm, setModelForm] = useState({
    name: "",
    nominalCapacityKwh: "",
    acChargerEfficiency: "0.88",
    expectedKwhPer100km: "12",
    maxDcPowerKw: "",
    batteryChemistry: "LFP",
    anomalyThresholdMultiplier: "1.4",
  });

  const activeModel = getActiveVehicleModel(battery);
  const selectedModel = battery.vehicleModels.find((model) => model.id === battery.activeModelId) || BUILT_IN_VEHICLE_MODEL;
  const latestEstimate = getLatestSohEstimate(battery);
  const capacityTrend = getCapacityTrend(battery);
  const dcTrend = getDcPeakTrend(battery);
  const rangeSummary = getRangeDiarySummary(battery);
  const latestAnomaly = battery.socDropAnomalies[0] ?? null;
  const visibleDiaryEntries = useMemo(() => {
    if (diaryFilter === "all") return battery.rangeDiary;
    return battery.rangeDiary.filter((entry) => entry.type === diaryFilter);
  }, [battery.rangeDiary, diaryFilter]);
  const displayedDiaryEntries = useMemo(
    () => (diaryShowAll ? visibleDiaryEntries : visibleDiaryEntries.slice(0, 8)),
    [diaryShowAll, visibleDiaryEntries],
  );
  const trackerStatusMeta = useMemo(() => {
    if (!trackerStatus.running) {
      return {
        label: "Tracker đang dừng",
        dotClass: "bg-gray-400",
        toneClass: "border-gray-200 bg-gray-50 text-gray-600",
      };
    }
    if (!battery.autoRecordEnabled) {
      return {
        label: "Tracker đang bật · Auto record đang tắt",
        dotClass: "bg-slate-400",
        toneClass: "border-slate-200 bg-slate-50 text-slate-700",
      };
    }
    if (trackerStatus.idleSince !== null) {
      return {
        label: "Vừa kết thúc chuyến đi · đang chờ lưu",
        dotClass: "bg-sky-500",
        toneClass: "border-sky-200 bg-sky-50 text-sky-700",
      };
    }
    if (trackerStatus.tripInProgress) {
      return {
        label: "Đang ghi nhận chuyến đi",
        dotClass: "bg-emerald-500 animate-pulse",
        toneClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }
    return {
      label: "Tracker đang chạy · chưa có chuyến đi",
      dotClass: "bg-amber-500",
      toneClass: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }, [battery.autoRecordEnabled, trackerStatus.idleSince, trackerStatus.running, trackerStatus.tripInProgress]);
  const visibleCapacityEstimates = useMemo(() => {
    const filtered = capacityTrend.filter((entry) => {
      if (capSourceFilter === "all") return true;
      if (capSourceFilter === "linked") return !!entry.sourceHistoryId;
      return !!entry.sourceLogId && !entry.sourceHistoryId;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (capSortMode) {
        case "oldest":
          return a.date - b.date;
        case "soh_desc":
          return b.estimatedSoh - a.estimatedSoh;
        case "soh_asc":
          return a.estimatedSoh - b.estimatedSoh;
        case "capacity_desc":
          return b.estimatedPackKwh - a.estimatedPackKwh;
        case "capacity_asc":
          return a.estimatedPackKwh - b.estimatedPackKwh;
        case "newest":
        default:
          return b.date - a.date;
      }
    });

    return sorted;
  }, [capacityTrend, capSourceFilter, capSortMode]);
  const displayedCapacityEstimates = useMemo(
    () => (capShowAll ? visibleCapacityEstimates : visibleCapacityEstimates.slice(0, 5)),
    [capShowAll, visibleCapacityEstimates],
  );
  const { socScaleMin, socScaleMax } = useMemo(() => {
    if (socBarScale === "full" || visibleCapacityEstimates.length === 0) {
      return { socScaleMin: 0, socScaleMax: 100 };
    }

    const allSoc = visibleCapacityEstimates
      .flatMap((entry) => [entry.socStart, entry.socEnd])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (allSoc.length === 0) return { socScaleMin: 0, socScaleMax: 100 };

    const minSoc = Math.max(0, Math.floor(Math.min(...allSoc) / 5) * 5);
    const maxSoc = Math.min(100, Math.ceil(Math.max(...allSoc) / 5) * 5);
    if (minSoc === maxSoc) {
      return { socScaleMin: Math.max(0, minSoc - 5), socScaleMax: Math.min(100, maxSoc + 5) };
    }

    return { socScaleMin: minSoc, socScaleMax: maxSoc };
  }, [socBarScale, visibleCapacityEstimates]);

  const reportPayload = useMemo(() => ({
    vehicle,
    model: activeModel,
    latestEstimate,
    capacityEstimates: battery.capacityEstimates.slice(0, 12).reverse(),
    anomalies: battery.socDropAnomalies.slice(0, 10).reverse(),
    dcPeaks: battery.dcPeakPowerHistory.slice(0, 10).reverse(),
    rangeDiary: battery.rangeDiary.slice(0, 12).reverse(),
  }), [activeModel, battery.capacityEstimates, battery.dcPeakPowerHistory, battery.rangeDiary, battery.socDropAnomalies, latestEstimate, vehicle]);

  const cellVoltageDelta = useMemo(() => {
    const min = vehicle.bms_cell_voltage_min_mv;
    const max = vehicle.bms_cell_voltage_max_mv;
    if (min === null || min === undefined || max === null || max === undefined) return null;
    const minMv = Number(min) < 10 ? Math.round(Number(min) * 1000) : Math.round(Number(min));
    const maxMv = Number(max) < 10 ? Math.round(Number(max) * 1000) : Math.round(Number(max));
    return maxMv - minMv;
  }, [vehicle.bms_cell_voltage_max_mv, vehicle.bms_cell_voltage_min_mv]);

  const cellTempDelta = useMemo(() => {
    if (vehicle.bms_cell_temp_min === null || vehicle.bms_cell_temp_max === null || vehicle.bms_cell_temp_min === undefined || vehicle.bms_cell_temp_max === undefined) return null;
    return +(Number(vehicle.bms_cell_temp_max) - Number(vehicle.bms_cell_temp_min)).toFixed(1);
  }, [vehicle.bms_cell_temp_max, vehicle.bms_cell_temp_min]);

  const voltageHealth = getCellVoltageDeltaHealth(cellVoltageDelta);
  const tempHealth = getCellTempDeltaHealth(cellTempDelta);
  const sohHealth = getSohHealth(vehicle.soh_percentage === null || vehicle.soh_percentage === undefined ? null : Number(vehicle.soh_percentage));

  function handleAddManualEntry(event) {
    event.preventDefault();
    const socStart = Number(manualForm.socStart);
    const socEnd = Number(manualForm.socEnd);
    const distanceKm = Number(manualForm.distanceKm);
    const durationMinutes = Number(manualForm.durationMinutes);
    if (!Number.isFinite(socStart) || !Number.isFinite(socEnd) || !Number.isFinite(distanceKm) || distanceKm <= 0) return;
    const deltaSoc = Math.max(0, socStart - socEnd);
    const estimatedKwhUsed = +((deltaSoc * activeModel.nominalCapacityKwh) / 100).toFixed(2);
    const outsideTempC = manualForm.outsideTempC === "" ? null : Number(manualForm.outsideTempC);
    addRangeDiaryEntry({
      id: `manual_${Date.now()}`,
      type: "manual",
      timestamp: Date.now(),
      socStart,
      socEnd,
      odometerStart: vehicle.odometer ?? 0,
      odometerEnd: (vehicle.odometer ?? 0) + distanceKm,
      distanceKm,
      estimatedKwhUsed,
      kwhPer100km: +((estimatedKwhUsed / distanceKm) * 100).toFixed(1),
      durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0,
      avgSpeedKmh: Number.isFinite(durationMinutes) && durationMinutes > 0 ? +((distanceKm / durationMinutes) * 60).toFixed(1) : null,
      outsideTempC,
      weatherCondition: classifyWeatherCondition(outsideTempC, vehicle.weather_code),
      acClimateActive: manualForm.acClimateActive,
      rangeEstimateStart: vehicle.range,
      rangeEstimateEnd: vehicle.range,
      note: manualForm.note.trim() || undefined,
    });
    setManualForm({
      socStart: vehicle.battery_level ? String(Math.round(Number(vehicle.battery_level))) : "",
      socEnd: vehicle.battery_level ? String(Math.round(Number(vehicle.battery_level))) : "",
      distanceKm: "",
      durationMinutes: "",
      outsideTempC: vehicle.outside_temp !== null && vehicle.outside_temp !== undefined ? String(Number(vehicle.outside_temp)) : "",
      note: "",
      acClimateActive: (Number(vehicle.fan_speed) || 0) > 0,
    });
    setShowManualForm(false);
  }

  function openEditDiaryEntry(entry) {
    setEditingDiaryId(entry.id);
    setEditDiaryForm({
      outsideTempC: entry.outsideTempC === null || entry.outsideTempC === undefined ? "" : String(entry.outsideTempC),
      weatherCondition: entry.weatherCondition || "clear",
      durationMinutes: entry.durationMinutes ? String(entry.durationMinutes) : "",
      acClimateActive: Boolean(entry.acClimateActive),
      note: entry.note || "",
    });
  }

  function handleSaveDiaryEdit(entry) {
    const outsideTempC = editDiaryForm.outsideTempC === "" ? null : Number(editDiaryForm.outsideTempC);
    const durationMinutes = editDiaryForm.durationMinutes === "" ? 0 : Number(editDiaryForm.durationMinutes);

    if ((editDiaryForm.outsideTempC !== "" && !Number.isFinite(outsideTempC)) || (editDiaryForm.durationMinutes !== "" && (!Number.isFinite(durationMinutes) || durationMinutes < 0))) {
      return;
    }

    updateRangeDiaryEntry(entry.id, {
      outsideTempC,
      weatherCondition: editDiaryForm.weatherCondition || classifyWeatherCondition(outsideTempC, vehicle.weather_code),
      durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0,
      avgSpeedKmh: Number.isFinite(durationMinutes) && durationMinutes > 0 ? +((entry.distanceKm / durationMinutes) * 60).toFixed(1) : null,
      acClimateActive: editDiaryForm.acClimateActive,
      note: editDiaryForm.note.trim() || undefined,
    });
    setEditingDiaryId(null);
  }

  function openAddModelForm() {
    setModelFormMode("add");
    setEditingModelId(null);
    setModelFormError("");
    setModelForm({
      name: "",
      nominalCapacityKwh: "",
      acChargerEfficiency: "0.88",
      expectedKwhPer100km: "12",
      maxDcPowerKw: "",
      batteryChemistry: "LFP",
      anomalyThresholdMultiplier: "1.4",
    });
    setShowModelForm(true);
  }

  function openEditModelForm() {
    if (selectedModel.isBuiltIn) return;
    setModelFormMode("edit");
    setEditingModelId(selectedModel.id);
    setModelFormError("");
    setModelForm({
      name: selectedModel.name,
      nominalCapacityKwh: String(selectedModel.nominalCapacityKwh),
      acChargerEfficiency: String(selectedModel.acChargerEfficiency),
      expectedKwhPer100km: String(selectedModel.expectedKwhPer100km),
      maxDcPowerKw: String(selectedModel.maxDcPowerKw),
      batteryChemistry: selectedModel.batteryChemistry,
      anomalyThresholdMultiplier: String(selectedModel.anomalyThresholdMultiplier),
    });
    setShowModelForm(true);
  }

  function handleSaveModel(event) {
    event.preventDefault();
    const payload = {
      name: modelForm.name.trim(),
      nominalCapacityKwh: Number(modelForm.nominalCapacityKwh),
      acChargerEfficiency: Number(modelForm.acChargerEfficiency),
      expectedKwhPer100km: Number(modelForm.expectedKwhPer100km),
      maxDcPowerKw: Number(modelForm.maxDcPowerKw),
      batteryChemistry: modelForm.batteryChemistry.trim() || "Unknown",
      anomalyThresholdMultiplier: Number(modelForm.anomalyThresholdMultiplier),
    };

    if (!payload.name) {
      setModelFormError("Vui lòng nhập tên model.");
      return;
    }
    if (!Number.isFinite(payload.nominalCapacityKwh) || payload.nominalCapacityKwh <= 0) {
      setModelFormError("Dung lượng danh nghĩa phải lớn hơn 0.");
      return;
    }
    if (!Number.isFinite(payload.acChargerEfficiency) || payload.acChargerEfficiency <= 0 || payload.acChargerEfficiency > 1) {
      setModelFormError("Hiệu suất AC cần nằm trong khoảng 0.01 đến 1.00.");
      return;
    }
    if (!Number.isFinite(payload.expectedKwhPer100km) || payload.expectedKwhPer100km <= 0) {
      setModelFormError("Tiêu hao kỳ vọng phải lớn hơn 0.");
      return;
    }
    if (!Number.isFinite(payload.maxDcPowerKw) || payload.maxDcPowerKw <= 0) {
      setModelFormError("DC max cần lớn hơn 0.");
      return;
    }
    if (!Number.isFinite(payload.anomalyThresholdMultiplier) || payload.anomalyThresholdMultiplier < 1) {
      setModelFormError("Ngưỡng cảnh báo nên từ 1.0 trở lên.");
      return;
    }

    if (modelFormMode === "edit" && editingModelId) {
      updateVehicleModel(editingModelId, payload);
    } else {
      addVehicleModel(payload);
    }

    setModelFormError("");
    setModelForm({
      name: "",
      nominalCapacityKwh: "",
      acChargerEfficiency: "0.88",
      expectedKwhPer100km: "12",
      maxDcPowerKw: "",
      batteryChemistry: "LFP",
      anomalyThresholdMultiplier: "1.4",
    });
    setEditingModelId(null);
    setShowModelForm(false);
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Section title="Nhật ký quãng đường vs SoC" hint="Mỗi chuyến đi sẽ cho thấy xe đã dùng bao nhiêu % pin cho bao nhiêu km. App có thể tự ghi khi xe chạy, hoặc bạn nhập thủ công nếu muốn bổ sung.">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={() => setAutoRecordEnabled(!battery.autoRecordEnabled)} className={`rounded-xl px-3 py-2 text-sm font-bold ${battery.autoRecordEnabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
            {battery.autoRecordEnabled ? "Auto record: Bật" : "Auto record: Tắt"}
          </button>
          <button onClick={() => setShowManualForm((value) => !value)} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-100">
            {showManualForm ? "Ẩn form thủ công" : "Thêm thủ công"}
          </button>
          <div className="text-xs text-gray-500">Tổng {rangeSummary.totalKm.toFixed(1)} km · {rangeSummary.totalEntries} bản ghi</div>
        </div>

        <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 ${trackerStatusMeta.toneClass}`}>
          <div className="inline-flex items-center gap-2 text-xs font-bold">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${trackerStatusMeta.dotClass}`} />
            <span>{trackerStatusMeta.label}</span>
          </div>
          <button
            type="button"
            onClick={() => (trackerStatus.running ? stopBatteryTracker() : startBatteryTracker())}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${
              trackerStatus.running
                ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
                : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {trackerStatus.running ? "Dừng tracker" : "Bật tracker"}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setDiaryFilter("all")} className={`rounded-full px-3 py-1 text-xs font-bold ${diaryFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>Tất cả</button>
          <button onClick={() => setDiaryFilter("auto")} className={`rounded-full px-3 py-1 text-xs font-bold ${diaryFilter === "auto" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>Auto</button>
          <button onClick={() => setDiaryFilter("manual")} className={`rounded-full px-3 py-1 text-xs font-bold ${diaryFilter === "manual" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"}`}>Manual</button>
        </div>

        {showManualForm && (
          <form onSubmit={handleAddManualEntry} className="grid grid-cols-2 gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 mb-3">
            <input value={manualForm.socStart} onChange={(event) => setManualForm({ ...manualForm, socStart: event.target.value })} placeholder="SoC đầu (%)" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
            <input value={manualForm.socEnd} onChange={(event) => setManualForm({ ...manualForm, socEnd: event.target.value })} placeholder="SoC cuối (%)" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
            <input value={manualForm.distanceKm} onChange={(event) => setManualForm({ ...manualForm, distanceKm: event.target.value })} placeholder="Quãng đường (km)" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
            <input value={manualForm.durationMinutes} onChange={(event) => setManualForm({ ...manualForm, durationMinutes: event.target.value })} placeholder="Thời gian hoạt động (phút)" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
            <input value={manualForm.outsideTempC} onChange={(event) => setManualForm({ ...manualForm, outsideTempC: event.target.value })} placeholder="Nhiệt độ ngoài trời (°C)" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
            <label className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
              <input type="checkbox" checked={manualForm.acClimateActive} onChange={(event) => setManualForm({ ...manualForm, acClimateActive: event.target.checked })} />
              Điều hòa đang bật
            </label>
            <textarea value={manualForm.note} onChange={(event) => setManualForm({ ...manualForm, note: event.target.value })} placeholder="Ghi chú: ví dụ đường núi, tắc đường, mưa lớn..." className="rounded-xl border border-blue-100 px-3 py-2 text-sm col-span-2 min-h-20" />
            <div className="col-span-2 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowManualForm(false)} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-600 border border-gray-200">Hủy</button>
              <button type="submit" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">Lưu nhật ký</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {visibleDiaryEntries.length === 0 ? (
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">Chưa có nhật ký quãng đường. Khi xe chạy và có dữ liệu odometer + SoC, app sẽ tự ghi lại.</div>
          ) : (
            displayedDiaryEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-gray-100 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-800">
                      <span>{formatDate(entry.timestamp)} · {weatherBadge(entry.weatherCondition)}</span>
                      {entry.distanceSource === "range_estimate" && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700">Ước tính</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{entry.type === "auto" ? "Ghi tự động" : "Nhập tay"} · {entry.socStart}% → {entry.socEnd}% · {entry.distanceKm.toFixed(1)} km · {formatDuration(entry.durationMinutes)}</div>
                    <div className="text-xs text-gray-500 mt-1">{entry.outsideTempC === null || entry.outsideTempC === undefined ? "--" : `${entry.outsideTempC.toFixed(1)}°C`} · {entry.avgSpeedKmh === null ? "--" : `${entry.avgSpeedKmh.toFixed(1)} km/h`} · {entry.acClimateActive ? "Có dùng điều hòa" : "Không dùng điều hòa"}</div>
                    {entry.note && <div className="text-xs text-gray-500 mt-1">Ghi chú: {entry.note}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black text-orange-700">{entry.kwhPer100km.toFixed(1)}</div>
                    <div className="text-[11px] text-gray-500">kWh/100km</div>
                    <div className="mt-2 flex items-center justify-end gap-3">
                      <button onClick={() => openEditDiaryEntry(entry)} className="text-xs font-bold text-blue-600 hover:text-blue-800">Sửa</button>
                      <button onClick={() => deleteRangeDiaryEntry(entry.id)} className="text-xs font-bold text-red-500 hover:text-red-700">Xóa</button>
                    </div>
                  </div>
                </div>
                {(entry.weatherCondition === "hot" || entry.weatherCondition === "cold") && (
                  <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Tiêu hao của chuyến này có thể cao hơn bình thường do nhiệt độ ngoài trời ảnh hưởng trực tiếp đến pin và điều hòa.
                  </div>
                )}
                {editingDiaryId === entry.id && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSaveDiaryEdit(entry);
                    }}
                    className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-sky-100 bg-sky-50/70 p-3"
                  >
                    <input value={editDiaryForm.outsideTempC} onChange={(event) => setEditDiaryForm({ ...editDiaryForm, outsideTempC: event.target.value })} placeholder="Nhiệt độ ngoài trời (°C)" className="rounded-xl border border-sky-100 px-3 py-2 text-sm" />
                    <input value={editDiaryForm.durationMinutes} onChange={(event) => setEditDiaryForm({ ...editDiaryForm, durationMinutes: event.target.value })} placeholder="Thời gian (phút)" className="rounded-xl border border-sky-100 px-3 py-2 text-sm" />
                    <select value={editDiaryForm.weatherCondition} onChange={(event) => setEditDiaryForm({ ...editDiaryForm, weatherCondition: event.target.value })} className="rounded-xl border border-sky-100 px-3 py-2 text-sm">
                      <option value="clear">☀️ Bình thường</option>
                      <option value="hot">🔥 Nóng</option>
                      <option value="cold">❄️ Lạnh</option>
                      <option value="rain">🌧️ Mưa</option>
                      <option value="cloudy">☁️ Nhiều mây</option>
                    </select>
                    <label className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
                      <input type="checkbox" checked={editDiaryForm.acClimateActive} onChange={(event) => setEditDiaryForm({ ...editDiaryForm, acClimateActive: event.target.checked })} />
                      Điều hòa đang bật
                    </label>
                    <textarea value={editDiaryForm.note} onChange={(event) => setEditDiaryForm({ ...editDiaryForm, note: event.target.value })} placeholder="Cập nhật ghi chú hoặc điều kiện chuyến đi..." className="col-span-2 min-h-20 rounded-xl border border-sky-100 px-3 py-2 text-sm" />
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setEditingDiaryId(null)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-600">Hủy</button>
                      <button type="submit" className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-bold text-white">Lưu cập nhật</button>
                    </div>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
        {visibleDiaryEntries.length > 8 && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setDiaryShowAll((value) => !value)}
              className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200"
            >
              {diaryShowAll ? "Thu gọn" : "Xem tất cả"}
            </button>
          </div>
        )}
      </Section>

      <Section
        title="Tổng quan sức khỏe pin"
        hint="Trang này gom tất cả thông tin dễ hiểu về pin: dung lượng thực tế, tốc độ sạc nhanh, mức tiêu hao, và các dấu hiệu tụt pin nhanh."
      >
        <div className="mb-3 rounded-2xl bg-sky-50 border border-sky-100 px-3 py-2.5 text-xs text-sky-700">
          {latestAnomaly
            ? `Lần cảnh báo gần nhất: ${latestAnomaly.severityMultiplier.toFixed(2)}x so với chuẩn model ${activeModel.name}. ${latestAnomaly.weatherRelated ? "Có yếu tố thời tiết." : "Nên kiểm tra pin tại xưởng."}`
            : `Chưa ghi nhận cảnh báo tụt pin nhanh. Tiếp tục thu thập dữ liệu để đánh giá chính xác hơn.`}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="SoH ước tính" value={latestEstimate ? `${latestEstimate.estimatedSoh.toFixed(1)}%` : "--"} sub={latestEstimate ? `Cập nhật ${formatDate(latestEstimate.date)}` : "Cần thêm phiên sạc AC"} tone="text-blue-700" />
          <StatCard label="Dung lượng thực" value={latestEstimate ? `${latestEstimate.estimatedPackKwh.toFixed(2)} kWh` : "--"} sub="Nếu giảm dần theo thời gian, pin đang yếu đi" />
          <StatCard label="DC peak gần nhất" value={battery.dcPeakPowerHistory[0] ? `${battery.dcPeakPowerHistory[0].peakPowerKw.toFixed(1)} kW` : "--"} sub="Theo dõi khả năng sạc nhanh của pin" tone="text-emerald-700" />
          <StatCard label="Tiêu hao trung bình" value={rangeSummary.avgKwhPer100km ? `${rangeSummary.avgKwhPer100km.toFixed(1)} kWh` : "--"} sub={`Chuẩn model: ${activeModel.expectedKwhPer100km} kWh/100km`} tone="text-orange-700" />
        </div>
      </Section>

      <Section
        title="Model xe và cấu hình mặc định"
        hint="App dùng cấu hình theo model xe để tính SoH, tiêu hao và cảnh báo. VF5 được tạo sẵn. Nếu bạn muốn theo dõi xe khác, có thể thêm model custom."
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
            <select
              value={battery.activeModelId}
              onChange={(event) => setActiveVehicleModel(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
            >
              {battery.vehicleModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
            <button onClick={openAddModelForm} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-100">
              Thêm model
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={openEditModelForm}
                disabled={selectedModel.isBuiltIn}
                className="rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sửa model
              </button>
              <button onClick={() => setShowReport(true)} className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white hover:bg-gray-800">
                Tạo báo cáo
              </button>
            </div>
          </div>
          {selectedModel.isBuiltIn && (
            <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              {selectedModel.name} là model mặc định hệ thống. Bạn có thể thêm model custom để tùy chỉnh thông số riêng.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <StatCard label="Dung lượng danh nghĩa" value={`${activeModel.nominalCapacityKwh} kWh`} />
            <StatCard label="Hiệu suất AC" value={`${Math.round(activeModel.acChargerEfficiency * 100)}%`} />
            <StatCard label="Tiêu hao chuẩn" value={`${activeModel.expectedKwhPer100km} kWh`} />
            <StatCard label="DC max chuẩn" value={`${activeModel.maxDcPowerKw} kW`} />
            <StatCard label="Loại pin" value={activeModel.batteryChemistry} />
          </div>

          {showModelForm && (
            <form onSubmit={handleSaveModel} className="grid grid-cols-2 gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
              <div className="col-span-2 text-xs text-blue-700 font-bold">
                {modelFormMode === "edit" ? "Chỉnh sửa model custom" : "Tạo model custom mới"}
              </div>
              <input value={modelForm.name} onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })} placeholder="Tên model" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
              <input value={modelForm.nominalCapacityKwh} onChange={(event) => setModelForm({ ...modelForm, nominalCapacityKwh: event.target.value })} placeholder="Dung lượng danh nghĩa (kWh)" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
              <input value={modelForm.acChargerEfficiency} onChange={(event) => setModelForm({ ...modelForm, acChargerEfficiency: event.target.value })} placeholder="Hiệu suất AC" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
              <input value={modelForm.expectedKwhPer100km} onChange={(event) => setModelForm({ ...modelForm, expectedKwhPer100km: event.target.value })} placeholder="Tiêu hao kỳ vọng" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
              <input value={modelForm.maxDcPowerKw} onChange={(event) => setModelForm({ ...modelForm, maxDcPowerKw: event.target.value })} placeholder="DC max (kW)" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
              <input value={modelForm.batteryChemistry} onChange={(event) => setModelForm({ ...modelForm, batteryChemistry: event.target.value })} placeholder="Hóa học pin" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
              <input value={modelForm.anomalyThresholdMultiplier} onChange={(event) => setModelForm({ ...modelForm, anomalyThresholdMultiplier: event.target.value })} placeholder="Ngưỡng cảnh báo" className="rounded-xl border border-blue-100 px-3 py-2 text-sm" />
              {modelFormError && (
                <div className="col-span-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                  {modelFormError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModelForm(false);
                    setEditingModelId(null);
                    setModelFormError("");
                  }}
                  className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-600 border border-gray-200"
                >
                  Hủy
                </button>
                <button type="submit" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">
                  {modelFormMode === "edit" ? "Cập nhật model" : "Lưu model"}
                </button>
              </div>
            </form>
          )}

          {battery.vehicleModels.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {battery.vehicleModels.filter((model) => !model.isBuiltIn).map((model) => (
                <button key={model.id} onClick={() => deleteVehicleModel(model.id)} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-red-50 hover:text-red-600">
                  Xóa model {model.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Dung lượng pin thực từ phiên sạc AC" hint="Nếu một lần sạc AC tăng đủ nhiều % pin, app sẽ tự tính ra pin đang chứa được bao nhiêu kWh thực tế. Đây là chỉ số dễ hiểu nhất để xem pin có xuống cấp không.">
        <Sparkline values={capacityTrend.map((entry) => entry.estimatedPackKwh)} color="#2563eb" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setCapSourceFilter("all");
              setCapShowAll(false);
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold ${capSourceFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Tất cả
          </button>
          <button
            onClick={() => {
              setCapSourceFilter("live");
              setCapShowAll(false);
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold ${capSourceFilter === "live" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600"}`}
          >
            Live log
          </button>
          <button
            onClick={() => {
              setCapSourceFilter("linked");
              setCapShowAll(false);
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold ${capSourceFilter === "linked" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}
          >
            API linked
          </button>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={capSortMode}
              onChange={(event) => {
                setCapSortMode(event.target.value);
                setCapShowAll(false);
              }}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-gray-700"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="soh_desc">SoH cao → thấp</option>
              <option value="soh_asc">SoH thấp → cao</option>
              <option value="capacity_desc">Capacity cao → thấp</option>
              <option value="capacity_asc">Capacity thấp → cao</option>
            </select>
            <div className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
              {displayedCapacityEstimates.length}/{visibleCapacityEstimates.length} phiên
            </div>
            <button
              onClick={() => setSocBarScale((value) => (value === "full" ? "data" : "full"))}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${socBarScale === "full" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}
            >
              {socBarScale === "full" ? "SOC 0-100" : `SOC ${socScaleMin}-${socScaleMax}`}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {visibleCapacityEstimates.length === 0 ? (
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">Chưa có dữ liệu. Hãy hoàn thành vài phiên sạc AC tăng ít nhất 20% pin để app tự tính.</div>
          ) : (
            displayedCapacityEstimates.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-gray-100 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-gray-800">{formatDate(entry.date)} · {entry.socStart}% → {entry.socEnd}%</div>
                      {entry.sourceHistoryId ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700">API</span>
                      ) : entry.sourceLogId ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">Live</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">Điện vào pin {entry.packEnergyKwh.toFixed(2)} kWh · Điện lưới {entry.gridEnergyKwh?.toFixed(2) ?? "--"} kWh</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-blue-700">{entry.estimatedPackKwh.toFixed(2)} kWh</div>
                    <div className="text-xs text-gray-500">SoH {entry.estimatedSoh.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="relative h-2 rounded-full bg-gray-100">
                    <div
                      className="absolute inset-y-0 rounded-full bg-blue-400"
                      style={{
                        left: `${Math.max(0, Math.min(100, ((Math.min(Number(entry.socStart), Number(entry.socEnd)) - socScaleMin) / Math.max(1, socScaleMax - socScaleMin)) * 100))}%`,
                        width: `${Math.max(2, Math.min(100, (Math.abs(Number(entry.socEnd) - Number(entry.socStart)) / Math.max(1, socScaleMax - socScaleMin)) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                    <span>{socScaleMin}%</span>
                    <span>{socScaleMax}%</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {visibleCapacityEstimates.length > 5 && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setCapShowAll((value) => !value)}
              className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200"
            >
              {capShowAll ? "Thu gọn" : "Xem tất cả"}
            </button>
          </div>
        )}
      </Section>

      <Section title="Tốc độ sạc DC tối đa" hint="Nếu tốc độ sạc nhanh DC giảm dần theo thời gian, đó có thể là dấu hiệu BMS đang bảo vệ pin nhiều hơn trước.">
        <Sparkline values={dcTrend.map((entry) => entry.peakPowerKw)} color="#10b981" />
        <div className="mt-3 space-y-2">
          {battery.dcPeakPowerHistory.length === 0 ? (
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">Chưa có dữ liệu sạc DC.</div>
          ) : (
            battery.dcPeakPowerHistory.slice(0, 5).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-gray-100 px-3 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-800">{formatDate(entry.date)}</div>
                  <div className="text-xs text-gray-500">SoC tại peak {entry.socAtPeak === null ? "--" : `${Math.round(entry.socAtPeak)}%`}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-emerald-700">{entry.peakPowerKw.toFixed(1)} kW</div>
                  <div className="text-xs text-gray-500">{entry.cRate.toFixed(2)}C · Chuẩn {activeModel.maxDcPowerKw} kW</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="Cảnh báo tụt pin nhanh" hint="Nếu xe dùng nhiều điện hơn mức kỳ vọng của model, app sẽ cảnh báo. App cũng cố gắng phân biệt trường hợp do thời tiết nóng/lạnh với trường hợp nên kiểm tra pin.">
        <div className="space-y-2">
          {battery.socDropAnomalies.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">Không phát hiện bất thường trong dữ liệu hiện tại.</div>
          ) : (
            battery.socDropAnomalies.slice(0, 6).map((entry) => (
              <div key={entry.id} className={`rounded-xl px-3 py-3 ${entry.weatherRelated ? "bg-amber-50 border border-amber-100" : "bg-red-50 border border-red-100"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-sm font-black ${entry.weatherRelated ? "text-amber-700" : "text-red-700"}`}>{formatDate(entry.timestamp)} · {entry.severityMultiplier.toFixed(2)}x bình thường</div>
                    <div className="text-xs text-gray-600 mt-1">{entry.socStart}% → {entry.socEnd}% · {entry.distanceKm.toFixed(1)} km · {formatDuration(entry.durationMinutes)}</div>
                    <div className="text-xs text-gray-600 mt-1">Tiêu hao thực {entry.actualKwhPer100km.toFixed(1)} kWh/100km · kỳ vọng {entry.expectedKwhPer100km.toFixed(1)} kWh/100km</div>
                  </div>
                  <div className={`text-xs font-bold ${entry.weatherRelated ? "text-amber-700" : "text-red-700"}`}>
                    {entry.weatherRelated ? "Có thể do thời tiết" : "Nên kiểm tra pin"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="Thông tin pin hiện tại" hint="Đây là các chỉ số BMS đang gửi về ngay lúc này. Nếu chênh lệch điện áp hoặc nhiệt độ giữa các cell tăng cao, đó là dấu hiệu nên theo dõi kỹ hơn.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="SoH từ xe" value={vehicle.soh_percentage === null || vehicle.soh_percentage === undefined ? "--" : `${Math.round(Number(vehicle.soh_percentage))}%`} tone={sohHealth === "excellent" || sohHealth === "good" ? "text-emerald-700" : "text-orange-700"} />
          <StatCard label="Δ điện áp cell" value={cellVoltageDelta === null ? "--" : `${cellVoltageDelta} mV`} tone={voltageHealth === "excellent" || voltageHealth === "good" ? "text-emerald-700" : "text-orange-700"} />
          <StatCard label="Δ nhiệt độ cell" value={cellTempDelta === null ? "--" : `${cellTempDelta}°C`} tone={tempHealth === "excellent" || tempHealth === "good" ? "text-emerald-700" : "text-orange-700"} />
          <StatCard label="Cân bằng cell" value={Number(vehicle.bms_balance_active) === 1 ? "Đang cân bằng" : "Đang nghỉ"} />
          <StatCard label="Nhiệt độ ngoài trời" value={vehicle.outside_temp === null || vehicle.outside_temp === undefined ? "--" : `${Number(vehicle.outside_temp).toFixed(1)}°C`} />
          <StatCard label="Nhiệt độ pack" value={vehicle.bms_pack_temp === null || vehicle.bms_pack_temp === undefined ? "--" : `${Number(vehicle.bms_pack_temp).toFixed(1)}°C`} />
        </div>
      </Section>

      <BatteryReportModal open={showReport} onClose={() => setShowReport(false)} payload={reportPayload} />
    </div>
  );
}