# PB-011 Chỉ định đúng một dịch vụ và khóa sau xác nhận

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Khám bệnh |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-010](./PB-010-doctor-accept.md) |
| Đối chiếu kế hoạch | P3a / QD-04 |
| Branch gợi ý | `feat/pb-011-single-order` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Form một dịch vụ → xem trước → xác nhận; API tạo order bất biến và chuyển InService.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Journeys/JourneyEndpoints.cs, Workflow.cs; Infrastructure/HospitalDb.cs; apps/web/src/StaffClinical.tsx.

## Tiêu chí chấp nhận

- [ ] Chỉ bác sĩ đang khám được xác nhận; tối đa một order chưa xong/Visit, được bảo vệ khi thao tác đồng thời.
- [ ] Commit tạo đúng một order, chuyển InService, đích dịch vụ, loại khỏi hàng chờ và nhả ca; phòng nhận bệnh nhân khác được.
- [ ] API/UI sửa/hủy order và skip/progress trái quy tắc bị chặn. Cấu hình dịch vụ/địa điểm đổi sau preview thì yêu cầu xem lại.

## Kiểm chứng bắt buộc

API single-order race, rollback, old update/cancel bypass; browser preview/cancel trước confirm/confirm; kiểm tra currentStep không giữ consultation cũ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không lưu kết quả chuyên môn hoặc cho nhiều dịch vụ song song; complete thuộc PB-012.

## Phối hợp và phụ thuộc

Thay workflow và migration index order; rebase snapshot mới nhất trước tạo migration.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-011, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

