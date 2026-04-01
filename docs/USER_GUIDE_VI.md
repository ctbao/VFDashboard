# Hướng Dẫn Sử Dụng VFDashboard

Tài liệu này dành cho người dùng cuối muốn theo dõi xe VinFast bằng VFDashboard trên web, desktop hoặc Android.

## 1. VFDashboard là gì?

VFDashboard là ứng dụng cộng đồng giúp bạn theo dõi xe điện VinFast theo thời gian thực. Ứng dụng tập trung vào 3 nhóm nhu cầu chính:

- Xem nhanh trạng thái xe: pin, tầm hoạt động, cửa, lốp, điều hòa.
- Theo dõi quá trình sạc: công suất, điện áp, dòng điện, log phiên sạc.
- Đánh giá sức khỏe pin theo thời gian: dung lượng thực tế, tốc độ sạc DC, tiêu hao năng lượng, các dấu hiệu tụt pin bất thường.

## 2. Lưu ý trước khi dùng

- Đây là dự án cộng đồng, không phải ứng dụng chính thức của VinFast.
- Chỉ đăng nhập khi bạn hiểu rõ rủi ro và tin tưởng bản build đang dùng.
- Nên dùng bản phát hành từ repository chính thức của dự án.
- Dữ liệu hiển thị phụ thuộc vào API và telemetry mà xe đang gửi về, nên có lúc một số chỉ số sẽ trống hoặc cập nhật chậm.

## 3. Đăng nhập và bắt đầu

1. Mở ứng dụng hoặc website VFDashboard.
2. Đăng nhập bằng tài khoản VinFast Connected Car.
3. Sau khi đăng nhập thành công, ứng dụng sẽ tải danh sách xe và dữ liệu telemetry gần nhất.
4. Nếu bạn có nhiều xe, dùng bộ chọn xe để chuyển nhanh giữa các xe.

Nếu vừa đăng nhập mà chưa thấy dữ liệu:
- Chờ vài giây để MQTT kết nối.
- Kiểm tra kết nối Internet.
- Thử mở lại ứng dụng nếu phiên đăng nhập cũ đã hết hạn.

## 4. Màn hình Dashboard

Dashboard là nơi xem nhanh tình trạng xe hiện tại.

Bạn sẽ thường thấy các nhóm thông tin sau:
- Mức pin hiện tại (SOC).
- Quãng đường còn lại.
- Tình trạng cửa, khóa, lốp, điều hòa.
- Một số cảnh báo an toàn nếu có.
- Thẻ Charging Live khi xe đang sạc hoặc vừa có log sạc gần đây.

Khi chỉ cần kiểm tra nhanh xe có đang ổn hay không, đây là màn hình nên xem đầu tiên.

## 5. Charging Live

Charging Live là màn hình theo dõi phiên sạc theo thời gian thực.

### 5.1. Tab Live

Tab Live hiển thị dữ liệu đang thay đổi liên tục trong lúc xe sạc:
- SOC hiện tại.
- Công suất sạc (kW).
- Điện áp (V) và dòng điện (A).
- Thời gian còn lại đến mức pin mục tiêu.
- Chênh lệch điện áp cell và nhiệt độ cell.
- Một số chỉ số BMS như SOH, nhiệt độ pack, cân bằng cell.

Các trạng thái đáng chú ý:
- `Live`: dữ liệu MQTT đang tươi.
- `Reconnecting`: ứng dụng đang tự kết nối lại MQTT.
- `MQTT offline`: hiện không có telemetry mới.
- `REC`: phiên sạc đang được ghi log.
- `AC` hoặc `DC`: loại đầu sạc đang phát hiện được.

### 5.2. Tốc độ lấy mẫu

Bạn có thể đổi chu kỳ ghi snapshot của phiên sạc:
- 5 giây
- 10 giây
- 30 giây
- 60 giây
- 2 phút

Gợi ý sử dụng:
- Dùng 5 giây hoặc 10 giây nếu bạn muốn phân tích kỹ quá trình tăng/giảm công suất.
- Dùng 30 giây hoặc 2 phút nếu chỉ cần log tổng quát cho phiên sạc dài.

### 5.3. Xuất log phiên sạc

Trong Charging Live, bạn có thể xuất dữ liệu để phân tích thêm:
- `Export CSV`: mở bằng Excel hoặc Google Sheets.
- `Export JSON`: phù hợp cho phân tích kỹ thuật hoặc backup.
- `Export All`: xuất toàn bộ phiên sạc đã lưu.
- `Import Log`: nhập lại log từ file JSON.

## 6. Log History

Tab Log History dùng để xem lại các phiên sạc đã ghi trước đó.

Mỗi phiên thường có:
- Thời gian bắt đầu/kết thúc.
- Khoảng SOC đầu và cuối.
- Công suất đỉnh.
- Năng lượng đã nạp.
- Điểm hoặc mức đánh giá sức khỏe phiên sạc.

Khi chạm vào một phiên sạc, bạn sẽ mở được cửa sổ chi tiết để xem:
- Tóm tắt toàn phiên.
- Biểu đồ SOC, công suất, chênh lệch cell.
- Bảng snapshot chi tiết theo thời gian.
- Liên kết với phiên charging history từ API.

