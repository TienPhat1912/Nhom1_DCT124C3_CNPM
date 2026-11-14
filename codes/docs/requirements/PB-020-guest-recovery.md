# PB-020 — Tra cứu phiếu và khôi phục Guest

Base `origin/main` tại `5f4e9b1`, branch `feat/pb-020-guest-recovery`.
Đã có PB-003/008/009. Không đổi schema/migration, không khôi phục chức năng
liên kết Guest với tài khoản.

## Luồng và hợp đồng

Reception mở Tra cứu phiếu, nhập số/ngày in trên phiếu và tùy chọn phòng. Kết quả
hiển thị số, ngày, phòng và tên trong snapshot lúc cấp phiếu; không chọn Visit tự
động. Nhân viên chọn một kết quả, đối chiếu thông tin liên hệ, xác minh trực tiếp
và nhập ghi nhận rồi mới cấp mã. Tái dùng RecoveryActions cho hồ sơ cũ, giữ chức
năng in lại phiếu; lookup không thêm chức năng in lại.

`GET /api/reception/guest-tickets?number=1&issuedOn=2040-02-01&clinicLocationId=<optional>`:

- Chỉ Reception, lọc khoa theo Visit và StaffScope. Sai role trả 403, thiếu phiên
  401; Reception không có khoa phù hợp nhận danh sách rỗng.
- Number là số nguyên dương, không giới hạn ba chữ số: `001` là định dạng tối
  thiểu của bộ cấp số PB-007. Ngày dùng DateOnly đã lưu theo ngày cấp tại Việt Nam.
- Chỉ tìm ticket đã có SequenceNumber/IssuedOn và bệnh nhân Guest không gắn User.
  Không suy số từ mã H- cũ, không tìm theo họ tên đơn thuần.
- Trả `{items,hasMore}`, tối đa 100 kết quả, có thể lọc thêm phòng. Mỗi item theo
  shared `GuestTicketMatch`: VisitId, số/ngày/phòng cùng patient/clinic snapshot.
  Trùng số ở phòng khác hoặc ngày khác không thay thế khóa Visit.

`POST /api/visits/{id}/recovery` giữ kiểm tra Reception/phạm vi và bắt buộc
AttendeeVerified + VerificationNote. Account cần đăng nhập, không cấp mã Guest.
Response bổ sung `expiresAt` UTC cạnh `recoveryCode`, hạn 10 phút. Trong cùng giao
dịch, cấp mã mới vô hiệu hóa các claim chưa dùng của cùng Visit. Không lưu mã rõ
trong SQL; chỉ hash. UI hiển thị hạn mã; đổi kết quả tìm kiếm reset bước xác minh.

`POST /api/auth/recover` xác thực code 64 ký tự hex, còn hạn/chưa dùng; kiểm tra
Patient không thuộc Account; tiêu thụ claim và tạo session Guest + AccessGrant
cho đúng Visit trong transaction khóa SQL hiện có. Không có receipt cho phép
replay lấy lại session. Audit ghi nhận claim được tiêu thụ, không ghi mã.

Response giữ `{session,visitId}`. Web chuyển thẳng tới `#visit=<id>` sau khi nhận
session; mobile lưu session rồi dùng onRecovered mở cùng Visit theo PB-009.
Client trim khoảng trắng khi dán mã. Không đổi Patient/profile/snapshot, không
tạo Visit/Journey mới, không gắn quyền vào một Account độc lập. Mã hết hạn, bị
thay thế hoặc đã tiêu thụ trả `claimInvalid` 403. Nhãn lookup có đủ sáu locale.

## Bằng chứng kiểm thử

Chạy cục bộ với SQL Server Docker loopback, database riêng
`HospitalAcceptance_<timestamp>` và dữ liệu tổng hợp, ngày 14/11/2026:

