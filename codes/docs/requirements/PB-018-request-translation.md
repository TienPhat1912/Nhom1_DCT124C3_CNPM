# PB-018 — Dịch mô tả khi mở chi tiết tiếp nhận

Base: `origin/main` tại `a1b7512`, đã có PB-008 và PB-017. Branch:
`feat/pb-018-request-translation`. Không đổi schema, xác nhận tiếp nhận hoặc in phiếu.

## Hành vi và hợp đồng

Reception chọn một request V2: giao diện đọc chi tiết gốc trước, sau đó gọi
`GET /api/v2/requests/{id}/translation`. List, submit và GET chi tiết thông thường
không gọi dịch; Patient không được truy cập endpoint dịch.

Endpoint tuân theo cờ `Workflow:PrdV2Enabled`. API kiểm tra phiên, role Reception
và phạm vi khoa qua `Access.Request` trước mọi truy cập service/cache/provider.
401 cho thiếu phiên, 403 cho sai role/phạm vi, 404 cho request không tồn tại,
409 `legacyRecord` nếu request cũ không có ngôn ngữ nguồn, 503 khi V2 tắt.

Response theo `DescriptionTranslationV2` đã có trong shared: `original`,
`sourceLanguage`, `targetLanguage: "vi"`, `sourceVersion`, `status`, `translated`,
`fallback`. Source lấy từ request đã lưu; target cố định vi; version/context do
server tạo. Query locale/source/target/version không thể thay đổi các giá trị này.
Chỉ description được gửi provider; không gửi tên, liên hệ, ID hoặc context.

- `Translated`: hiển thị bản Việt cạnh bản gốc, giữ nguyên Unicode và xuống dòng.
- `NotRequired`: mô tả tiếng Việt hoặc trống, không gọi provider.
- `Unavailable` hoặc lỗi mạng: vẫn đọc bản gốc và xác nhận tiếp nhận được; có nút
  thử lại, không tạo lại request. Lỗi không được cache theo quy tắc PB-017.
- Giao diện chỉ ghép bản dịch với đúng original và version đang hiển thị; component
  unmount khi đổi request, request đang chờ được hủy bởi hook resource.

Nhãn bổ sung đủ vi/en/zh/ja/ko/ru. Dịch chỉ để đối chiếu, không chẩn đoán hoặc
tự chọn khoa. Bản dịch chỉ ở cache RAM PB-017, không ghi vào SQL.

## Kiểm chứng cục bộ

Đã chạy ngày 14/11/2026, SQL Server Docker trên loopback với database riêng
`HospitalAcceptance_<timestamp>` và dữ liệu tổng hợp:

- `npm run typecheck`: web/mobile/shared và hợp đồng TypeScript đạt.
- `npm run lint`: đạt.
- `dotnet build backend/Hospital.Api -c Release --no-restore`: đạt, 0 warning/error.
- `npm run test:translation`: bộ dịch hiện có và scoped PB-017 đạt.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/publish-azure.ps1`:
  build web và publish Release đạt (có cảnh báo kích thước bundle hiện có).
- `node tests/translation/run-request.mjs`: API acceptance đạt; browser desktop
  và mobile đạt 2/2. Runner tự mở provider giả lập loopback và process API riêng,
  chạy với bản publish, yêu cầu database acceptance và thông tin kết nối qua env.
  Được nối vào `scripts/test/ci-native.ps1` khi database V2 sẵn sàng.

API test đếm request thực tới provider: submit/list/plain detail và các lần đọc
không có quyền bằng 0; detail được phép gọi đúng 1 lần; cache hit không gọi thêm;
sai scope vẫn bị chặn sau khi cache có dữ liệu. Kiểm tra đổi profile/locale,
target/source giả qua query, payload không chứa định danh, lỗi và retry không
đổi original/version/status. Browser kiểm tra list không gọi endpoint dịch,
original chính xác, thông báo lỗi, retry thành công và nút xác nhận vẫn hiện.
API cũng kiểm tra nguồn zh/ja, nội dung trống, bản ghi legacy thiếu nguồn và ID
không tồn tại; các trường hợp không cần/không được dịch không gọi provider.

Ảnh đã xem: `artifacts/chromium-desktop-pb018.png` và
`artifacts/chromium-mobile-pb018.png` (ignored). Chỉ chụp khi
`CAPTURE_SCREENSHOTS=1`, viewport, timeout 10 giây; không chặn CI bằng screenshot
full-page bắt buộc.

Chưa chạy Windows LocalDB CI đầy đủ hoặc provider Azure thật; kiểm thử task dùng
SQL Server thật và provider giả lập xác định để chứng minh quyền/call count/lỗi.
Chờ PR, reviewer và merge; chưa đánh Done.
