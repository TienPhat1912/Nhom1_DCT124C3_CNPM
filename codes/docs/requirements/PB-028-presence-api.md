# PB-028 — Heartbeat và API thống kê online

Base `origin/main` tại `c6d5b98`, branch `feat/pb-028-presence-api`.
Dependency PB-001/003/004 đã có trên main. Không thay sáu quyết định nghiệp vụ,
không bổ sung lịch sử vị trí/hành vi; client heartbeat và thẻ Dashboard thuộc PB-029.

## API và định nghĩa online

| API | Quyền / kết quả |
|---|---|
| POST `/api/v2/presence/heartbeat` | Phiên hợp lệ; không cần body/version/Idempotency-Key; trả `PresenceHeartbeatV2` |
| POST `/api/presence/heartbeat` | Alias theo kế hoạch, cùng handler và quyền với route V2 |
| GET `/api/v2/admin/presence` | Chỉ Admin; trả `OnlinePresenceV2` |
| GET `/api/admin/dashboard?days=7` hoặc `30` | Giữ toàn bộ số liệu vận hành, thêm `online: OnlinePresenceV2` |

Heartbeat lấy SessionId qua Access.Current, thời gian UTC qua TimeProvider.
Chấp nhận request không body hoặc `{}`; không nhận userId/role/lastSeenAt/version
do client khai (422). JSON hỏng trả 422, body khác JSON trả 415. Request không
body không bị ràng buộc Content-Type của JSON routing. Quy tắc X-Hospital-Client
và origin hiện có vẫn áp dụng. Thiếu/revoked/expired/disabled-account trả 401.

Response heartbeat: `{lastSeenAt,heartbeatSeconds,ttlSeconds}`. Timestamp trả UTC
có `Z`, kể cả sau khi đọc datetime2 từ SQL. Việc ghi là một UPDATE có điều kiện,
kiểm tra lại phiên còn hiệu lực và giữ LastSeenAt tăng đơn điệu khi request đồng
thời hoặc đảo thứ tự. Không dùng CommandBus, application lock toàn cục, receipt,
AuditEvent hoặc VisitEvent. Không tăng Session.Version, không kéo dài ExpiresAt.

Response online: `{generatedAt,ttlSeconds,accounts,guests,total}`:

- Chỉ tính heartbeat có `now - TTL < LastSeenAt <= now`, phiên chưa revoked và
  `ExpiresAt > now`. Chưa từng heartbeat không được coi là online.
- Account đang active tính theo UserAccountId, nhiều phiên/tab/thiết bị chỉ một;
  bao gồm tài khoản bệnh nhân và nhân viên hợp lệ. Guest tính theo SessionId.
- Guest và Account độc lập, không gộp theo tên/liên hệ/PatientId. Hai phiên Guest
  cùng Patient vẫn là hai phiên. Không tuyên bố đây là số người thực duy nhất.
- Logout/revoke/expiry/khóa tài khoản bị loại ngay khi đọc, không chờ TTL. Khi TTL
  đúng 60 giây đã hết hiện diện. `total = accounts + guests` từ cùng truy vấn nhóm.
- generatedAt là thời điểm UTC server dùng để đọc; Dashboard.online và generatedAt
  ở root dùng cùng mốc. Không trả danh sách định danh hoặc thông tin cá nhân.

Presence hoạt động độc lập với cờ workflow lâm sàng V2. Trong PB-028, đăng nhập
không tự heartbeat; số online có thể bằng 0 cho tới khi client PB-029 gửi tín hiệu.

## Cấu hình và migration

`Presence:HeartbeatSeconds = 15`, `Presence:TtlSeconds = 60` trong appsettings,
override bằng `Presence__HeartbeatSeconds`, `Presence__TtlSeconds`. Khoảng nhịp
5–300 giây, TTL từ hai lần nhịp đến 3.600 giây; cấu hình không hợp lệ bị từ chối
khi khởi động. Thay đổi cấu hình có hiệu lực sau restart. Dashboard refresh 5 giây
và lifecycle foreground/background do PB-029 triển khai.

Migration `20261115133759_SessionPresence` nối sau VisitEventDelivery: thêm
`Sessions.LastSeenAt datetime2 NULL` và filtered index cho các phiên đã heartbeat,
include IsGuest/UserAccountId/ExpiresAt/Revoked. Không backfill từ CreatedAt/ExpiresAt,
không sửa token, chủ thể, version hoặc trạng thái phiên cũ. Down chỉ bỏ index và
cột hiện diện dẫn xuất; toàn bộ danh tính/expiry/revocation vẫn giữ nguyên. Khi
reupgrade, đợi heartbeat mới để xác định online, không khôi phục tín hiệu cũ.

