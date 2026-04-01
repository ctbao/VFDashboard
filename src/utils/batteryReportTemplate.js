function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function fmtDate(value) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleDateString("vi-VN");
  } catch {
    return "--";
  }
}

function fmtNumber(value, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? "--"
    : Number(value).toFixed(digits);
}

export function generateBatteryReportHtml({ vehicle, model, latestEstimate, capacityEstimates, anomalies, dcPeaks, rangeDiary }) {
  const capacityRows = capacityEstimates.length > 0
    ? capacityEstimates.map((entry) => `
        <tr>
          <td>${esc(fmtDate(entry.date))}</td>
          <td>${esc(`${Math.round(entry.socStart)}%`)}</td>
          <td>${esc(`${Math.round(entry.socEnd)}%`)}</td>
          <td>${esc(`${fmtNumber(entry.deltaSoc, 1)}%`)}</td>
          <td>${esc(fmtNumber(entry.gridEnergyKwh, 2))}</td>
          <td>${esc(fmtNumber(entry.packEnergyKwh, 2))}</td>
          <td>${esc(fmtNumber(entry.estimatedPackKwh, 2))}</td>
          <td>${esc(`${fmtNumber(entry.estimatedSoh, 1)}%`)}</td>
        </tr>`).join("")
    : `<tr><td colspan="8">Chưa có đủ dữ liệu sạc AC để tính dung lượng.</td></tr>`;

  const anomalyRows = anomalies.length > 0
    ? anomalies.map((entry) => `
        <tr>
          <td>${esc(fmtDate(entry.timestamp))}</td>
          <td>${esc(`${Math.round(entry.socStart)}% -> ${Math.round(entry.socEnd)}%`)}</td>
          <td>${esc(fmtNumber(entry.distanceKm, 1))}</td>
          <td>${esc(fmtNumber(entry.durationMinutes, 0))}</td>
          <td>${esc(fmtNumber(entry.actualKwhPer100km, 1))}</td>
          <td>${esc(`${fmtNumber(entry.severityMultiplier, 2)}x`)}</td>
          <td>${esc(entry.weatherRelated ? "Có thể do thời tiết" : "Cần kiểm tra")}</td>
        </tr>`).join("")
    : `<tr><td colspan="7">Chưa phát hiện sự kiện tụt pin bất thường.</td></tr>`;

  const dcRows = dcPeaks.length > 0
    ? dcPeaks.map((entry) => `
        <tr>
          <td>${esc(fmtDate(entry.date))}</td>
          <td>${esc(fmtNumber(entry.peakPowerKw, 1))}</td>
          <td>${esc(fmtNumber(entry.cRate, 2))}</td>
          <td>${esc(entry.socAtPeak === null ? "--" : `${Math.round(entry.socAtPeak)}%`)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4">Chưa có dữ liệu sạc DC.</td></tr>`;

  const tripRows = rangeDiary.length > 0
    ? rangeDiary.map((entry) => `
        <tr>
          <td>${esc(fmtDate(entry.timestamp))}</td>
          <td>${esc(`${Math.round(entry.socStart)}% -> ${Math.round(entry.socEnd)}%`)}</td>
          <td>${esc(fmtNumber(entry.distanceKm, 1))}</td>
          <td>${esc(fmtNumber(entry.durationMinutes, 0))}</td>
          <td>${esc(entry.weatherCondition || "--")}</td>
          <td>${esc(entry.outsideTempC === null || entry.outsideTempC === undefined ? "--" : `${fmtNumber(entry.outsideTempC, 1)}°C`)}</td>
          <td>${esc(fmtNumber(entry.kwhPer100km, 1))}</td>
        </tr>`).join("")
    : `<tr><td colspan="7">Chưa có nhật ký quãng đường.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Báo cáo sức khỏe pin</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #eef3f8; color: #18212f; padding: 20px; }
    .container { max-width: 960px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(15,23,42,0.08); }
    header { background: linear-gradient(135deg, #0f3d63, #1a6ea0); color: #fff; padding: 32px; }
    header h1 { font-size: 24px; margin: 0 0 8px; }
    header p { margin: 0; opacity: 0.9; }
    .content { padding: 28px 32px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
    .stat strong { display: block; font-size: 26px; margin-top: 6px; color: #0f3d63; }
    h2 { font-size: 18px; color: #0f3d63; margin: 28px 0 12px; }
    p.note { background: #f0f7ff; border-left: 4px solid #60a5fa; padding: 12px 14px; border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; }
    th { background: #0f3d63; color: #fff; }
    td:first-child { text-align: left; }
    .muted { color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Báo cáo sức khỏe pin</h1>
      <p>${esc(model.name)} · VIN ${esc(vehicle.vin || "--")} · Odometer ${esc(vehicle.odometer ? `${Math.round(vehicle.odometer)} km` : "--")}</p>
    </header>
    <div class="content">
      <div class="stats">
        <div class="stat"><span class="muted">SoH ước tính mới nhất</span><strong>${esc(latestEstimate ? `${fmtNumber(latestEstimate.estimatedSoh, 1)}%` : "--")}</strong></div>
        <div class="stat"><span class="muted">Dung lượng ước tính</span><strong>${esc(latestEstimate ? `${fmtNumber(latestEstimate.estimatedPackKwh, 2)} kWh` : "--")}</strong></div>
        <div class="stat"><span class="muted">Tiêu hao kỳ vọng</span><strong>${esc(`${fmtNumber(model.expectedKwhPer100km, 1)} kWh/100km`)}</strong></div>
        <div class="stat"><span class="muted">DC max theo model</span><strong>${esc(`${fmtNumber(model.maxDcPowerKw, 1)} kW`)}</strong></div>
      </div>

      <p class="note">Báo cáo này được tạo tự động từ dữ liệu sạc, telemetry pin và nhật ký quãng đường của ứng dụng. Các mục được viết theo ngôn ngữ dễ hiểu để người dùng không chuyên vẫn có thể đối chiếu với xưởng hoặc hãng.</p>

      <h2>1. Dung lượng pin thực từ các phiên sạc AC</h2>
      <table>
        <thead><tr><th>Ngày</th><th>SoC đầu</th><th>SoC cuối</th><th>Δ SoC</th><th>Điện lưới</th><th>Vào pin</th><th>Dung lượng ước tính</th><th>SoH</th></tr></thead>
        <tbody>${capacityRows}</tbody>
      </table>

      <h2>2. Sự kiện tụt pin nhanh</h2>
      <table>
        <thead><tr><th>Ngày</th><th>SoC</th><th>Quãng đường</th><th>Thời gian</th><th>Tiêu hao thực</th><th>Mức bất thường</th><th>Nhận xét</th></tr></thead>
        <tbody>${anomalyRows}</tbody>
      </table>

      <h2>3. Tốc độ sạc DC tối đa</h2>
      <table>
        <thead><tr><th>Ngày</th><th>Peak kW</th><th>C-rate</th><th>SoC tại peak</th></tr></thead>
        <tbody>${dcRows}</tbody>
      </table>

      <h2>4. Nhật ký quãng đường và điều kiện sử dụng</h2>
      <table>
        <thead><tr><th>Ngày</th><th>SoC</th><th>Km</th><th>Phút</th><th>Thời tiết</th><th>Nhiệt độ</th><th>kWh/100km</th></tr></thead>
        <tbody>${tripRows}</tbody>
      </table>

      <h2>5. Trạng thái pin hiện tại</h2>
      <p>SoH từ xe: <strong>${esc(vehicle.soh_percentage === null || vehicle.soh_percentage === undefined ? "--" : `${Math.round(vehicle.soh_percentage)}%`)}</strong> · Nhiệt độ ngoài trời: <strong>${esc(vehicle.outside_temp === null || vehicle.outside_temp === undefined ? "--" : `${fmtNumber(vehicle.outside_temp, 1)}°C`)}</strong> · Công suất sạc hiện tại: <strong>${esc(vehicle.charging_power_kw === null || vehicle.charging_power_kw === undefined ? "--" : `${fmtNumber(vehicle.charging_power_kw, 1)} kW`)}</strong></p>
    </div>
  </div>
</body>
</html>`;
}

export function generateBatteryReportText({ vehicle, model, latestEstimate, anomalies, rangeDiary }) {
  return [
    "BAO CAO SUC KHOE PIN",
    `${model.name} | VIN ${vehicle.vin || "--"} | Odometer ${vehicle.odometer ? `${Math.round(vehicle.odometer)} km` : "--"}`,
    "",
    `SoH uoc tinh moi nhat: ${latestEstimate ? `${fmtNumber(latestEstimate.estimatedSoh, 1)}%` : "--"}`,
    `Dung luong uoc tinh: ${latestEstimate ? `${fmtNumber(latestEstimate.estimatedPackKwh, 2)} kWh` : "--"}`,
    `Tieu hao ky vong: ${fmtNumber(model.expectedKwhPer100km, 1)} kWh/100km`,
    "",
    `So su kien tut pin nhanh: ${anomalies.length}`,
    `So ban ghi nhat ky quang duong: ${rangeDiary.length}`,
  ].join("\n");
}