## 7. Liên kết log sạc với Charging History API

Đây là một tính năng quan trọng nếu bạn muốn ước tính dung lượng pin sát hơn.

### 7.1. Liên kết để làm gì?

Log sạc nội bộ của app cho biết diễn biến theo thời gian, còn Charging History từ API có thể chứa số điện năng đã sạc theo hóa đơn hoặc trạm sạc, ví dụ `totalKWCharged`.

Khi liên kết 2 nguồn này, ứng dụng có thể:
- Gắn log sạc với một phiên charging history tương ứng.
- Dùng điện năng từ API để ước tính dung lượng pin thực tế chính xác hơn.
- Ghi nhận nguồn dữ liệu là `API linked` trong tab Sức khỏe.

### 7.2. Cách liên kết

1. Mở một phiên trong Log History.
2. Tìm phần `Linked History Sessions`.
3. Bấm `+ Link`.
4. Chọn phiên history phù hợp theo thời gian hoặc trạm sạc.
5. Nếu app gợi ý `Suggested`, đó là phiên có thời gian trùng hợp lý với log hiện tại.

Sau khi liên kết thành công:
- Phiên sẽ xuất hiện trong danh sách linked history.
- Capacity estimate mới có thể được tạo từ dữ liệu API.
- Tab Sức khỏe pin sẽ hiển thị bản ghi với badge `API`.

Nếu liên kết nhầm, bạn chỉ cần bấm dấu `×` để bỏ liên kết.

## 8. Tab Sức khỏe pin

Tab `Sức khỏe` trong Charging Live là nơi tổng hợp dữ liệu dài hạn của pin.

### 8.1. Tổng quan sức khỏe pin

Phần đầu màn hình cho bạn cái nhìn nhanh nhất về tình trạng pin:
- SoH ước tính.
- Dung lượng thực tế gần nhất.
- Công suất DC peak gần nhất.
- Mức tiêu hao trung bình.
- Cảnh báo tụt pin nhanh gần đây nhất nếu có.

Nếu chưa đủ dữ liệu, một số ô sẽ hiện `--`.

### 8.2. Model xe và cấu hình mặc định

Ứng dụng dùng model xe để tính toán các chỉ số như:
- Dung lượng danh nghĩa.
- Hiệu suất sạc AC.
- Mức tiêu hao kỳ vọng.
- Công suất DC tối đa kỳ vọng.
- Ngưỡng cảnh báo bất thường.

Bạn có thể:
- Chọn model đang dùng.
- Thêm model custom cho xe khác.
- Sửa model custom đã tạo.
- Xóa model custom nếu không cần nữa.
- Tạo báo cáo sức khỏe pin từ dữ liệu hiện có.

Lưu ý:
- Model hệ thống mặc định không cho sửa trực tiếp.
- Nếu thông số model không đúng với xe của bạn, các chỉ số ước tính sẽ lệch.

### 8.3. Dung lượng pin thực từ phiên sạc AC

Đây là phần quan trọng nhất để theo dõi độ chai pin.

Ứng dụng sẽ tạo capacity estimate khi có đủ điều kiện, ví dụ:
- Phiên sạc AC tăng đủ nhiều phần trăm pin.
- Hoặc log sạc đã được liên kết với charging history có dữ liệu điện năng từ API.

Mỗi bản ghi hiển thị:
- Ngày ghi nhận.
- SOC đầu và SOC cuối.
- Điện vào pin.
- Điện lưới nếu có.
- Dung lượng pin ước tính (kWh).
- SoH ước tính.
- Nguồn dữ liệu: `Live` hoặc `API`.

Bạn cũng có thể:
- Lọc theo nguồn: `Tất cả`, `Live log`, `API linked`.
- Sắp xếp theo: thời gian, SoH, capacity.
- Bấm `Xem tất cả` để mở toàn bộ lịch sử đã lưu.

Cách đọc nhanh:
- Nếu dung lượng thực giảm dần theo thời gian, pin đang lão hóa dần.
- Nếu SoH dao động mạnh giữa các phiên, hãy xem lại điều kiện sạc, model cấu hình và nguồn dữ liệu.
- Bản ghi `API` thường hữu ích khi bạn muốn đối chiếu với số điện năng từ lịch sử sạc.

### 8.4. Tốc độ sạc DC tối đa

Mục này giúp bạn theo dõi khả năng nhận sạc nhanh của pin theo thời gian.

Nếu DC peak giảm đều qua nhiều phiên trong điều kiện tương tự, đó có thể là dấu hiệu pin hoặc chiến lược bảo vệ pin đang thay đổi.

### 8.5. Nhật ký quãng đường vs SoC

Ứng dụng có thể theo dõi mức tiêu hao năng lượng qua chuyến đi.

Có 2 cách tạo dữ liệu:
- `Auto`: app tự ghi khi xe chạy và có đủ telemetry.
- `Manual`: bạn tự nhập khi muốn bổ sung một chuyến đi.

