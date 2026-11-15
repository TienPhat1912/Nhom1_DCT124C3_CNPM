# PB-022 — Journey trên mobile

Branch `feat/pb-022-mobile-journey`, base `f96912a` (main đã merge PB-021).

## Hành vi

- Dùng `/api/visits/{id}` như web: giữ hướng dẫn được dịch và snapshot điểm đến.
  `ExamStatus` gồm Waiting/InConsultation/InService/Completed, hiển thị riêng với
  Visit và Journey. Khám Completed vẫn có thể đang chờ quyết toán; chỉ Journey
  Completed mới hiện thẻ hoàn tất cùng lịch sử các bước.
- Dịch vụ hiển thị điểm dịch vụ; complete từ nhân viên tạo bước về phòng cũ,
  trở lại Chờ khám và giữ số phiếu. Không có nút kích hoạt hay tự hoàn tất nhà
  thuốc trong Journey; không tự gửi lệnh chuyển trạng thái chuyên môn.
- Nghe, chỉ đường, hỗ trợ truy cập trực tiếp. Chỉ đường lấy lại bước hiện tại,
  không giữ điểm đến dịch vụ đã xong. Nút cho phép xuống dòng và co phần chữ;
  nội dung vẫn dùng font scaling của React Native và ScrollView.

## Restart, offline và quyền

- Lượt được chọn lưu bằng receptionStore đã có từ PB-009; cả chọn qua tab và
  nút ở Overview đều lưu. Restart mở lại lượt này trong đúng session.
- journeyStore lưu tối đa tám snapshot trong Expo SecureStore, cùng metadata
  phiên và cấu hình theo ngôn ngữ. Bearer token vẫn chỉ nằm ở khóa token riêng.
  Mỗi entry chia theo Unicode code point, dưới 2 KiB; hai bộ chunk và con trỏ
  commit bảo toàn snapshot cũ nếu tiến trình chết giữa lúc ghi. Các lần ghi
  tuần tự; đổi phiên và logout vô hiệu hóa ghi đến muộn và xóa chunk.
- Khi khởi động offline, chỉ khôi phục metadata phiên Patient chưa hết hạn và
  cấu hình đã tải. Cache là dữ liệu đã xem, có nhãn cũ và thời điểm tải. Không
  biến lỗi 401/403 thành quyền offline. Không có cache thì hiển thị lỗi/retry.
- Poll mỗi năm giây khi foreground, trở lại ứng dụng và Retry đều đọc lại API.
  Sequence/cleanup chặn request cũ; version của aggregate chặn snapshot thấp
  hơn, kể cả sau đổi ngôn ngữ hoặc restart. Nếu bản dịch cache cũ hơn trạng
  thái đã xem ở ngôn ngữ khác, giữ bản mới nhất và đánh dấu cũ trong lúc tải.
- Deep link là gợi ý điều hướng. Online phải qua API kiểm tra quyền; khi lỗi
  kết nối chỉ được mở cache mà chính session này đã tải cho đúng Visit.
  401/403/404 của resource xóa snapshot và ẩn dữ liệu cũ. Logout, hết hạn và
  đổi phiên xóa cache, draft và lựa chọn của phiên trước; các màn hình private
  được unmount trước khi chờ ghi thiết bị.
- Timer hết phiên chia khoảng dài để tránh tràn 32 bit; kiểm tra lại khi app
  trở về foreground. Không thay đổi API, schema, package dependency hoặc TTS tự phát.

## Kiểm chứng

Từ `codes/`:

```powershell
npm run typecheck
npm run lint
npm run test:journey:native
node --test tests/unit/native-session.test.mjs tests/unit/native-narration.test.mjs tests/unit/native-reception.test.mjs tests/unit/native-results.test.mjs
npm run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb022-android-export
```

Test chạy mã component/hook/store thật với React hook, API và thiết bị được
điều khiển trong harness. Chúng không thay thế nghiệm thu Android. CI application
chạy `test:journey:native`; job Android hiện có vẫn prebuild/build APK từ source.

Kết quả local ngày 15/11/2026:

| Kiểm tra | Kết quả |
|---|---|
| Typecheck web/mobile/shared/contracts | PASS |
| Lint | PASS |
| Journey + session/narration/reception/results native unit tests | PASS 55/55, dùng node test runner như CI |
| Expo export Android | PASS, bundle Hermes và 943 modules |
| Parser runner Android / `git diff --check` | PASS |
| Build APK / kiểm thử AVD | Chưa đạt gate: thiếu SDK Platform 36/adb/emulator |

Log unit: `artifacts/pb022-native-tests.log`. Bundle nằm ở
`artifacts/pb022-android-export/`. Không thay dependency hoặc migration; chưa
chạy toàn bộ workflow GitHub, thiết bị Android thật hoặc nghiệm thu TTS/camera.

Runner thiết bị mới: `tests/android/android-journey.mjs`. Cần AVD riêng
`cnpm_api36`, APK mới đã cài, API V2 và database fixture `HospitalAcceptance_<timestamp>`
riêng; đặt API_URL, DEMO_PASSWORD, ACCEPTANCE_DB, ADB_PATH và ANDROID_SERIAL.
Không dùng database demo/online đang có người sử dụng.

```powershell
./scripts/build/build-android.ps1
# Cài artifacts/android/an-tam-demo.apk lên AVD riêng trước khi chạy.
node tests/android/android-journey.mjs
```

Runner gồm không dịch vụ/hai vòng dịch vụ, restart, deep link, offline bằng ngắt
adb reverse, restart offline, retry, hai outcome quyết toán, font 150% và logout.
Nó lưu báo cáo/ảnh trong `artifacts/android/`, phục hồi font trong finally.
Chưa chạy runner thiết bị trong phiên này: máy thiếu SDK Platform 36, adb và
emulator. Lệnh build APK dừng tại kiểm tra SDK. Không có bằng chứng mới về native
layout, SecureStore trên thiết bị hoặc giọng đọc; không đánh Done trước các gate này.
