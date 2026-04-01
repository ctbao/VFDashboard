import React, { useMemo } from "react";
import { generateBatteryReportHtml, generateBatteryReportText } from "../utils/batteryReportTemplate";

function downloadHtml(html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `battery-health-report-${Date.now()}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BatteryReportModal({ open, onClose, payload }) {
  const html = useMemo(() => generateBatteryReportHtml(payload), [payload]);
  const text = useMemo(() => generateBatteryReportText(payload), [payload]);

  if (!open) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore if clipboard is blocked.
    }
  }

  async function handleShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: "Báo cáo sức khỏe pin", text });
    } catch {
      // User cancelled.
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-label="Đóng" />
      <div className="relative w-full md:max-w-5xl bg-white rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-900">Báo cáo sức khỏe pin</h3>
            <p className="text-xs text-gray-500">Tạo tự động từ dữ liệu sạc, telemetry và nhật ký quãng đường.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <button onClick={handleCopy} className="px-3 py-2 rounded-xl text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100">Sao chép nội dung</button>
          <button onClick={() => downloadHtml(html)} className="px-3 py-2 rounded-xl text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100">Tải HTML</button>
          {navigator.share && (
            <button onClick={handleShare} className="px-3 py-2 rounded-xl text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100">Chia sẻ</button>
          )}
        </div>

        <div className="flex-1 min-h-[60dvh] bg-gray-100">
          <iframe title="Battery report preview" srcDoc={html} className="w-full h-full border-0 bg-white" />
        </div>
      </div>
    </div>
  );
}