Bạn có thể:
- Bật/tắt auto record.
- Lọc theo `Tất cả`, `Auto`, `Manual`.
- Nhập thủ công quãng đường, thời lượng, nhiệt độ ngoài trời, ghi chú.

Mục đích của phần này là giúp bạn hiểu:
- Xe đang tiêu hao bao nhiêu kWh/100km trong thực tế.
- Thời tiết nóng/lạnh có làm tăng tiêu hao không.
- Điều hòa và kiểu hành trình có ảnh hưởng thế nào.

### 8.6. Cảnh báo tụt pin nhanh

Nếu app phát hiện mức tiêu hao thực tế cao bất thường so với model đã chọn, cảnh báo sẽ xuất hiện ở đây.

Ứng dụng cố gắng phân biệt 2 nhóm:
- Có thể do thời tiết nóng/lạnh.
- Có thể nên kiểm tra pin hoặc hệ thống liên quan.

Đây là vùng nên xem khi bạn thấy xe tụt pin nhanh bất thường trong sử dụng hàng ngày.

### 8.7. Thông tin pin hiện tại

Phần này hiển thị các số liệu BMS theo thời gian thực như:
- SoH từ xe.
- Chênh lệch điện áp cell.
- Chênh lệch nhiệt độ cell.
- Trạng thái cân bằng cell.
- Nhiệt độ ngoài trời.
- Nhiệt độ pack.

Nếu chênh lệch điện áp hoặc nhiệt độ tăng cao bất thường, bạn nên theo dõi thêm qua nhiều phiên sạc khác nhau.

## 9. Báo cáo sức khỏe pin

Trong tab Sức khỏe, nút `Tạo báo cáo` mở cửa sổ báo cáo tổng hợp.

Bạn có thể:
- `Sao chép nội dung`: lấy bản tóm tắt dạng text để gửi cho người khác.
- `Tải HTML`: lưu báo cáo thành file HTML để mở lại sau.
- `Chia sẻ`: dùng share sheet của thiết bị nếu được hỗ trợ.

Báo cáo thường tổng hợp các nhóm dữ liệu sau:
- Model xe đang chọn.
- Dung lượng pin và SoH gần nhất.
- Một số capacity estimate gần đây.
- Lịch sử DC peak.
- Nhật ký quãng đường.
- Cảnh báo tụt pin nhanh.

## 10. Mẹo sử dụng để dữ liệu đáng tin cậy hơn

- Kiểm tra lại model xe trước khi đọc kết luận về SoH.
- Với sạc AC, cố gắng để phiên sạc tăng SOC đủ lớn để app có thể tính tốt hơn.
- Nếu có charging history từ API, hãy liên kết log tương ứng để tận dụng `totalKWCharged`.
- Không nên kết luận từ chỉ 1 phiên sạc; hãy theo dõi theo xu hướng nhiều ngày hoặc nhiều tuần.
- Khi xem tiêu hao hành trình, nên chú ý nhiệt độ ngoài trời và điều hòa vì đây là yếu tố ảnh hưởng lớn.

## 11. Xử lý khi thấy dữ liệu thiếu hoặc sai

### Không có dữ liệu live
- Kiểm tra MQTT có đang `Live` hay không.
- Đợi xe gửi telemetry mới.
- Thử mở lại app nếu kết nối treo lâu.

### Không thấy log sạc mới
- Đảm bảo xe thực sự đang sạc.
- Kiểm tra app có badge `REC` trong lúc sạc.
- Trên Android, nếu cần ghi lâu khi tắt màn hình, nên giữ quyền chạy nền phù hợp.

### Không có capacity estimate
- Phiên sạc AC có thể chưa tăng đủ SOC.
- Model xe có thể đang cấu hình sai.
- Log chưa được liên kết với charging history phù hợp.

### Chỉ số SoH hoặc capacity dao động mạnh
- So sánh nhiều phiên khác nhau thay vì chỉ nhìn 1 lần.
- Kiểm tra nguồn bản ghi là `Live` hay `API`.
- Rà lại hiệu suất AC và dung lượng danh nghĩa trong model custom.

## 12. Quyền riêng tư và an toàn

- Chỉ dùng ứng dụng nếu bạn hiểu rõ đây là công cụ cộng đồng.
- Không chia sẻ file log hoặc báo cáo nếu trong đó có thông tin bạn muốn giữ riêng.
- Khi xuất file, hãy kiểm tra nội dung trước khi gửi cho người khác.

## 13. Tài liệu liên quan

- Tài liệu Charging Live chi tiết: `docs/CHARGING_LIVE_GUIDE.md`
- Hướng dẫn build Android: `docs/TAURI_ANDROID_SIGNING.md`
- Hướng dẫn build Windows: `docs/TAURI_WINDOWS_BUILD.md`

---

Nếu bạn là người dùng mới, thứ tự làm quen nên là:
1. Đăng nhập và kiểm tra Dashboard.
2. Mở Charging Live khi xe đang sạc.
3. Xem Log History sau vài phiên sạc.
4. Chuyển sang tab Sức khỏe để theo dõi xu hướng dài hạn.
5. Tạo báo cáo khi cần chia sẻ hoặc lưu hồ sơ theo dõi pin.
