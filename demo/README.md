# Hospital Visit Guidance — demo PRD 4.1

React/TypeScript cho bệnh nhân và năm vai trò nhân viên; React Native/Expo cho bệnh nhân; ASP.NET Core 9 + EF Core + SQLite. PRD gốc: [instruction/PRD_v3.docx](instruction/PRD_v3.docx), version **4.1 bên trong tài liệu**.

## Chạy demo Windows

Cần .NET SDK 9, Node 22.19 và Python 3.13. Chạy trong thư mục repository:

```powershell
dotnet restore services/api --locked-mode
npm.cmd ci --prefix apps/web
./scripts/start-demo.ps1
```

Mở **http://127.0.0.1:5173**. API: http://127.0.0.1:5047/health. Script build trước khi chạy, tạo JWT secret riêng trong `.artifacts/demo`, mở hai tiến trình nền và kiểm tra readiness. Không in secret ra terminal. Dừng demo trước khi build lại API trên Windows:

```powershell
./scripts/stop-demo.ps1
```

Database `services/api/hospital_visit.db` được giữ lại qua restart. Lần đầu chuyển database cũ từ EnsureCreated sang migrations, API kiểm tra schema và tạo `hospital_visit.db.before-migrations-*.db` trước khi thay đổi. Không xóa database để sửa lỗi migration. Logs phát triển nằm trong `.artifacts/demo`; chỉ chia sẻ sau khi kiểm tra thông tin nhạy cảm.

## Tài khoản và kịch bản trình bày

Mật khẩu chung của dữ liệu demo: **`Demo@123`**. Chọn đúng vai trò trên thanh đầu trang rồi đăng nhập. Dùng cửa sổ riêng hoặc browser profile riêng để trình bày đồng thời các vai trò.

| Vai trò | Email |
| --- | --- |
| Bệnh nhân | `patient1@demo.com`, `patient2@demo.com` |
| Tiếp nhận | `receptionist@hospital.demo` |
| Bác sĩ | `doctor@hospital.demo` |
| Xét nghiệm / hình ảnh | `labstaff@hospital.demo` |
| Thu ngân | `cashier@hospital.demo` |
| Quản trị | `admin@hospital.demo` |

1. Bệnh nhân chọn **Tiếp tục với tư cách khách**, điền và gửi yêu cầu vãng lai. Lúc này chỉ có reception QR, chưa có Visit.
2. Tiếp nhận nhập/quét mã `REC_…`, xem thông tin, chọn khoa Tim mạch và cấp phiếu. Có thể gửi câu hỏi đã duyệt; bệnh nhân trả lời trên cùng yêu cầu. Có thể tra mã lịch hẹn mang đến và xác minh người đến khám tại quầy.
3. Bệnh nhân nhập/quét mã `TKT_…` trên phiếu. Journey được kích hoạt; quét lại giữ nguyên tiến độ.
4. Bác sĩ chọn đúng lượt khám, thêm xét nghiệm, hoàn tất khám ban đầu; viết chẩn đoán và dặn dò, lưu nháp rồi công bố. Bệnh nhân đọc được ngay, trước thanh toán. Bản dịch EN chỉ dùng khi bác sĩ đánh dấu đã duyệt. Sửa nội dung đã công bố bằng lưu một bản nháp mới rồi công bố phiên bản mới.
5. Nhân viên dịch vụ hoàn tất kết quả; bác sĩ hoàn tất khám lại; thu ngân ghi kết quả thanh toán cuối. Thanh toán giữa chừng không đóng Visit.
6. Visit đã đóng vẫn còn Journey hướng dẫn nhà thuốc. Bệnh nhân chỉ xác nhận **hoàn tất hướng dẫn nhà thuốc**, không xác nhận phát thuốc chính thức. Sau đó xem lại lịch sử hoặc liên kết Guest với tài khoản mới/tài khoản chưa có hồ sơ xung đột.

