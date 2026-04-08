import { useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { batteryHealthStore, updateTrackerConfig } from "../stores/batteryHealthStore";
import {
  discardActiveTrip,
  extendTripCountdown,
  pauseTripManually,
  resumeTripManually,
  saveAndStartNewTrip,
  startBatteryTracker,
  startTripManually,
  stopBatteryTracker,
  stopTripNow,
  trackerStatusStore,
} from "../services/batteryTracker";

function formatClock(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 phút";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m} phút`;
}

function formatRestoreAge(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "vừa xong";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  return `${hours} giờ trước`;
}

export default function ActiveTripCard() {
  const tracker = useStore(trackerStatusStore);
  const battery = useStore(batteryHealthStore);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdownMs = tracker.countdownEndsAt ? Math.max(0, tracker.countdownEndsAt - now) : 0;
  const idleTimeoutMinutes = Math.max(1, Math.round((battery.trackerConfig?.idleTimeoutMs ?? tracker.idleTimeoutMs ?? 300000) / 60000));
  const countdownDurationMinutes = Math.max(1, Math.round((battery.trackerConfig?.countdownDurationMs ?? tracker.countdownDurationMs ?? 300000) / 60000));

  const statusMeta = useMemo(() => {
    if (tracker.needsResumePrompt) {
      return {
        label: "Phát hiện chuyến đi chưa hoàn tất",
        sub: `App đã khôi phục dữ liệu từ ${formatRestoreAge(tracker.restoreAgeMs)}. Bạn có thể tiếp tục, lưu lại rồi bắt đầu chuyến mới, hoặc bỏ qua.`,
        toneClass: "border-amber-200 bg-amber-50 text-amber-800",
        dotClass: "bg-amber-500 animate-pulse",
      };
    }
    if (!tracker.running) {
      return {
        label: "Tracker đang dừng",
        sub: "Bật tracker để tiếp tục theo dõi tự động trên Android.",
        toneClass: "border-gray-200 bg-gray-50 text-gray-700",
        dotClass: "bg-gray-400",
      };
    }
    if (tracker.tripState === "driving") {
      return {
        label: "Đang ghi nhận chuyến đi",
        sub: "Dữ liệu chuyến đi đang được lưu tạm ngay trên máy để tránh mất khi tắt màn hình.",
        toneClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
        dotClass: "bg-emerald-500 animate-pulse",
      };
    }
    if (tracker.tripState === "countdown") {
      return {
        label: `Đang chờ tự lưu · còn ${formatClock(countdownMs)}`,
        sub: `Xe đang dừng lâu. Sau ${countdownDurationMinutes} phút đếm ngược, app sẽ tự kết thúc chuyến nếu xe chưa chạy lại.`,
        toneClass: "border-sky-200 bg-sky-50 text-sky-800",
        dotClass: "bg-sky-500",
      };
    }
    if (tracker.tripState === "paused") {
      return {
        label: tracker.pauseMode === "manual" ? "Chuyến đi đang tạm dừng thủ công" : "Xe đang dừng tạm · chưa kết thúc chuyến",
        sub: tracker.pauseMode === "manual"
          ? "Bạn đã chủ động tạm dừng. Chọn tiếp tục hoặc lưu ngay khi cần."
          : `App sẽ bắt đầu đếm ngược sau ${idleTimeoutMinutes} phút đứng yên để tránh tách chuyến khi dừng đèn đỏ / kẹt xe.`,
        toneClass: "border-amber-200 bg-amber-50 text-amber-800",
        dotClass: "bg-amber-500",
      };
    }
    return {
      label: "Sẵn sàng ghi chuyến mới",
      sub: battery.autoRecordEnabled ? "Khi xe di chuyển, app sẽ tự bắt đầu ghi nhận." : "Auto record đang tắt. Bạn có thể bắt đầu thủ công.",
      toneClass: "border-slate-200 bg-slate-50 text-slate-700",
      dotClass: "bg-slate-400",
    };
  }, [battery.autoRecordEnabled, countdownDurationMinutes, countdownMs, idleTimeoutMinutes, tracker.needsResumePrompt, tracker.pauseMode, tracker.restoreAgeMs, tracker.running, tracker.tripState]);

  const metrics = [
    { label: "SoC", value: tracker.socStart !== null && tracker.socCurrent !== null ? `${Math.round(tracker.socStart)}% → ${Math.round(tracker.socCurrent)}%` : "--" },
    { label: "Quãng đường", value: Number.isFinite(tracker.distanceKm) ? `${tracker.distanceKm.toFixed(1)} km` : "--" },
    { label: "Tiêu hao tạm tính", value: Number.isFinite(tracker.liveKwhPer100km) && tracker.distanceKm > 0 ? `${tracker.liveKwhPer100km.toFixed(1)} kWh/100km` : "--" },
    { label: "Nhiệt độ ngoài trời", value: tracker.outsideTempC === null || tracker.outsideTempC === undefined ? "--" : `${Number(tracker.outsideTempC).toFixed(1)}°C` },
    { label: "Tốc độ hiện tại", value: Number.isFinite(tracker.currentSpeed) ? `${Math.round(tracker.currentSpeed)} km/h` : "--" },
    { label: "Thời lượng chạy", value: formatDuration(tracker.elapsedMinutes) },
  ];

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`mb-3 rounded-2xl border px-3 py-3 ${statusMeta.toneClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusMeta.dotClass}`} />
              <span>{statusMeta.label}</span>
            </div>
            <div className="mt-1 text-xs leading-relaxed opacity-90">{statusMeta.sub}</div>
          </div>
          <button
            type="button"
            onClick={() => (tracker.running ? stopBatteryTracker() : startBatteryTracker())}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${tracker.running ? "border border-red-200 bg-white text-red-600 hover:bg-red-50" : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}
          >
            {tracker.running ? "Dừng tracker" : "Bật tracker"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-wide text-gray-400">{item.label}</div>
            <div className="mt-1 text-sm font-black text-gray-800">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!tracker.tripInProgress && !tracker.needsResumePrompt && (
          <button onClick={startTripManually} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
            Bắt đầu ghi thủ công
          </button>
        )}

        {tracker.tripState === "driving" && (
          <button onClick={pauseTripManually} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100">
            Tạm dừng thủ công
          </button>
        )}

        {(tracker.tripState === "paused" || tracker.tripState === "countdown") && !tracker.needsResumePrompt && (
          <button onClick={resumeTripManually} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
            Tiếp tục chuyến đi
          </button>
        )}

        {tracker.tripState === "countdown" && !tracker.needsResumePrompt && (
          <button onClick={() => extendTripCountdown(5 * 60 * 1000)} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100">
            Gia hạn +5 phút
          </button>
        )}

        {(tracker.tripInProgress || tracker.needsResumePrompt) && (
          <button onClick={stopTripNow} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">
            Lưu và dừng ngay
          </button>
        )}

        {(tracker.tripInProgress || tracker.needsResumePrompt) && (
          <button onClick={saveAndStartNewTrip} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
            Lưu & bắt đầu mới
          </button>
        )}

        {tracker.needsResumePrompt && (
          <>
            <button onClick={resumeTripManually} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
              Khôi phục chuyến đi
            </button>
            <button onClick={discardActiveTrip} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">
              Bỏ chuyến cũ
            </button>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <div className="font-bold text-gray-800">Bắt đầu đếm ngược sau khi dừng</div>
          <select
            value={String(battery.trackerConfig?.idleTimeoutMs ?? tracker.idleTimeoutMs ?? 300000)}
            onChange={(event) => updateTrackerConfig({ idleTimeoutMs: Number(event.target.value) })}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="120000">2 phút</option>
            <option value="300000">5 phút</option>
            <option value="600000">10 phút</option>
            <option value="900000">15 phút</option>
          </select>
        </label>

        <label className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <div className="font-bold text-gray-800">Thời gian tự lưu sau khi dừng lâu</div>
          <select
            value={String(battery.trackerConfig?.countdownDurationMs ?? tracker.countdownDurationMs ?? 300000)}
            onChange={(event) => updateTrackerConfig({ countdownDurationMs: Number(event.target.value) })}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="120000">2 phút</option>
            <option value="300000">5 phút</option>
            <option value="600000">10 phút</option>
            <option value="900000">15 phút</option>
          </select>
        </label>
      </div>
    </section>
  );
}
