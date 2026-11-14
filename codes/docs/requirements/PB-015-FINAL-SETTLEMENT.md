# PB-015 — Quyết toán cuối và đóng Visit/Journey

Cashier đúng khoa quyết toán sau khi bác sĩ đã xác nhận kết thúc khám, công bố kết
quả và hoàn tất mọi dịch vụ. `Final` và `NoPaymentRequired` dùng cùng điều kiện,
đều đóng Visit và Journey trong một giao dịch; không tính phí hoặc thu tiền online.

## API

- `GET /api/v2/cashier/visits?offset=0`: Cashier, `VisitSummaryV2[]`, tối đa 100 dòng;
  lọc khoa và điều kiện trước phân trang, xếp thời điểm kết thúc khám rồi Id.
- `GET /api/v2/visits/{id}`: quyền theo Visit hiện có; `canSettle` chỉ bật cho Cashier
  đúng khoa khi đủ điều kiện. Cashier vẫn không được đọc clinical-record.
- `POST /api/v2/visits/{id}/settlement`: Cashier đúng khoa, Idempotency-Key 8–100 ký tự,
  body chính xác `{version, workRevision, outcome}`, trả VisitV2 sau lưu với HTTP 200.
  Outcome chỉ `Final` hoặc `NoPaymentRequired`; trường lạ/thiếu/trùng bị từ chối.
- Tất cả endpoint V2 yêu cầu `Workflow:PrdV2Enabled`; tắt trả 503 workflowNotEnabled.

Điều kiện chung trong `FinalSettlements.Eligible`: Visit V2 có phiếu snapshot Captured,
Visit/Journey Active, ExamStatus Completed và ExaminationCompletedAt; ClinicalRecord
đã xác nhận/công bố trước hoặc cùng thời điểm kết thúc khám; mọi order Completed;
có Consultation Completed; mọi bước ngoài Settlement là Consultation,
ReturnConsultation hoặc Service đã Completed; đúng một Settlement Ready do Cashier
xử lý. Skipped/Cancelled và Pharmacy không được hợp thức hóa thành hoàn tất.

POST kiểm tra Visit.version và WorkRevision; lỗi tương ứng conflict và
workRevisionConflict (409). Thiếu khám/kết quả trả examinationNotCompleted, còn công
việc chuyên môn trả servicesNotCompleted; workflow bất nhất trả invalidExamStatus.
Input sai trả 422 validation, sai quyền/phạm vi trả 403; Visit đã đóng với key mới
không được ghi đè outcome. Replay được kiểm tra quyền trước khi trả receipt.

## Giao dịch và tương thích

CommandBus giữ khóa SQL trong transaction, serialize các lệnh giữa các process.
Ghi FinalSettlementRevision/Outcome, Visit Closed/ClosedAt, Settlement Completed,
Journey Completed/CompletedAt/CompletionSource=FinalSettlement, audit, notification
và receipt nguyên tử. Cùng một thời điểm UTC dùng cho ba thời điểm đóng/hoàn tất.
Giữ ExamStatus Completed, phiếu và WorkRevision; Visit/Journey/step version tăng.
Response có currentStep/currentStepId null, canSettle false. Cùng key/payload trả
nguyên snapshot đã lưu; cùng key khác payload trả idempotencyConflict. Client refresh
trước hành động mới. Lỗi lưu receipt cũng rollback toàn bộ thay đổi trước đó.

Settlement/pharmacy/complete-guidance legacy chặn Visit V2 trước receipt replay.
Không tạo Pharmacy trong Journey V2, không cấp canCompleteGuidance cho V2.
Legacy Final/NoPaymentRequired cũng bị chặn trước khi hoàn tất công việc; legacy
Intermediate chỉ hoàn tất thanh toán riêng lẻ. Evaluate không tự đóng Visit Active
từ quyết toán sớm cũ: chỉ lệnh quyết toán cuối legacy mới cho phép nhánh đóng cũ.
Giữ đường đọc hồ sơ và hướng dẫn nhà thuốc lịch sử; không backfill hoặc tự chuyển
Skipped/Cancelled/Pharmacy cũ thành Completed. Không đổi schema hoặc thêm package.

## Web và kiểm chứng

Cashier có workspace riêng, danh sách chờ, chọn phiếu, hai outcome và checkbox review.
Version thay đổi làm mất review; gửi lỗi sẽ refresh và yêu cầu kiểm tra lại. Không tự
chuyển Visit đang chọn khi danh sách thay đổi. Patient đọc Closed/Completed qua
JourneyReader hiện có và thấy completion card sau polling. Nhãn UI đủ sáu locale
đang dùng; thiết kế Journey tổng thể/mobile tiếp tục ở PB-021/022.

Chạy từ `codes/`, dùng SQL localhost Windows authentication và database fixture mới:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/final-settlement/run.ps1 -SqlServer '.\SQLEXPRESS' -Regression -Capture
npm run typecheck
npm run lint
npm run test:languages:unit
dotnet build backend/Hospital.Api/Hospital.Api.csproj -c Release --no-restore
dotnet ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build
```

Runner build/publish, API guards/outcomes/replay/rollback/race, browser Cashier và
Patient trên desktop/mobile viewport, rồi hồi quy PB-014/013/012/011/010/008 và API
legacy với cờ V2 tắt.
Fixture được giữ, process dừng và env khôi phục khi kết thúc. CI native có phase
PB-015 riêng. API legacy acceptance được đổi expected behavior cho quyết toán sớm.