Nguồn lịch hẹn mô phỏng: tài khoản ngoài `demo-patient-001`, mật khẩu `AppointmentDemo@123`, lịch hẹn `APT-2026-001234`. Xác minh liên kết trong hồ sơ bệnh nhân trước khi tra tự động. Một external identity chỉ liên kết một bệnh nhân. Khách có thể mang mã lịch hẹn tới quầy để nhân viên xác minh.

Khôi phục: bệnh nhân tạo phiên khách mới và cung cấp **mã phiên hỗ trợ**; tiếp nhận tìm lượt khám, xác minh trực tiếp người đến khám rồi cấp lại mã phiếu/gán phiên mới. Việc này giữ nguyên patient/Visit/Journey; mã và phiên cũ bị thay thế. Hồ sơ thuộc tài khoản yêu cầu đăng nhập đúng tài khoản.

## App React Native

```powershell
npm.cmd ci --prefix apps/mobile
npm.cmd run typecheck --prefix apps/mobile
npm.cmd run bundle --prefix apps/mobile
cd apps/mobile
$env:EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:5047'
npm.cmd start
```

`10.0.2.2` dành cho Android emulator. Thiết bị thật cần API có địa chỉ mạng truy cập được; local script chỉ bind loopback. Chỉ cấu hình bind/LAN và firewall cho môi trường demo đã được phép. Máy có Android SDK/JDK có thể chạy `npm.cmd run android`. Expo Go cần bản tương thích SDK 57.

App có UI native, camera và nhập mã dự phòng, SecureStore, deep link `hospitalguide://ticket/TKT_…`, Back, safe area, resume/polling, nội dung công bố và hai bộ playback riêng. Link web giữ nguyên `?ticket=…`; nút mở app chỉ hoạt động khi đã cài app. Public hospital QR dùng URL gốc của web, không chứa hồ sơ bệnh nhân. Domain association/universal links cần domain được cấp và chưa cấu hình.

**Đã tạo Android JS/Hermes bundle; chưa tạo APK trên máy này.** Workflow Android tạo APK nội bộ sau CI đúng commit; chưa có bằng chứng runner chạy. iOS chưa build hoặc kiểm tra thiết bị. Android mục tiêu demo đầu tiên; chưa phát hành store. Camera/TTS native cần nghiệm thu trên emulator/thiết bị.

## Kiểm thử

