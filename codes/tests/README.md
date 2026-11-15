# Kiểm thử

PB-028: `dotnet run --project tests/presence/Presence.Tests.csproj -c Release`
với `PB028_SQL_CONNECTION` local chạy kiểm tra SQL/handler dùng clock điều khiển
và migration trên database fixture riêng. `node tests/presence/run.mjs` chạy HTTP
và tải 20 client trên bản published, với database acceptance mới và env kết nối.
Hai bộ được nối vào ci-native. Xem [PB-028](../docs/requirements/PB-028-presence-api.md).
Các fixture tạo session ở schema trước PB-028 dùng
`fixtures/LegacySessionFixture.cs` để chỉ ghi các cột session lịch sử, rồi kiểm tra
migration với model hiện hành sau khi upgrade.

PB-026: `npm run test:route:unit` kiểm tra handshake vị trí/TTS, ưu tiên âm
thanh và adapter/hook Expo thực tế với engine giả. `npm run test:map` chạy
bản đồ/mô phỏng/thuyết minh trên desktop và mobile viewport; các ca cũng nằm
trong bộ Application mặc định. `node --test tests/unit/native-*.test.mjs`
chạy thêm hồi quy Journey/session/native. Xem
[bàn giao PB-026](../docs/requirements/PB-026-ROUTE-NARRATION.md) cho kết quả,
artifact và gate APK/âm thanh thiết bị còn lại.

PB-025: `npm run test:narration:unit` chạy narration, polling/lifecycle và
component Journey mobile. `node --test tests/unit/native-*.test.mjs` chạy hồi quy
native. Gate thiết bị riêng: `node tests/android/android-narration.mjs` với API,
database acceptance và APK mới; xem [bàn giao PB-025](../docs/requirements/PB-025-MOBILE-NARRATION.md).

PB-024: `npm run test:narration:web` chạy browser API/speech mock trên desktop và
mobile viewport, bao phủ tự phát/nghe lại/chống lặp/hủy/lỗi và đo độ trễ cập nhật
hiển thị. Không cần database. Xem [bàn giao PB-024](../docs/requirements/PB-024-WEB-NARRATION.md)
cho giới hạn và quy trình kiểm tra âm thanh thật riêng.

PB-023: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/event-delivery/run.ps1 -SqlServer '.\SQLEXPRESS' -Regression`
chạy API polling trên SQL fixture riêng, retry/quyền/stale/rollback/đọc trước commit và đo tải;
`dotnet run --project tests/event-delivery/EventDelivery.Tests.csproj -c Release` với
`PB023_SQL_CONNECTION` kiểm tra migration schema cũ. Xem [hợp đồng và reconnect](../docs/requirements/PB-023-EVENT-DELIVERY.md).

PB-017: `npm run test:translation` chạy cả hồi quy nội dung bệnh viện và
ScopedTranslationChecks (nguồn/đích, cache theo hồ sơ/version, timeout/retry,
fallback, cancellation và log privacy), dùng HTTP provider giả, không gọi Azure.

PB-016: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/patient-results/run.ps1 -SqlServer '.\SQLEXPRESS' -Regression -Capture`
chạy API/browser/component native trên fixture riêng; `npm run test:results:native`
chạy riêng component tests. Android thật là gate riêng trong
`tests/android/android-results.mjs`; xem [PB-016](../docs/requirements/PB-016-PATIENT-RESULTS.md).

PB-014: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/complete-examination/run.ps1 -Regression -Capture`
build/publish và chạy API/browser trên fixture SQL localhost riêng, kèm hồi quy PB-013/012/011/010/008.
Lệnh riêng: `node --test tests/api/complete-examination.test.mjs` và
`npx playwright test --config playwright.examination.config.ts`.
Xem [bàn giao PB-014](../docs/requirements/PB-014-COMPLETE-EXAMINATION.md).

PB-013: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/clinical-catalog/run.ps1 -SqlServer localhost -Regression -Capture`
chạy migration mới/cũ, API và browser Admin trên fixture SQL riêng; thêm hồi quy PB-012/011/010/008.
Các lệnh riêng: `node --test tests/api/clinical-catalog.test.mjs`,
`npx playwright test --config playwright.clinical.config.ts`, và
`dotnet run --project tests/clinical-catalog/ClinicalCatalog.Tests.csproj -c Release`
(migration cần `PB013_SQL_CONNECTION` trỏ SQL local; tên database luôn bị thay bằng fixture).
Xem [hợp đồng và bàn giao PB-013](../docs/requirements/PB-013-CLINICAL-CATALOG.md).

