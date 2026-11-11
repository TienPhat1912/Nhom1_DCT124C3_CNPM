# PB-014 Chẩn đoán từ danh mục và xác nhận kết thúc khám

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
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

- [ ] Chỉ bác sĩ đúng Visit InConsultation, không còn order chưa xong mới xác nhận; preview không công bố.
- [ ] Sửa lựa chọn quay lại preview; thay mẫu/phiên bản trước confirm bị phát hiện; confirm lưu snapshot, tác giả, thời điểm và ExamStatus Completed.
- [ ] Kết quả được công bố ngay, Journey tới quyết toán; đóng đường publish/progress cũ có thể công bố hoặc hoàn tất khám sớm. Retry không tạo nhiều kết quả.

## Kiểm chứng bắt buộc

API guard/atomic rollback/retry/stale preview; browser lựa chọn → sửa → hủy → xác nhận; patient API không thấy nháp.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không làm AI chẩn đoán, nhập kết quả dịch vụ hoặc sửa nội dung lịch sử đã xác nhận.

## Phối hợp và phụ thuộc

Tách form chẩn đoán khỏi bảng queue để tránh sửa toàn StaffClinical.tsx.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-014, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

