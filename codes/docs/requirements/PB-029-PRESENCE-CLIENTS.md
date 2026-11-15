# PB-029 — Heartbeat client và thẻ Online

Branch `feat/pb-029-presence-clients`, base `origin/main` tại `1ca8315`.
PB-021/022/028 đã merge. Không thêm migration hoặc đổi hợp đồng API.

## Hành vi

- Web gửi heartbeat ngay khi có phiên và trang foreground/online, sau đó khoảng
  15 giây (theo `heartbeatSeconds` server). Hidden, offline, pagehide, logout,
  đổi phiên và unmount hủy request/timer cũ; foreground trở lại gửi ngay.
- Native dùng AppState: chỉ `active` gửi; `inactive`/`background` dừng. Adapter
  giữ token của chính phiên đó. Đổi phiên dừng controller trước khi chờ lưu
  SecureStore hoặc dọn dữ liệu; lỗi 401 đến muộn từ phiên cũ không xóa phiên mới.
- Controller dùng chung chỉ có một request/timer hiện hành; render lại hoặc đổi
  ngôn ngữ không nhân timer. Lỗi mạng thử lại, 401 hiện hành kết thúc phiên.
  Nếu logout lỗi mạng, tiếp tục heartbeat phiên vẫn còn hiệu lực.
- Web dùng cookie HttpOnly. Sau auth thành công, BroadcastChannel thông báo
  sessionId mới/null để tab khác dừng phiên cũ và dọn màn hình riêng tư; không
  phát token hay thông tin bệnh nhân. Trình duyệt mục tiêu cần BroadcastChannel
  để đồng bộ thay đổi cookie giữa tab; không ghi thông báo vào localStorage.
- Admin có thẻ Online trong Dashboard hiện tại, gọi GET
  `/api/v2/admin/presence` khoảng 5 giây khi trang visible. Hiển thị tổng,
  Account, Guest và `generatedAt` từ server. Số liệu được định dạng theo ngôn ngữ.
  Lỗi mạng giữ số/thời gian thành công gần nhất và cảnh báo dữ liệu cũ. Lỗi lần
  đầu hiển thị chưa có dữ liệu, không giả số 0. Có nút thử lại.
- Account nhiều tab/thiết bị vẫn do API PB-028 gộp theo UserAccountId; Guest
  độc lập theo session. Ngừng heartbeat không phải logout: online hết sau TTL
  mặc định 60 giây; logout loại phiên ngay. Đây không phải số người duy nhất.

Nhãn mới có đủ vi/en/zh/ko/ja/ru. Các file chung thay đổi: web/mobile App/runtime,
shared index/i18n/translations; logic timer và thẻ Online nằm trong module mới.

## Kiểm chứng ngày 15/11/2026

| Lệnh/kịch bản từ `codes/` | Kết quả |
|---|---|
| `npm run typecheck` | Pass web/mobile/contracts |
| `npm run lint` | Pass |
| `scripts/deploy/publish-azure.ps1` | Pass web build + .NET Release publish |
| `npm run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb029-mobile-export` | Pass Android JS/Hermes bundle; chưa build/cài APK |
| `npm run test:presence:unit` | 5/5: clock, single flight, cleanup, late 401, retry, native AppState và đổi token |
| `node --experimental-strip-types --test tests/unit/native-*.test.mjs` | 80/80 hồi quy native |
| `npm run test:languages:unit` | 3/3 |
| `node tests/presence/run-clients.mjs` trên fixture SQL mới | 8/8 desktop/mobile web |
| `npx playwright test tests/browser/admin.spec.ts` cùng API fixture | 2/2 hồi quy Dashboard |
| `npm run test:map` sau sửa fixture tương thích heartbeat | 28/28 desktop/mobile web; gồm 22 ca lỗi trong log CI |

Browser bao phủ fake clock 15/5 giây, foreground/hidden, render lại, logout,
Guest mới, logout nhiều tab, lần tải đầu thất bại, giữ số/timestamp cũ rồi phục hồi.
Test API thật tạo hai phiên của một Account, hai tab cùng cookie, một Guest cùng
tên/liên hệ và một Admin: số đếm vẫn đúng, logout một phiên Account không loại
phiên Account còn lại. Test dùng đúng viewport desktop/Pixel 7, không phải Android.

Ảnh đã kiểm tra tại `artifacts/chromium-{desktop,mobile}-pb029-{online,live}.png`.
Log cục bộ ở `.local/pb029-*.log`; không commit ảnh, log, credentials hay build.
CI `ci-native.ps1` chạy unit và browser PB-029 trên database riêng trước hồi quy
browser mặc định; không xóa session/lịch sử của suite khác để làm số đếm qua.
Fixture bản đồ xử lý riêng đúng POST `/api/v2/presence/heartbeat` không body/key
và trả cadence/TTL hợp lệ. Heartbeat là cập nhật hiện diện của session; các POST
nghiệp vụ khác vẫn được ghi lại để kiểm tra bản đồ không làm thay đổi Visit.
Test atlas xác nhận có heartbeat và danh sách lệnh nghiệp vụ vẫn rỗng. Điều này
khắc phục 22 ca PB-033/034/026 bị báo lỗi trên CI khi PB-029 bắt đầu tự heartbeat.
Chưa chạy toàn bộ pipeline Windows LocalDB trên máy này (kiểm thử API ở đây dùng
SQL Server container local và cùng bản publish).

## Chạy lại browser với API thật

Publish bằng `scripts/deploy/publish-azure.ps1`. Tạo database fixture mới
`HospitalAcceptance_<timestamp>`, đặt `ACCEPTANCE_DB`,
`ConnectionStrings__Hospital` trỏ SQL local và `DEMO_PASSWORD`; đặt
`Demo__Enabled=true`, `Demo__Password` cùng mật khẩu, môi trường Development.
Từ `artifacts/azure-release`, chạy `dotnet Hospital.Api.dll --migrate-only`, rồi
trở lại `codes/` chạy `node tests/presence/run-clients.mjs`. Runner tự chọn cổng,
khởi động/dừng API và Playwright. Đặt `CAPTURE_SCREENSHOTS=1` để lưu ảnh.
Không dùng database demo/online; runner count cần fixture chưa có heartbeat khác.
Hoặc chạy `scripts/test/ci-native.ps1` sau publish trên Windows có SQL LocalDB.

## Gate Android còn lại

Chưa có Android SDK/JDK/adb hoặc thiết bị trên máy này. Kiểm thử component thật
với AppState/API giả và Expo export không thay kiểm chứng APK. Trước khi nghiệm
thu native, build/cài APK mới theo [Android](../guides/ANDROID.md), dùng API/SQL
fixture riêng và thực hiện:

1. Mở Guest và Account lần lượt; đối chiếu heartbeat ban đầu và khoảng 15 giây
   qua network/API, xác nhận token/phiên đúng.
2. Home/khóa màn hình trên 60 giây: không phát heartbeat trong background và
   số Guest/Account của phiên cuối cùng giảm sau TTL. Mở lại: heartbeat ngay,
   Dashboard phản ánh sau tối đa khoảng một chu kỳ 5 giây.
3. Logout, đổi Guest sang Account, đổi ngôn ngữ và mở/đóng màn hình nhiều lần:
   không nhịp trùng, không request token cũ, không dữ liệu riêng tư phiên trước.
4. Ngắt/kết nối mạng; kiểm tra hồi phục. Đăng xuất một phiên Account trong khi
   một thiết bị khác cùng Account vẫn hoạt động: Account vẫn chỉ được đếm một.

Task giữ **In Progress** khi chưa có bằng chứng thiết bị, review và merge PR.