PB-012: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/service-return/run.ps1 -SqlServer localhost`
build/publish và chạy API/browser trên database `HospitalAcceptance_<timestamp>` mới, giữ lại fixture.
Hoặc đặt môi trường acceptance riêng rồi chạy `node --test tests/api/service-return.test.mjs`
và `npx playwright test --config playwright.service.config.ts`.
Xem [bàn giao PB-012](../docs/requirements/PB-012-SERVICE-RETURN.md).

PB-011: `node --test tests/api/single-order.test.mjs` và
`npx playwright test --config playwright.order.config.ts` với API/web acceptance
V2 riêng. Đặt PB011_SQL_CONNECTION tới SQL local rồi chạy
`dotnet run --project tests/single-order/SingleOrder.Tests.csproj -c Release`.
Xem [hợp đồng preview/confirm và kiểm chứng PB-011](../docs/requirements/PB-011-SINGLE-ORDER.md).

PB-010: `node --test tests/api/doctor-accept.test.mjs`,
`npx playwright test --config playwright.doctor.config.ts` trên API/web acceptance
V2 riêng; `PB010_SQL_CONNECTION` +
`dotnet run --project tests/doctor-accept/DoctorAccept.Tests.csproj -c Release`
kiểm tra migration với SQL local. Xem [bàn giao PB-010](../docs/requirements/PB-010-DOCTOR-ACCEPT.md).

PB-009: `npm run test:reception:unit` kiểm tra component mobile/draft/retry/Entry
bằng dịch vụ thiết bị giả lập. `node tests/android/android-reception.mjs` là runner
native riêng cho V2 với API/web/SQL fixture và AVD; xem
[hướng dẫn PB-009](../docs/requirements/PB-009-MOBILE-RECEPTION.md). Unit/export
không thay kiểm thử native; runner thiết bị chưa được chạy ở lần bàn giao local.

PB-005 dùng `powershell -NoProfile -ExecutionPolicy Bypass -File tests/catalog/pb005.ps1 -SqlServer localhost`.
Runner build web/API, chạy 9 ca API và 2 ca browser desktop/mobile, kiểm tra
restart rồi buộc nhập lại roster trên database mới riêng. Xem
[hướng dẫn phân công phòng](../docs/requirements/PB-005-CLINIC-ASSIGNMENT.md).
Ảnh và báo cáo nằm trong `artifacts/pb005-browser-results` và
`artifacts/pb005-playwright-report`. CI native chạy cùng runner.

PB-008: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost`
build web/API và chạy xác nhận cạnh tranh/rollback/grant, browser Reception → Journey
trên desktop/mobile cùng hồi quy PB-006. Thêm `-Port 5299 -LegacyOnly` để chạy bộ API
legacy với V2 tắt trên database mới khác. Runner chỉ tạo `HospitalAcceptance_*`
local và giữ database để đối chiếu. Xem [hướng dẫn PB-008](../docs/requirements/PB-008-CONFIRM-RECEPTION.md).

PB-007: đặt `PB007_SQL_CONNECTION` tới SQL local rồi chạy
`dotnet run --project tests/ticket-number/TicketNumber.Tests.csproj -c Release`.
Bộ test tự tạo database mới, kiểm tra concurrent/room/day/retry và migration;
xem [hướng dẫn cấp số phiếu](../docs/requirements/PB-007-TICKET-NUMBER.md).

PB-006 có [API, browser và migration tests riêng](../docs/requirements/PB-006-REGISTRATION.md#kiểm-thử).
Luồng V2 mặc định tắt; dùng database riêng và config `playwright.registration.config.ts`
để kiểm thử khi bật. Migration test tạo fixture mới, không dùng database demo.

PB-004: `dotnet run --project tests/core-schema/CoreSchema.Tests.csproj -c Release`
sau khi đặt `$env:PB004_SQL_SERVER='localhost'` (hoặc một instance LocalDB).
SQL Server local dùng SQL authentication có thể đặt `PB004_SQL_CONNECTION` thay thế;
database trong chuỗi kết nối luôn được thay bằng fixture mới. CI vẫn dùng LocalDB.
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

PB-015: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/final-settlement/run.ps1 -SqlServer '.\SQLEXPRESS' -Regression -Capture`
build/publish và chạy API/browser Cashier/Patient trên database fixture SQL local
riêng; `-Regression` chạy thêm PB-014/013/012/011/010/008 và API legacy với cờ V2 tắt.
Không ghi database demo.
Chi tiết: [PB-015](../docs/requirements/PB-015-FINAL-SETTLEMENT.md).

## Bản đồ độc lập

PB-034: `npm run test:position:unit` kiểm tra nguồn vị trí/đồng hồ giả và
component/AppState native; `npm run test:map` còn chạy mô phỏng marker trên
desktop/điện thoại, lưu ảnh vào `artifacts/pb034/`. Xem
[hợp đồng và giới hạn native](../docs/requirements/PB-034-RTLS-SIMULATION.md).

Chạy `npm run test:map`: tự mở Vite riêng ở cổng 5189, dùng API giả lập,
không cần backend/SQL. `npm run test:map:unit` kiểm tra thuật toán và danh mục.
Windows tự dùng Chrome/Edge có sẵn; máy chưa có trình duyệt phù hợp chạy
`npx playwright install chromium`. Xem [hướng dẫn bản đồ](../docs/guides/HOSPITAL_MAP.md).

PB-033: 20 map unit/component tests và 6 browser tests trên hai viewport;
browser chụp khuôn viên và đủ 25 mặt bằng vào `artifacts/pb033/`.
Chạy `node tests/map/render-atlas.mjs` sau browser tests để tạo atlas và chỉ mục;
đặt `PLAYWRIGHT_CHANNEL=chrome` nếu dùng Chrome cài sẵn. Gate thiết bị riêng:
`node --experimental-strip-types tests/android/android-map-layout.mjs`, cần APK
mới đã xác minh, AVD `cnpm_api36` và API V2/SQL fixture riêng.
[Hợp đồng, nguồn dữ liệu và giới hạn kiểm chứng](../docs/requirements/PB-033-MAP-LAYOUT.md).

## Danh mục khoa và bác sĩ

Chạy npm run test:directory:unit để kiểm tra dữ liệu Excel và liên kết bản đồ.
Chạy npm run test:directory để kiểm tra bỏ mục Khoa và bác sĩ ở cả sáu vai trò và bỏ chọn bác sĩ khi tiếp nhận, với Vite riêng (5189).
Chạy .\tests\catalog\run.ps1 với database SQL riêng để kiểm tra nhập bổ sung,
phân công phòng/bác sĩ, giữ dữ liệu cũ và không nhập trùng. Cần build API trước.