Test migration PB-023 được chỉnh để tìm đúng predecessor của VisitEventDelivery
khi có migration mới nối tiếp; thêm hỗ trợ SQL loopback có port cho Docker,
vẫn chặn server ngoài máy. Không thay logic event delivery.

## Kiểm chứng

Ngày 15/11/2026, Windows, Node 22.19/.NET 10, SQL Server Docker loopback và database
acceptance mới. Chỉ dữ liệu tổng hợp; database fixture giữ lại, không reset demo/online.

- `npm run typecheck`: web/mobile/shared/contracts đạt.
- `npm run lint`: đạt.
- `dotnet build backend/Hospital.Api -c Release --no-restore`: đạt, 0 warning/error.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/publish-azure.ps1`:
  web build và publish Release đạt; cảnh báo kích thước bundle hiện có.
- `dotnet run --project tests/presence/Presence.Tests.csproj -c Release`, với
  PB028_SQL_CONNECTION chỉ tới SQL local: **36 kiểm tra đạt**. Test tự tạo database
  HospitalPB028_*; bao phủ TTL bằng TimeProvider điều khiển, ranh giới TTL/expiry,
  dedup, quyền Admin, body giả mạo, concurrent/monotonic writes, không tăng version
  hoặc sinh business event, và heartbeat khi giữ khóa `hospital:commands`.
  Fresh/upgrade/downgrade/reupgrade đều đạt; đối chiếu toàn bộ ID/token hash/chủ
  thể/expiry/revocation/version trước và sau rollback, không suy session cũ là online.
- `dotnet run --project tests/event-delivery/EventDelivery.Tests.csproj -c Release`,
  với PB023_SQL_CONNECTION local: regression migration PB-023 đạt.
- `node tests/presence/run.mjs`: chạy HTTP acceptance trên process API published
  riêng, cần ACCEPTANCE_DB/ConnectionStrings__Hospital/DEMO_PASSWORD và fixture SQL
  local (SQL_TEST_SERVER/SQLCMD_PATH hoặc SQL_CONTAINER_NAME). Kiểm tra route V2/alias,
  không body/key, timestamp UTC, logout/revoke/expiry, role và số liệu Dashboard cũ.
  HTTP đạt **2/2**. Bộ SQL và HTTP được nối vào `scripts/test/ci-native.ps1`.

Phép đo dùng 20 client, 20 lệnh hỗ trợ song song ở baseline, sau đó 20 lệnh song
song cùng 100 heartbeat. Tiêu chí: nghiệp vụ p95 <= 2.000 ms và không có request lỗi.
Số đo chi tiết nằm trong `artifacts/pb028-performance.json` (ignored).
Lượt cuối: baseline p95 410,23 ms; nghiệp vụ cùng heartbeat p95 309,40 ms;
heartbeat p95 103,51 ms; không request lỗi. Ca giữ khóa nghiệp vụ hoàn tất
heartbeat khoảng 8,3 ms. Đây là số đo của fixture cục bộ nêu trên.

Chưa chạy toàn bộ Windows LocalDB CI hoặc Azure SQL. Không có thay đổi giao diện;
không cần ảnh/native gate cho task API này. Chờ PR, review và merge; giữ
In Progress, chưa đánh Done.

## Sửa hồi quy CI — 15/11/2026

Log CI tại commit `270945e` dừng ở test API Dashboard do whitelist field cũ chưa
có `online`. Đã cập nhật whitelist và kiểm tra riêng aggregate online chỉ có
accounts/generatedAt/guests/total/ttlSeconds, timestamp cùng root, TTL hợp lệ và
không tính session là online khi suite chưa gửi heartbeat. Không bỏ kiểm tra quyền
Admin hoặc các số liệu vận hành.

Rà các bước migration sau đó và tái hiện PB-006 lỗi `Invalid column name
'LastSeenAt'`: fixture dùng model Session mới để insert vào schema trước PB-028.
Thêm `tests/fixtures/LegacySessionFixture.cs` dùng SQL tham số chỉ ghi các cột
session lịch sử sau khi Patient đã được lưu; liên kết vào fixture PB-006/007/010/
011/013. Giữ nguyên schema cũ thật và toàn bộ assertion upgrade/downgrade, không
sửa migration hoặc logic production. PB-004 đã có helper theo cột schema nên
không cần đổi.

Kết quả kiểm chứng SQL Server Docker/database riêng: API `api.test.mjs` đạt
24/24; cả 8 bộ core-schema, registration, ticket-number, doctor-accept, single-order,
clinical-catalog, presence và event-delivery đạt. Tổng 214 assertion được đếm trong
7 bộ đầu; bộ event-delivery cũng qua preservation/model/upgrade/downgrade/reupgrade.
ESLint file API và diff check đạt. Chưa chạy toàn bộ LocalDB CI; phần sửa hồi quy này chờ kiểm chứng trên CI sau push.
