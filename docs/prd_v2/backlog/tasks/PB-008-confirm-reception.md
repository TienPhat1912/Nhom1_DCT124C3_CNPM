# PB-008 Xác nhận tiếp nhận và mở Journey ngay trên web

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Tiếp nhận |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-005](./PB-005-clinic-assignment.md), [PB-006](./PB-006-registration-request.md), [PB-007](./PB-007-ticket-number.md) |
| Đối chiếu kế hoạch | P2b |
| Branch gợi ý | `feat/pb-008-confirm-reception` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Lệnh xác nhận tạo Visit/Journey Active, phiếu và grant nguyên tử; Staff web chọn phòng, xác minh, xác nhận/in lại; Patient web mở Journey không cần redeem.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Reception/ReceptionEndpoints.cs; Journeys/Workflow.cs; apps/web/src/StaffReception.tsx, PatientJourney.tsx, App.tsx.

## Tiêu chí chấp nhận

- [ ] Hai nhân viên xác nhận cùng yêu cầu không tạo hai Visit/phiếu; kiểm tra lại Patient, phòng và bác sĩ trong giao dịch.
- [ ] Ghi cố định phòng/bác sĩ và snapshot; phiếu đúng số; in lại cùng Visit/ticket; phòng bận khám vẫn nhận thêm hàng chờ.
- [ ] Không cần QR tiếp nhận/kích hoạt trong luồng web mới; Entry và link phiếu cũ kiểm tra quyền, không tạo thêm lượt.

## Kiểm chứng bắt buộc

API confirm cạnh tranh/rollback/grant; browser Reception → Patient Journey; in lại giữ số và reload giữ tiến độ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Chưa thay workflow khám/dịch vụ; không tự sửa tài liệu PRD đang được trợ lý khác viết.

## Phối hợp và phụ thuộc

Workflow.cs/PatientJourney.tsx là điểm dùng chung; PB-010/021 chỉ bắt đầu sau merge.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-008, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

