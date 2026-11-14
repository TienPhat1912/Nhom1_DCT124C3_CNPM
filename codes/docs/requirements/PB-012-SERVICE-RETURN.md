# PB-012 — Hoàn tất dịch vụ và trở lại hàng chờ

Service có danh sách **Chưa hoàn tất / Hoàn tất** theo khoa được phân công,
đọc snapshot dịch vụ/địa điểm, số phiếu, bệnh nhân và ghi chú chỉ định. Nút
**Hoàn tất dịch vụ** chỉ xác nhận đã thực hiện; không có trường nhập kết quả
xét nghiệm/chẩn đoán hình ảnh. Danh sách phân trang 100 dòng, tự cập nhật 5 giây,
có trạng thái tải/rỗng/lỗi và giữ khả năng retry khi lỗi mạng.

## Hành vi và hợp đồng

- `GET /api/v2/service/orders?status=NotCompleted&offset=0` trả
  `ServiceOrderWorkItemV2[]`; `status` nhận `NotCompleted` hoặc `Completed`.
  Mỗi dòng có Visit version, order version và `canComplete`. Quyền được xác định
  bởi DepartmentId của bước Service đã xác nhận, không theo catalog đang thay đổi.
- `POST /api/v2/visits/{id}/orders/{orderId}/complete` nhận chính xác
  `{ version, orderVersion }` là số nguyên dương và `Idempotency-Key` bắt buộc.
  Chỉ Service đúng khoa của order thuộc Visit được phép gọi, kể cả khi replay
  receipt. Doctor/Reception/Patient/Admin không được hoàn tất thay Service.
- Kiểm tra version của Visit và order trước guard; order đã Completed với version
  mới trả `409 orderAlreadyCompleted`. Cùng key/body trả receipt cũ; key cũ/body
  khác trả `409 idempotencyConflict`; version cũ trả `409 conflict`.
- Guard yêu cầu Active Visit/Journey, snapshot Captured, ExamStatus InService,
  order NotCompleted thuộc vòng khám hiện tại và bước Service Ready hiện hành.
  Payload kết quả hoặc trường thừa bị từ chối `422 validation`.
- Trong một transaction CommandBus: order và Service thành Completed; lưu
  CompletedById/CompletedAt; thêm đúng một ReturnConsultation Ready cùng snapshot
  phòng gốc, giữ số phiếu; Visit thành Waiting; gắn dependency Settlement vào bước
  quay lại; tăng version Visit/Journey/order/step, audit và notification cùng commit.
  Lỗi bất kỳ rollback cả receipt và tất cả thay đổi.
- Không tăng ConsultationCount, WorkRevision, không tạo ConsultationCall và không
  tự vào InConsultation. Queue của Doctor hiện bệnh nhân Waiting theo số phiếu gốc.
  Ca khác đang khám được giữ nguyên; bác sĩ phải nhận lại trước khi chỉ định tiếp.
  Mỗi lần nhận lại/chỉ định/hoàn tất tiếp theo tạo một vòng độc lập.
- ReturnRequired của catalog không thay quyết định tự quay lại của V2. Snapshot
  không bị viết lại khi tên/phòng trong catalog thay đổi.
- `GET /api/v2/visits/{id}` tính `canCompleteService` theo Service và khoa; order
  Completed có `completedBy` và timestamp UTC. V2 order không bị workflow legacy
  đổi từ Completed thành Resolved. Lệnh progress/skip/queue legacy vẫn bị chặn
  cho Visit V2. Luồng mới vẫn nằm sau `Workflow:PrdV2Enabled`.

## Mã và schema

Backend: ServiceReturns.cs, Workflow.cs, DoctorConsultations.cs và đăng ký route
trong Program.cs. Web: ServiceOrders.tsx, StaffClinical.tsx và App.tsx để Service
mở danh sách V2 trực tiếp. Nhãn đủ sáu locale đang hỗ trợ. Shared thêm DTO danh sách,
giữ nguyên CompleteServiceInputV2 của PB-001.

Không có migration mới: PB-011 đã thêm CompletedById/CompletedAt và các snapshot,
index/concurrency token cần dùng. Không đổi sáu quyết định nghiệp vụ hoặc plan chính.

## Kiểm thử

Chạy từ `codes/`, cần SQL Server localhost/LocalDB và Windows authentication:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/service-return/run.ps1 -SqlServer localhost -Regression -Capture
npm run typecheck
npm run lint
npm run test:languages:unit
```

Runner build web, publish Release, tạo database `HospitalAcceptance_<timestamp>`
mới; chạy API PB-012 và browser Service/Doctor trên Chromium desktop + Pixel 7
viewport. `-Regression` tạo database mới cho từng suite PB-011, PB-010, PB-008.
`-Capture` lưu ảnh synthetic ở `artifacts/*-pb012-{service,doctor}.png`.
Runner dừng process API sau test, khôi phục biến môi trường và giữ database fixture.
Không dùng database demo/online; không sửa/xóa dữ liệu dùng chung.

API suite kiểm tra scope và thu hồi quyền trước replay, role, payload/version,
order/Visit không khớp, hai vòng tuần tự, A xong dịch vụ khi bác sĩ đang khám B,
race khác key, retry cùng key, audit/notification không trùng, rollback bằng SQL
trigger, trạng thái không hợp lệ và snapshot khi catalog đổi. Browser kiểm tra
danh sách, nút hoàn tất, lịch sử sau reload, không nhập kết quả, A chờ khi B còn
đang khám, bác sĩ nhận lại và Service hoàn tất vòng hai.

CI `scripts/test/ci-native.ps1` thêm phase PB-012 trên database riêng sau PB-011;
browser V2 được tách khỏi default legacy suite bằng playwright.service.config.ts.
Kết quả local và giới hạn môi trường được ghi trong task card PB-012.

## Nội dung PR đề xuất

**Tiêu đề:** `[PB-012] Hoàn tất dịch vụ và tự trở lại hàng chờ phòng cũ`

Trước đây Visit V2 InService chưa có lệnh hoàn tất. Service đúng khoa nay có danh
sách và nút hoàn tất; transaction cập nhật order/step, đưa Visit về Waiting ở phòng
và bác sĩ gốc, giữ số phiếu. Retry không lặp bước quay lại và không chiếm ca đang
khám của người khác. Bổ sung provenance, UTC, API/browser/rollback/race tests và
CI; không có migration. Bác sĩ phải nhận lại trước khi chỉ định dịch vụ tiếp theo.