- `npm run typecheck`: web/mobile/shared và contracts đạt.
- `npm run lint`: đạt.
- `dotnet build backend/Hospital.Api -c Release --no-restore`: đạt, 0 warning/error.
- `node --test tests/unit/native-reception.test.mjs tests/unit/native-session.test.mjs`:
  đạt 25/25; kiểm tra luồng lưu session trước điều hướng, trim mã, giữ input và không đổi
  session/điều hướng khi claim lỗi, cùng các regression tiếp nhận/phiên.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/publish-azure.ps1`:
  build web và publish Release đạt; cảnh báo kích thước bundle hiện có.
- `node tests/recovery/run.mjs`: API acceptance đạt; browser desktop/mobile đạt
  2/2. Runner tự mở process published API trên loopback, dùng database acceptance
  mới đã migrate và env kết nối/password; không thao tác database demo/online.

API tạo ba phiếu 001: cùng ngày/khác phòng và cùng phòng/khác ngày; kiểm tra
lookup, role/scope, bắt buộc xác minh, mã thay thế, hết hạn/replay, năm claim đồng
thời chỉ một thành công. Kiểm tra Patient/profile không đổi, cùng Visit/Journey,
không tăng attendance và Account độc lập không nhận lịch sử.

Browser dùng Reception tìm/chọn phiếu, xác minh/cấp mã và thiết bị mới đăng nhập
bằng mã, tự mở đúng Visit và đối chiếu JourneyId qua session cookie mới.
Ảnh viewport đã xem: `artifacts/chromium-desktop-pb020.png`,
`artifacts/chromium-mobile-pb020.png` (ignored, chụp opt-in CAPTURE_SCREENSHOTS=1,
timeout 10 giây). Runner được nối vào `scripts/test/ci-native.ps1`; native unit
suite hiện có đã bao gồm regression mới.

Chưa kiểm thử gửi mã/mở Journey trên thiết bị hoặc giả lập Android vì máy chưa
có SDK/JDK/adb. Harness component không thay thế nghiệm thu native. Chưa chạy
toàn bộ Windows LocalDB CI. Chờ PR, review và merge; giữ In Progress,
chưa đánh Done.

## Sửa hồi quy browser CI — 15/11/2026

Log CI tại commit `429d5b0` có 12 lỗi browser, từ ba nguyên nhân:

- Lookup thêm ô Địa điểm khiến locator toàn trang trong test danh mục bị trùng.
  Test giới hạn ô này vào form có trường Khoa / bộ phận.
- Fixture ngôn ngữ đặt hạn phiên năm 2030, vượt giới hạn timer signed 32-bit của
  browser (~24,8 ngày), khiến setTimeout chạy ngay và thoát phiên. App chia thời
  gian chờ thành các đoạn, kiểm tra deadline thực trước khi hết phiên; fixture dùng
  hạn 24 giờ tính từ lúc test chạy. Regression dùng clock cố định kiểm tra phiên
  40 ngày vẫn còn sau 25 ngày rồi hết đúng hạn, và phiên ngắn hết đúng deadline.
- Test patient cũ chờ trang Xin chào sau recovery/reload. PB-020 mở trực tiếp
  Journey; test kiểm tra URL đúng Visit và Journey hoàn thành trước/sau reload.

Không thay quyền recovery hoặc nghiệp vụ tiếp nhận. Kiểm chứng trên bản publish
Release, SQL Server Docker và database acceptance mới, Workflow V2 tắt như nhóm
browser đầu của CI. Test timer mới nằm trong bộ browser mặc định, không cần đổi CI.

Kết quả sau sửa: `npm run typecheck`, `npm run lint`, publish Release đạt;
`node node_modules/@playwright/test/cli.js test` đạt **50/50** trên desktop/mobile
(46 test cũ và 4 test timer). Test timer chạy riêng cũng đạt 4/4. Chưa chạy toàn
bộ LocalDB CI; phần sửa hồi quy này chờ kiểm chứng trên CI sau push.

Log CI tiếp theo đã qua 50 browser mặc định và 8 browser registration, nhưng
dừng ở 2 test `confirm-reception.spec.ts` do locator Location toàn trang trùng
lookup. Đã giới hạn Location, ghi nhận xác minh, checkbox và nút xác nhận vào
đúng fieldset xác nhận; test chủ động mở lookup để kiểm tra khi cả hai form cùng
hiện. Rà các locator Location/Địa điểm còn lại: test danh mục và recovery đã có
scope riêng. `playwright test --config playwright.reception.config.ts` trên
published API, SQL Docker/database acceptance riêng đạt 2/2 desktop/mobile;
ESLint file test và diff check đạt. Lần sửa bổ sung này chờ kiểm chứng trên CI sau push.
