# PB-006 — Yêu cầu tiếp nhận V2

Triển khai API và web bệnh nhân trên schema PB-004. Không có phần mobile,
xác nhận tiếp nhận, cấp số phiếu hoặc mở Journey mới trong task này.

## Hợp đồng và bật luồng

`Workflow:PrdV2Enabled` mặc định `false`. API V2 trả 503 `workflowNotEnabled`
khi tắt; `/api/config` trả `prdV2Enabled` để web chọn màn hình phù hợp.
Chỉ đặt `Workflow__PrdV2Enabled=true` trên database kiểm thử riêng trong giai đoạn
PB-006. Không bật môi trường chung trước PB-030/031 và các client đồng bộ.

- `POST /api/v2/requests`: trả 201 `RegistrationRequestV2`. Chỉ chấp nhận đúng
  `contact`, `preferredDepartmentId` (UUID hoặc null), `description`, `sourceLanguage`.
- `GET /api/v2/requests?offset=0&limit=100`: danh sách theo quyền, sắp xếp CreatedAt
  giảm dần rồi ID tăng dần; phân trang sau lọc quyền.
- `GET /api/v2/requests/{id}`: chủ hồ sơ/phiên Guest được phép hoặc Reception đúng
  khoa xử lý đọc được. Không chạy response filter dịch mô tả ở hai đường đọc.

Tên/Patient lấy từ hồ sơ phiên; Guest chưa có tên phải cập nhật profile trước.
Contact 5–80 ký tự sau chuẩn hóa; mô tả là chuỗi tối đa 2000 ký tự, giữ nguyên
khoảng trắng/Unicode/xuống dòng. Ngôn ngữ nguồn chỉ vi/en/zh/ja và gắn lúc gửi;
đổi locale/profile về sau không thay nguồn nội dung cũ. Ngôn ngữ mô tả có lựa chọn
riêng trên form, không tự đổi khi chuyển giao diện.

Khoa xử lý do server chọn khoa CONSULT đang hoạt động. Nguyện vọng không tự
định tuyến, không quyết định quyền Reception và không dùng mô tả để suy khoa.
Không có cấu hình CONSULT hợp lệ trả 503 departmentInvalid; request không được lưu.

## Chống trùng và quyền

Trong cùng giao dịch có SQL application lock, kiểm tra Visit Active trước rồi
request Submitted/NeedsInformation theo Patient, bao gồm hồ sơ legacy. Trả 409
`activeVisitExists`/`pendingRequestExists`; chỉ thêm `existingVisitId` hoặc
`existingRequestId` nếu phiên hiện tại có quyền đọc. `existingRequestContract`
cho biết UI cần mở hồ sơ qua legacy hay prd-v2; không gộp dữ liệu Account/Guest.

Idempotency scope gồm prd-v2/actor phiên/lệnh/Patient. Xác thực và kiểm tra quyền
Patient trước receipt; retry cùng key/body trả lại snapshot 201, không thêm audit
hoặc request. Cùng key khác body trả 409 idempotencyConflict. Replay có thể cũ;
UI đọc lại chi tiết để xem trạng thái hiện tại.

Lệnh legacy tạo request/booking bị chặn nếu Patient có request V2 pending hoặc
Visit V2 Active. Legacy supplement, message, booking và confirm không được sửa
request V2. `canConfirm=false` cho đến khi PB-008 triển khai lệnh xác nhận V2.
Không tạo QR tiếp nhận trong luồng mới; lịch sử legacy vẫn đọc/in QR theo quyền.

## Migration và dữ liệu cũ

Migration `20261112153806_RegistrationUniquenessV2` bổ sung:

- `UX_Requests_V2PendingPatient`: unique PatientId khi SourceLanguage khác null
  và Status=Submitted.
- `UX_Visits_V2ActivePatient`: unique PatientId khi ExamStatus khác null và Status=Active.

Đây là ràng buộc cho dữ liệu V2 trên schema chuyển tiếp. PB-004 giữ SourceLanguage
và ExamStatus legacy là null khi không có căn cứ; không gán ngôn ngữ nguồn từ locale
profile hoặc coi đã xác nhận Completed từ nội dung cũ. API đọc request có SourceLanguage
khác null qua DTO V2; không bulk backfill SourceLanguage vào hồ sơ legacy để đổi hợp đồng.

Migration kiểm tra trùng trên tập V2 trước khi tạo index và dừng bằng lỗi 51006 nếu
vi phạm, không sửa/xóa hồ sơ. Dữ liệu legacy trùng được giữ để PB-002/030 đối chiếu;
guard giao dịch ngăn luồng tạo V2 đi qua xung đột đó. Hai index riêng không thay
kiểm tra chéo request–Visit. Cutover toàn bộ legacy vẫn thuộc PB-030 và PB-008.

Down chỉ gỡ hai index, không xóa cột hoặc dữ liệu. Đây là rollback cấu trúc đã thử
trên fixture, không tự cho phép downgrade môi trường dùng chung sau khi đã ghi V2.
Giữ backup và đối chiếu nguồn ngôn ngữ/trạng thái trước mọi cutover.

## Kiểm thử

Chạy từ `codes/` với API/database riêng:

```powershell
node --test --test-name-pattern=disabled tests/api/registration-v2.test.mjs
# Khởi động lại API với Workflow__PrdV2Enabled=true trên database kiểm thử
node --test --test-skip-pattern=disabled tests/api/registration-v2.test.mjs
npx.cmd playwright test --config playwright.registration.config.ts
dotnet run --project tests/registration/Registration.Tests.csproj -c Release
```

API tests cần `API_URL`, `DEMO_PASSWORD`, `ACCEPTANCE_DB` và cấu hình SQL fixture
như bộ acceptance hiện có. Migration tests cần `PB006_SQL_CONNECTION` trỏ local
SQL; runner tự tạo database HospitalAcceptance mới và giữ để đối chiếu, không dùng
database trong connection string đầu vào. Không ghi connection string/mật khẩu vào log.

CI chạy legacy khi flag tắt, kiểm tra 503, rồi khởi động API V2 để kiểm tra race,
validation, quyền, nội dung gốc và browser. Các test V2 có config Playwright riêng;
bộ browser mặc định tiếp tục nghiệm thu luồng legacy khi flag tắt. `sql-fixture.mjs`
bật QUOTED_IDENTIFIER qua `sqlcmd -I` vì database có filtered index.
