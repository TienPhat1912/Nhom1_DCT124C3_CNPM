# PB-015 Quyết toán cuối và đóng Visit cùng Journey

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Thu ngân |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-014](./PB-014-complete-examination.md) |
| Đối chiếu kế hoạch | P3b |
| Branch gợi ý | `feat/pb-015-final-settlement` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Danh sách Visit đủ điều kiện, hai outcome Final/NoPaymentRequired và giao dịch đóng Visit/Journey.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Journeys/JourneyEndpoints.cs, Workflow.cs; apps/web/src/StaffClinical.tsx; tests/api/.

## Tiêu chí chấp nhận

- [ ] Không ghi quyết toán cuối trước khi khám Completed và dịch vụ xong; quyền Cashier đúng phạm vi.
- [ ] Final và NoPaymentRequired đều đóng Visit/Journey cùng giao dịch; payment riêng lẻ nếu còn hỗ trợ không đóng Visit.
- [ ] Journey mới không có bước nhà thuốc chờ bệnh nhân bấm hoàn tất; API complete-guidance/pharmacy cũ không làm sai quy tắc. Không tự chuyển dữ liệu legacy thành đã hoàn tất.

## Kiểm chứng bắt buộc

API premature settlement, both outcomes, duplicate/rollback, old endpoint bypass; browser Cashier và Patient đọc trạng thái.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không tính hóa đơn, thanh toán online hoặc bảo hiểm.

## Phối hợp và phụ thuộc

Workflow.cs dùng chung; đây là gói chốt cuối vòng nghiệp vụ trước UI Journey tổng thể.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-015, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

