# Kế Hoạch Phát Triển Mobile Module (Tuần 8 - Tuần 11)

Dành cho học phần Công nghệ Phần mềm (Software Engineering) - chủ đề **Chương trình thuyết minh tự động đa ngôn ngữ**.

---

## Tuần 8: Tích Hợp GPS Thật & Kích Hoạt Thuyết Minh Tự Động (Geofencing)

### Mục tiêu:
Chuyển đổi từ cơ chế giả lập toạ độ hiện tại sang GPS thực tế của thiết bị và tự động kích hoạt phát bài thuyết minh khi du khách di chuyển vào vùng lân cận địa điểm.

### Các công việc cụ thể:
1. **Xin quyền vị trí (Location Permissions):**
   - Tích hợp `expo-location` để yêu cầu `Foreground Location Permission` và `Background Location Permission` khi cần.
   - Xử lý UX khi người dùng từ chối quyền hoặc tắt GPS.
2. **Theo dõi vị trí thời gian thực (Live Tracking):**
   - Sử dụng `watchPositionAsync` để nhận toạ độ mới nhất khi người dùng di chuyển.
   - Áp dụng thuật toán Haversine (`src/utils/geoUtils.ts`) tính khoảng cách liên tục đến các địa điểm xung quanh.
3. **Bản đồ trực quan (Interactive Map):**
   - Tích hợp `react-native-maps` hiển thị bản đồ số TP.HCM.
   - Đánh dấu marker người dùng (vị trí hiện tại) và các marker địa điểm kèm bán kính vòng tròn Geofence (50m).
4. **Cơ chế kích hoạt âm thanh tự động (Auto Audio Trigger):**
   - Khi `distance <= 50m`:
     - Kiểm tra xem địa điểm này đã phát trong chuyến đi chưa (tránh spam phát lặp lại).
     - Kiểm tra ngôn ngữ người dùng đang chọn (`LanguageContext`).
     - Tự động nạp Audio Track của ngôn ngữ đó và bắt đầu phát, kèm thông báo đẩy (Notification).

---

## Tuần 9: Chế Độ Ngoại Tuyến (Offline Audio) & Tối Ưu Trình Phát

### Mục tiêu:
Hỗ trợ du khách quốc tế sử dụng ứng dụng khi không có mạng 4G/Wifi ổn định.

### Các công việc cụ thể:
1. **Tải về ngoại tuyến (Offline Download):**
   - Tích hợp `expo-file-system` cho phép tải về trước bài thuyết minh âm thanh và dữ liệu địa điểm.
   - Lưu trữ danh sách bài thuyết minh đã tải để nghe khi offline.
2. **Tùy chỉnh tốc độ phát âm thanh:**
   - Bổ sung nút chọn tốc độ: `0.75x`, `1.0x`, `1.25x`, `1.5x`.
3. **Lưu trữ phiên bản địa phương (Persistence):**
   - Sử dụng `@react-native-async-storage/async-storage` lưu trạng thái ngôn ngữ đã chọn và danh sách yêu thích giữa các lần mở app.

---

## Tuần 10: Tích Hợp REST API Backend & Xử Lý Đồng Bộ

### Mục tiêu:
Thay thế hoàn toàn Mock Service bằng REST API của thành viên Backend.

### Các công việc cụ thể:
1. **Chuyển đổi cấu hình:**
   - Chuyển `APP_CONFIG.USE_MOCK_API = false` và cập nhật `API_BASE_URL` trỏ tới server staging/production.
2. **Quản lý Token JWT & Refresh Token:**
   - Lưu trữ token xác thực an toàn.
   - Tự động gắn header `Authorization: Bearer <token>` qua `apiClient.ts`.
3. **Xử lý sự cố mạng (Network Resilience):**
   - Kiểm tra kết nối mạng qua `NetInfo`.
   - Cơ chế tự động thử lại (Retry with exponential backoff) khi mạng chập chờn.

---

## Tuần 11: Kiểm Thử Toàn Diện, Tối Ưu Hiệu Năng & Hoàn Thiện Báo Cáo

### Mục tiêu:
Đảm bảo sản phẩm ổn định 100%, không còn rò rỉ bộ nhớ, sẵn sàng nộp đồ án Tuần 12.

### Các công việc cụ thể:
1. **E2E & Integration Testing:**
   - Kiểm thử toàn bộ kịch bản người dùng từ mở app -> đăng nhập -> chuyển ngôn ngữ -> di chuyển đến địa điểm -> tự động kích hoạt audio.
2. **Tối ưu hóa tài nguyên (Performance Profiling):**
   - Kiểm tra dọn dẹp Audio Sound instance khi unmount để tránh tràn RAM.
   - Tối ưu kích thước hình ảnh và bộ nhớ cache.
3. **Đóng gói và bàn giao:**
   - Xuất file APK Android thử nghiệm độc lập (`eas build -p android --profile preview`).
   - Hoàn thiện tài liệu kiến trúc và hướng dẫn sử dụng trong báo cáo cuối kỳ.
