# PB-019 — Tiếp nhận và xử lý hỗ trợ

Branch `feat/pb-019-assistance`, base `origin/main` tại `6c6875a`;
PB-008, PB-009, PB-017 đã có trên main. Không thay schema/migration.

## Hợp đồng và hành vi

- `POST /api/assistance`: Guest/Account gửi trước Visit hoặc kèm Visit/Request.
  Step phải thuộc Visit được phép đọc; không nhận đồng thời Visit và Request.
  Bổ sung `sourceLanguage` (vi/en/zh/ja), bắt buộc khi Workflow V2 bật. Client cũ
  khi V2 tắt được giữ null, không suy ngôn ngữ từ profile. Description giữ nguyên
  Unicode/khoảng trắng, tối đa 2.000 ký tự.
- Khi có Visit, DepartmentId là khoa của Visit, kể cả Step thuộc khu dịch vụ.
  JourneyStepId lưu ngữ cảnh phát sinh; list trả locationId và destinationSnapshot
  của bước đó. Location không làm thay đổi khoa có quyền tiếp nhận hỗ trợ.
- `GET /api/assistance`: bệnh nhân chỉ thấy hồ sơ của mình, Guest giới hạn đúng
  session. Staff chỉ Reception và đúng khoa. Metadata gồm tên bệnh nhân, nguồn,
  Visit/Request/Step, địa điểm/snapshot, trạng thái, version và kết quả xử lý.
- `GET /api/assistance/{id}`: Reception đúng phạm vi mới được đọc detail và dịch
  mô tả sang vi. Response `{id,version,translation}` dùng DescriptionTranslationV2.
  Quyền được kiểm tra trước cache/provider; source/version/context lấy từ server.
  Bản ghi legacy không biết nguồn trả Unavailable với original, không đoán nguồn.
- List và submit không dịch, kể cả resolution; nhóm assistance tách khỏi filter
  tự dịch nội dung bệnh viện. Provider không nhận tên/ID/liên hệ.
- `PUT /api/assistance/{id}`: chỉ Reception đúng khoa; Open → Acknowledged →
  Resolved; yêu cầu version hiện hành; Resolved không mở lại. Cấm escalate,
  không cho chuyển quyền xử lý sang Service. Gửi notification tới bệnh nhân.

Web Reception chỉ tải detail khi bấm Xem chi tiết; đối chiếu original/Việt,
hiện lỗi và retry; dịch lỗi không chặn xử lý. Menu Service bỏ Hỗ trợ.
Web/mobile bệnh nhân có chọn ngôn ngữ mô tả riêng, giữ mô tả khi gửi lỗi, xóa
sau thành công và đọc danh sách trạng thái/kết quả qua polling. Tái dùng nhãn
đã có đủ sáu locale. Không suy chẩn đoán hoặc khoa từ văn bản dịch.

## Kiểm chứng và giới hạn

Môi trường: Windows, SQL Server Docker loopback, database riêng
`HospitalAcceptance_<timestamp>`, dữ liệu tổng hợp. Provider Azure được giả lập
bằng HTTP loopback, không cần credential thật.

- `npm run typecheck`: web/mobile/shared và contracts đạt.
- `npm run lint`: đạt.
- `dotnet build backend/Hospital.Api -c Release --no-restore`: đạt, 0 warning/error.
- `npm run test:translation`: bộ dịch cũ và scoped PB-017 đạt.
- `node --test tests/unit/native-assistance.test.mjs`: logic component mobile đạt;
  kiểm tra nguồn, trước Visit, Visit/Step, giữ input khi lỗi, xóa khi thành công,
  hiển thị trạng thái và resolution.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/publish-azure.ps1`:
  web build/publish Release đạt; cảnh báo kích thước bundle hiện có.
- `node tests/translation/run-assistance.mjs`: chạy API và browser trên process
  API riêng/bản publish, với provider giả lập và database acceptance qua env.
  API kiểm tra Guest/Account trước Visit, ownership, role/scope, call count,
  cache, lỗi/retry, state/version, chặn Service/escalate và ngữ cảnh khu dịch vụ.
  Browser kiểm tra bệnh nhân gửi/theo dõi, Reception đọc/dịch/retry/xử lý, Service
  không có menu; đã đạt 4/4 trên desktop và mobile viewport; API đạt 2/2.

Runner và native unit test được nối vào `scripts/test/ci-native.ps1`.
Ảnh viewport opt-in `CAPTURE_SCREENSHOTS=1`: `artifacts/*-pb019.png` (ignored).

Chưa kiểm thử gửi/theo dõi trên thiết bị hoặc giả lập Android do máy chưa có
SDK/JDK/adb; component harness không thay thế nghiệm thu native. Chưa chạy
toàn bộ Windows LocalDB CI hoặc Azure thật. Chờ PR, review và merge;
giữ In Progress và chưa đánh Done.
