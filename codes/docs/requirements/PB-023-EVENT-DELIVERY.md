# PB-023 — Cập nhật nhanh và sự kiện theo Visit

## Hợp đồng API

`GET /api/visits/{visitId}/events?after={cursor}` dùng phiên Patient hiện tại.
Account chỉ đọc Visit của mình; Guest phải còn AccessGrant đúng Visit và phiên.
Mỗi lần polling đều kiểm tra lại session/grant, kể cả khi không có sự kiện.
Response có `Cache-Control: no-store`; không chứa kết quả, chẩn đoán hay hồ sơ bệnh án.

- Không có `after`: `reset: true`, `events: []`, trả trạng thái hiện hành và cursor.
- Có `after`: trả tối đa 50 sự kiện tiếp theo theo thứ tự commit. Nếu vượt 50,
  trả `reset: true`, danh sách rỗng và trạng thái/cursor hiện hành.
- Cursor là chuỗi opaque gắn với Visit. Không chuyển sang số JavaScript. Cursor sai Visit,
  sai định dạng hoặc vượt watermark trả 400; cursor không thay quyền truy cập.
- `pollAfterMs: 1000` là khoảng polling foreground đề xuất. Dừng khi background,
  hủy request đang chạy khi đổi phiên/Visit; không chạy nhiều poll chồng nhau.
- `state` chứa trạng thái Visit/Journey/khám, lượt khám, số phiếu và trạng thái bước,
  số hàng chờ/phòng snapshot. Không dùng danh mục phòng hiện tại để ghi đè snapshot.

Sự kiện có ID ổn định, Visit, cursor, key, thời điểm UTC, `language: vi`,
`contentRevision: 1` (phiên bản cấu trúc nội dung), `state` snapshot và `guidance`.
Guidance chụp nội dung tiếng Việt đã published cùng template ID/key/revision và Step ID
trong giao dịch, giữ nguyên nội dung khi template được sửa về sau. Khi thiếu template
published, danh sách có thể không chứa bước đó; không tự tạo lời hướng dẫn.
Đây là nguồn tiếng Việt; PB-024/025 xử lý lựa chọn ngôn ngữ và phát âm thanh.

`stale: true` nếu trạng thái vận hành đã đổi so với snapshot hoặc đã quá hai phút.
`expiresAt` cho phép client kiểm tra lại ngay trước khi phát; trạng thái có thể tiếp tục đổi
sau khi HTTP trả về. Client cần kiểm tra Visit/bước hiện hành, không suy ra mọi key là lời gọi:
`consultationCalled` là gọi vào khám; các key khác thông báo cập nhật tương ứng.

## Reconnect phía client

Ví dụ dùng type `VisitEventPoll` trong shared (mã minh họa, PB-024/025 tích hợp runtime):

```ts
// Lần mở đầu, đổi tài khoản hoặc quay lại foreground: chỉ đồng bộ hiện trạng.
const initial: VisitEventPoll = await api.get(`/api/visits/${visitId}/events`);
let cursor = initial.cursor;
render(initial.state);

// Mỗi giây khi foreground; giữ cursor cũ nếu request thất bại.
const update: VisitEventPoll = await api.get(
  `/api/visits/${visitId}/events?after=${encodeURIComponent(cursor)}`,
);
render(update.state);
if (!update.reset) {
  for (const event of update.events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.stale || Date.parse(event.expiresAt) <= Date.now()) continue;
    handleCurrentEvent(event); // Phải kiểm tra key/bước hiện hành trước khi phát.
  }
}
cursor = update.cursor;
```

Khi reconnect ngắn còn giữ cursor, API có thể trả lại cùng ID nếu response trước bị mất;
`seen` loại trùng trong phiên. Khi đổi session/Visit, bỏ cursor và seen cũ. Khi mất cursor,
background lâu hoặc `reset: true`, chỉ dựng lại trạng thái; không phát lại toàn bộ lịch sử.

## Giao dịch và migration

Migration `20261115053618_VisitEventDelivery` thêm bảng VisitEvent, identity bigint và index
`(VisitId, Sequence)`. Không backfill thông báo/call cũ. Client nhận hiện trạng bằng bootstrap.
Downgrade xóa bảng stream; không tác động bảng Notification/ConsultationCall cũ.

CommandBus gom các Notify cùng Visit trong một lệnh thành một sự kiện, chụp trạng thái sau
SaveChanges và lưu stream/receipt trong cùng transaction. Retry receipt không chạy action,
không tạo Notification hay VisitEvent mới. Lỗi persist/commit rollback cả nghiệp vụ và stream.
Thứ tự identity có thể có khoảng trống sau rollback; không yêu cầu cursor liên tiếp.
Writer tiếp tục dùng khóa transaction hiện có; endpoint polling chỉ đọc, không heartbeat,
không lấy application lock nghiệp vụ. Không cần broker hay dịch vụ realtime mới.

## Kiểm chứng

Từ `codes/`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/event-delivery/run.ps1 -SqlServer '.\SQLEXPRESS' -Regression
$env:PB023_SQL_CONNECTION = 'Server=.\SQLEXPRESS;Database=master;Integrated Security=true;TrustServerCertificate=true'
dotnet run --project tests/event-delivery/EventDelivery.Tests.csproj -c Release
npm run typecheck
npm run lint
npm run build
```

Runner tạo API local và từng database `HospitalAcceptance_*` riêng, giữ fixture sau khi chạy.
Migration test tạo `HospitalPB023_*` riêng, kiểm tra nâng cấp schema cũ, giữ dữ liệu,
không sinh lại lịch sử, downgrade/reupgrade và model snapshot.

API suite có 8 ca: bootstrap/reconnect/retry đồng thời, quyền Account/Guest/session/cursor,
stale do trạng thái và thời gian, rollback khi stream bị từ chối, không đọc insert chưa commit,
luồng dịch vụ–gọi lại–hoàn tất khám–quyết toán, reset khi backlog lớn, đo tải 100 request
với concurrency 10. Kết quả tải là mẫu local SQL Express, không phải cam kết tải production.

Không có thay đổi giao diện/phát âm thanh trong PB-023. Review/merge và triển khai migration
là bước bàn giao riêng; không đánh Done chỉ vì kiểm chứng local đạt.

Kết quả local 15/11/2026: 8/8 ca PB-023 và 34/34 ca hồi quy PB-008/010/011/012/014/015 đạt;
migration test, Release publish, typecheck, lint và web build đạt. Ca bootstrap kiểm tra thêm
guidance snapshot không đổi sau khi template được sửa. Mẫu tải cuối: 100 request, concurrency 10,
133 ms tổng thời gian, p50 11 ms, p95 22 ms, max 27 ms, response tối đa 1368 byte.
Fixture API cuối: `HospitalAcceptance_1794721551671`; fixture migration:
`HospitalPB023_96e5a957f06f4dd4be5cd3868fa6f7d9`.
