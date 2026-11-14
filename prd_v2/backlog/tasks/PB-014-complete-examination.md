# PB-014 Chẩn đoán từ danh mục và xác nhận kết thúc khám

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/test local hoàn tất; chờ review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Chẩn đoán |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-012](./PB-012-service-return.md), [PB-013](./PB-013-clinical-catalog.md) |
| Đối chiếu kế hoạch | P3b |
| Branch gợi ý | `feat/pb-014-complete-examination` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Doctor chọn danh mục, xem mẫu Việt, chỉnh hoặc hủy; lệnh xác nhận nguyên tử lưu kết quả và kết thúc khám.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Content/ContentEndpoints.cs; Journeys/Workflow.cs; apps/web/src/StaffContent.tsx, StaffClinical.tsx; packages/shared/src/types.ts.

## Tiêu chí chấp nhận

- [x] Chỉ bác sĩ đúng Visit InConsultation, không còn order chưa xong mới xác nhận; preview không công bố.
- [x] Sửa lựa chọn quay lại preview; thay mẫu/phiên bản trước confirm bị phát hiện; confirm lưu snapshot, tác giả, thời điểm và ExamStatus Completed.
- [x] Kết quả được công bố ngay, Journey tới quyết toán; đóng đường publish/progress cũ có thể công bố hoặc hoàn tất khám sớm. Retry không tạo nhiều kết quả.

## Kiểm chứng bắt buộc

API guard/atomic rollback/retry/stale preview; browser lựa chọn → sửa → hủy → xác nhận; patient API không thấy nháp.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không làm AI chẩn đoán, nhập kết quả dịch vụ hoặc sửa nội dung lịch sử đã xác nhận.

## Phối hợp và phụ thuộc

Tách form chẩn đoán khỏi bảng queue để tránh sửa toàn StaffClinical.tsx.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai trên nhánh hiện có `AnhBao_PB014_complete_examination`, base `b04bca7`
(PB-013 PR #27), đã có PB-012 PR #26 (`0caec24`). Chưa có PR/reviewer PB-014 nên
không đánh Done hoặc tự merge.

- [Hợp đồng và hướng dẫn PB-014](../../../codes/docs/requirements/PB-014-COMPLETE-EXAMINATION.md).
- [API tests](../../../codes/tests/api/complete-examination.test.mjs),
  [browser tests](../../../codes/tests/browser/complete-examination.spec.ts),
  [runner local riêng](../../../codes/tests/complete-examination/run.ps1).
- Backend Examinations xử lý preview/confirm/read record; dùng schema PB-013,
  không có migration hoặc package mới. PreviewId là opaque Data Protection token
  (string theo hợp đồng), gắn Visit/doctor/version/config, hạn 5 phút, không lưu
  bản nháp trong database. Không nhận tác giả/nội dung kết quả từ client.
- Confirm khóa cấu hình, kiểm tra lại state/catalog/template, lưu record/link
  snapshots và UTC, kết thúc bước khám/ExamStatus, audit/notify/receipt cùng commit.
  Visit/Journey vẫn Active, Settlement Ready; không đổi số phiếu/WorkRevision.
- ContentReader V2 đọc ClinicalRecord đã công bố; drafts/publish cũ V2 trả 410
  trước receipt. Giữ guard progress/skip/queue/settlement legacy. Auto-close legacy
  không áp dụng V2; PB-015 tiếp tục quyết toán.
- ExaminationForm tách khỏi queue, đủ sáu locale, chọn/search/pagination → preview
  → edit/cancel → review/confirm; workspace giữ kết quả đã xác nhận và tác giả.
- File chung: Program.cs, ContentEndpoints.cs, DoctorConsultations.cs, Workflow.cs,
  DoctorQueue.tsx, ci-native.ps1 và playwright.config.ts. Giữ shared DTO PB-001.

### Kiểm chứng local ngày 14/11/2026

| Lệnh/kịch bản (từ codes/) | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/complete-examination/run.ps1 -Regression -Capture` | PASS, runner exit 0 | `.local/pb014-final.log`; web build/Release publish/API/browser/hồi quy |
| Chạy chốt `tests/complete-examination/run.ps1 -Capture` | PASS, runner exit 0; API 4/4, browser 2/2 | `.local/pb014-guards-final.log`; thêm confirm sai role, preview chéo Visit đang khám và thu hồi phân công trước replay; fixture `HospitalAcceptance_1794629580758` |
| `node --test tests/api/complete-examination.test.mjs` (runner) | PASS 4/4 | Permission/guard, strict input, private preview, stale template/catalog, legacy bypass, rollback/replay/race, snapshots và dịch vụ → nhận lại → kết thúc |
| `npx playwright test --config playwright.examination.config.ts` (runner) | PASS 2/2 | Chromium desktop/Pixel 7 viewport; chọn, sửa, hủy, confirm; patient API không thấy nháp |
| Hồi quy API PB-013 / PB-012 / PB-011 / PB-010 / PB-008 | PASS 7/7 / 6/6 / 6/6 / 5/5 / 7/7 | Mỗi suite dùng fixture mới riêng |
| `dotnet build backend/Hospital.Api/Hospital.Api.csproj -c Release --no-restore` | PASS, 0 warning/error | Runner cũng publish Release thành công |
| `dotnet ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build` | PASS | Model không đổi, không thiếu migration |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS | Web/mobile/shared/contracts; build cảnh báo chunk lớn hơn 500 kB |
| `npm run test:languages:unit` | PASS 3/3 | Dictionary sáu locale |
| `git diff --check`; parser PowerShell runner/CI | PASS | Không lỗi whitespace/cú pháp |

Fixture PB-014 `HospitalAcceptance_1794629456829`; hồi quy PB-013/012/011/010/008:
`HospitalAcceptance_1794629477618`, `HospitalAcceptance_1794629489316`,
`HospitalAcceptance_1794629504013`, `HospitalAcceptance_1794629517919`,
`HospitalAcceptance_1794629528100`. Chỉ SQL localhost Windows authentication;
không ghi database demo/online. Giữ fixture, dừng process và khôi phục env sau test.
Ảnh synthetic `codes/artifacts/chromium-{desktop,mobile}-pb014.png` được tạo với
Capture; ảnh mobile đã xem, không có lỗi bố cục quan sát được.

Lần chạy đầu phát hiện Results.Json(null) không có JSON body; đã sửa thành JSON
null rõ ràng và chạy lại đạt. Preview mã hóa kiểm tra token giả, binding và stale
catalog; chưa kiểm chứng hết hạn bằng đồng hồ giả hoặc triển khai nhiều instance.
Chưa chạy toàn bộ GitHub CI/default legacy API/browser, Android hoặc migration
regression trong phiên này; không thay schema/mobile. CI thêm phase PB-014 riêng.
Local .NET SDK 10.0.401, Node 24.19.0 (manifest Node 22); build có cảnh báo chunk,
Node có warning module type/console color. SQL cần chạy ngoài sandbox của máy.

### Nội dung PR đề xuất

**Tiêu đề:** `[PB-014] Xác nhận kết quả từ danh mục và kết thúc khám nguyên tử`

Doctor đang khám chọn danh mục và mẫu Việt, review/edit/cancel trước confirm.
Preview riêng tư có binding/expiry/config fingerprint; xác nhận lưu snapshot và
công bố cùng ExamStatus Completed, Journey tới quyết toán và giải phóng ca khám.
Đóng drafts/publish legacy cho V2, giữ lịch sử cũ; thêm API/browser/race/rollback
tests và CI. Không có migration; quyết toán cuối tiếp tục ở PB-015.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-014, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

