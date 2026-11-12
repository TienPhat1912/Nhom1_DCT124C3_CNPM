# Kiểm thử

PB-006 có [API, browser và migration tests riêng](../docs/requirements/PB-006-REGISTRATION.md#kiểm-thử).
Luồng V2 mặc định tắt; dùng database riêng và config `playwright.registration.config.ts`
để kiểm thử khi bật. Migration test tạo fixture mới, không dùng database demo.

PB-004: `dotnet run --project tests/core-schema/CoreSchema.Tests.csproj -c Release`
sau khi đặt `$env:PB004_SQL_SERVER='localhost'` (hoặc một instance LocalDB).
Bộ test tạo database `HospitalPB004_*` mới, giữ lại để đối chiếu, không nhận database
ứng dụng. Kiểm chứng schema mới/seed, nâng cấp fixture legacy trên schema thật,
bảo toàn toàn bộ cột cũ bằng SHA-256, báo cáo chỉ đọc, FK/check constraints và
downgrade có bảo vệ dữ liệu. Bộ test cũng chạy trong `scripts/test/ci-native.ps1`.
Quy trình nâng cấp: [PB-004 core schema](../docs/requirements/PB-004-CORE-SCHEMA.md).

CI web/API hiện chạy trên Windows với SQL Server LocalDB, không dùng Docker. Sau `npm ci` và `dotnet restore --locked-mode`, chạy `scripts/deploy/publish-azure.ps1` rồi `scripts/test/ci-native.ps1` để kiểm thử trực tiếp bản phát hành Azure. Script tạo database riêng; không sử dụng database online. Chi tiết cấu hình và kiểm tra CD: [Azure CI/CD](../docs/guides/AZURE_CD.md).

| Thư mục | Phạm vi | Cách chạy từ thư mục gốc |
|---|---|---|
| `api/` | Nghiệp vụ, quyền truy cập, provider, hiệu năng, smoke/TLS | `.\scripts\test\test-api.ps1` |
| `browser/` | Web trên Chromium desktop và viewport điện thoại | `npx playwright test` |
| `android/` | Kiểm chứng APK và luồng native trên giả lập | Theo [hướng dẫn Android](../docs/guides/ANDROID.md) |
| `lan/` | Chọn card mạng, thay IP và bảo toàn `.env` | `.\tests\lan\startup.ps1` |
| `setup/` | Clone mới, đường dẫn có khoảng trắng, sinh/giữ cấu hình PowerShell và Bash | `.\tests\setup\bootstrap.ps1` (cần Git Bash trên Windows) |

API acceptance cần SQL chạy trước; script dùng database riêng `HospitalAcceptance_<timestamp>`. Browser cần web/API đã chạy; `WEB_URL` chọn localhost hoặc IP LAN. Các kiểm thử có tạo dữ liệu dùng thông tin tổng hợp. LAN tests không mở Docker hoặc thay firewall.

`npm run test:narration:unit` kiểm tra hook đọc hướng dẫn Android với React/Expo Speech giả lập: dừng khi đang tải giọng, đổi màn hình/ngôn ngữ, request và callback đến muộn. Không cần API, SQL hoặc giả lập Android; kiểm thử này cũng chạy trong CI, không thay thế kiểm chứng âm thanh trên thiết bị thật.

`npm run test:session:unit` kiểm tra component mobile thật với dịch vụ thiết bị giả lập:
đăng ký/đăng nhập độc lập, khôi phục Guest, đổi phiên tháo màn hình riêng tư và dừng
âm thanh trước khi lưu phiên, Journey hoàn tất không có lời mời liên kết. Test này
chạy trong CI; không thay kiểm chứng SecureStore/âm thanh/bố cục trên Android thật.
API acceptance bổ sung các ca PB-003: hai endpoint cũ trả 410, claim cũ không bị dùng,
không chuyển quyền dữ liệu và lịch sử đã liên kết vẫn đọc được. Chạy toàn bộ bộ API
trên database kiểm thử mới mỗi lần vì fixture booking và danh mục bị thay đổi trong test.

`npm run test:languages:unit` kiểm tra đủ bộ nhãn sáu ngôn ngữ, hướng dẫn bản đồ và chọn giọng đọc. `npm run test:translation` kiểm tra provider dịch giả lập, cache, quyền truy cập và nội dung phát khớp nội dung hiển thị. `powershell -ExecutionPolicy Bypass -File tests/translation/run-migration.ps1` kiểm tra nâng cấp schema cũ và rollback khi thiếu bản gốc Việt, dùng database `HospitalAcceptanceMigration_*` mới. `npx playwright test --config playwright.languages.config.ts` kiểm tra bốn ngôn ngữ mới trên desktop/mobile web, ghi nhớ lựa chọn và bố cục. Xem [hướng dẫn ngôn ngữ](../docs/guides/LANGUAGES.md).

```powershell
# Chỉ kiểm tra dashboard
npx playwright test tests/browser/admin.spec.ts

# Kiểm tra API kèm đo hiệu năng
.\scripts\test\test-api.ps1 -Performance

# Kiểm chứng APK đã build
node tests/android/verify-android.mjs
```

Báo cáo chạy mới ở `artifacts/`, báo cáo Android ở `artifacts/android/`. Các thư mục này tự tạo khi chạy và không được commit. Báo cáo/ảnh cũ ở `archive/docs/` trên máy đã dọn; xem [chỉ mục lưu trữ](../archive/README.md). Bản clone mới cần chạy lại kiểm thử, không có sẵn APK hoặc kết quả cũ.

`npm run test:demo` kiểm tra demo Docker đã bật: SQL health, 7 tài khoản/vai trò, API được bảo vệ, web/proxy và OpenAPI. Script đọc cổng từ `.env`; có thể ghi đè bằng `API_URL`/`WEB_URL`.

Browser tests dùng `WEB_URL`/`API_URL` khi đổi cổng; mặc định lần lượt là `http://localhost:5180` và `http://127.0.0.1:5280`. Ví dụ PowerShell: `$env:WEB_URL='http://localhost:5188'; $env:API_URL='http://127.0.0.1:5288'` trước `npm run test:e2e`. API acceptance cần cổng 5281 trống, tự tạo database `HospitalAcceptance_<timestamp>` và giữ database này sau kiểm thử.

## Bản đồ độc lập

Chạy `npm run test:map`: tự mở Vite riêng ở cổng 5189, dùng API giả lập,
không cần backend/SQL. `npm run test:map:unit` kiểm tra thuật toán và danh mục.
Windows tự dùng Chrome/Edge có sẵn; máy chưa có trình duyệt phù hợp chạy
`npx playwright install chromium`. Xem [hướng dẫn bản đồ](../docs/guides/HOSPITAL_MAP.md).
## Danh mục khoa và bác sĩ

Chạy npm run test:directory:unit để kiểm tra dữ liệu Excel và liên kết bản đồ.
Chạy npm run test:directory để kiểm tra bỏ mục Khoa và bác sĩ ở cả sáu vai trò và bỏ chọn bác sĩ khi tiếp nhận, với Vite riêng (5189).
Chạy .\tests\catalog\run.ps1 với database SQL riêng để kiểm tra nhập bổ sung,
phân công phòng/bác sĩ, giữ dữ liệu cũ và không nhập trùng. Cần build API trước.