```powershell
dotnet build services/api --no-restore
python scripts/test_backend_e2e.py
python scripts/benchmark.py
npm.cmd run build --prefix apps/web
cd apps/web
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

API tests và browser tests tự tạo SQLite riêng dưới `.artifacts`; không sử dụng database demo. Browser test tự mở API 5049 và Vite 5174. Report: `.artifacts/playwright-report/index.html`; screenshot: `.artifacts/patient-completed.png`; benchmark: `.artifacts/performance.json`. Kết quả và phạm vi nghiệm thu: [docs/implementation-status.md](docs/implementation-status.md), từng yêu cầu: [docs/requirements-traceability.md](docs/requirements-traceability.md).

## Docker và CI/CD

Đã chuẩn bị Compose, Dockerfiles và các workflow; **Docker không có trên máy hiện tại nên chưa smoke Docker local**.

```powershell
Copy-Item .env.example .env
# Điền JWT_SECRET bằng giá trị ngẫu nhiên riêng, ít nhất 32 ký tự.
docker compose up --build -d --wait
python scripts/smoke.py http://127.0.0.1:8080
docker compose down
```

Giữ volume `hospital-demo-data`; không dùng `down -v` khi cần bảo toàn dữ liệu. `.env`, database, secret và artifacts không được commit. `SEED_DEMO=true` chỉ dùng cho dữ liệu tổng hợp ở môi trường demo.

* `ci.yml`: PR/push `master`; locked install, API integration, benchmark, web TypeScript/build/Chromium, native TypeScript/bundle, API publish, Compose build/start/smoke. Release archive gồm Docker images đã kiểm tra, compose/scripts/checksums gắn SHA; giữ 14 ngày, report giữ 7 ngày.
* `deploy-demo.yml`: chạy thủ công trên `master`, nhập CI run ID thành công từ push cùng repository. Chỉ lấy artifact đã qua gate; không build lại trên host. Environment `demo` cần `DEMO_HOST`, `DEMO_USER`, `DEMO_SSH_KEY`, `DEMO_KNOWN_HOSTS`. Host Linux cần Docker Compose, Python, quyền ghi `/srv/hospital-demo` và file `.env` được cấp trước. Cấu hình người phê duyệt environment và branch protection trên GitHub khi có remote.
* `android.yml`: chạy thủ công trên `master`, nhập CI run ID thành công **đúng commit** và API URL không chứa credential. JDK 17 + Android SDK + Expo prebuild + Gradle release APK cho arm64/x86_64. APK dùng signing demo do prebuild tạo, phân phối artifact nội bộ giữ 14 ngày; cần signing được cấp nếu muốn nhận cập nhật APK ổn định.

`scripts/release.sh` kiểm tra checksum/config, nạp images, dừng ghi để sao lưu volume, startup/health/smoke rồi mới đánh dấu release hiện tại. Rollback: lấy **artifact trước đã qua CI**, chạy lại với SHA cũ nếu schema tương thích. Nếu migration không tương thích, dừng API, phục hồi bản sao lưu volume phù hợp cùng image cũ theo quy trình của chủ môi trường; không phục hồi đè dữ liệu mới một cách tự động. Không có remote/commit/host được cấp trong lần bàn giao này nên chưa chạy CI/CD thực tế.

## Quyết định demo và giới hạn

Một API instance/SQLite, transaction và unique constraints, ghi tuần tự trong một process; không dùng nhiều replica. UI poll 5 giây, refresh sau mutation/reconnect/app resume; request timeout 15 giây. Clinical text chỉ giữ trong bộ nhớ UI và xóa khi đổi ngữ cảnh/đăng xuất/hết phiên. Native credential dùng SecureStore; web dùng token trong storage của trình duyệt cho demo. Guest grant 24 giờ, continuation 30 phút, ticket hết hạn sau 7 ngày hoặc lần cấp lại gần nhất.

Appointment/external identity, queue và các sự kiện dịch vụ/thanh toán dùng adapter/nhân viên demo; không kết nối HIS, thanh toán thật hay push ngoài app. Speech dùng giọng thiết bị, đọc đúng văn bản được API cho phép; thiếu giọng vẫn đọc text được. Không sinh nội dung y tế bằng AI. Chỉ đường dùng địa điểm khoa/tầng/phòng; không có bản đồ indoor/GPS. `Booking__HandoffUrl` có thể cấu hình URL HTTPS của nơi đặt lịch được cấp; chưa cấu hình thì hướng bệnh nhân tới quầy, không tự báo đã đặt lịch.

Local demo dùng HTTP loopback. Host ngoài máy cần HTTPS termination và API URL HTTPS trước khi nghiệm thu NFR-SEC-02. Nginx tắt log URL để tránh ghi ticket/QR. Chỉ lưu bản tóm tắt/dặn dò do bác sĩ nhập; không nhập bệnh án pháp lý hay kết quả thô. Dữ liệu tổng hợp local giữ đến khi chủ dự án cho phép dọn; artifact CI tự hết hạn như trên. Dữ liệu thật cần chính sách lưu/xóa và quyền truy cập được bệnh viện duyệt trước khi sử dụng.

`npm audit` của Expo còn dependency tooling transitive mức moderate/high chưa có bản vá tương thích tự động; không chạy `audit fix --force` vì nó đề xuất đổi SDK phá tương thích. Xem chi tiết trong status trước khi dùng ngoài demo.
