# PB-020 Tra cứu và khôi phục lượt Guest bằng phiếu

| Trường | Giá trị |
|---|---|
| Trạng thái | In Progress |
| Người nhận | phuch (Codex hỗ trợ) |
| Reviewer | Chưa phân công |
| Nhóm | Tài khoản |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-003](./PB-003-remove-guest-link.md), [PB-008](./PB-008-confirm-reception.md), [PB-009](./PB-009-mobile-reception.md) |
| Đối chiếu kế hoạch | P2b / UC-15 cũ |
| Branch gợi ý | `feat/pb-020-guest-recovery` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Hoàn thiện tìm Visit theo số/ngày/phòng và quy trình Reception xác minh rồi cấp lại quyền Guest.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Reception/ReceptionEndpoints.cs; Identity/IdentityEndpoints.cs; apps/web/src/StaffReception.tsx, Auth.tsx; apps/mobile/src/Auth.tsx.

## Tiêu chí chấp nhận

- [x] Số 001 khác phòng/ngày không bị lấy nhầm; nhiều kết quả phải chọn và xác minh đúng Visit.
- [x] Chỉ Reception đúng phạm vi cấp recovery một lần, hết hạn rõ; bệnh nhân nhận cùng Visit/Journey với quyền được phép.
- [x] Khôi phục không đổi profile lịch sử, không tạo Visit, không cấp lịch sử cho Account độc lập; không dùng lại mã đã tiêu thụ.

## Kiểm chứng bắt buộc

API lookup scope, collision room/day, expired/replay claim; browser cấp/đổi thiết bị; native mở recovery và xem cùng Journey.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không khôi phục bằng họ tên đơn thuần hoặc làm lại chức năng liên kết Guest.

## Phối hợp và phụ thuộc

Auth/StaffReception tiếp nối các gói đã merge; hạn chế đổi luồng đăng nhập độc lập.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Đã triển khai và kiểm thử API/browser, regression logic native trên
`feat/pb-020-guest-recovery`; chờ PR, review và merge. Nghiệm thu trên giả lập/thiết bị
Android còn thiếu vì môi trường chưa có SDK/JDK/adb. Giữ In Progress chờ nghiệm
thu native, PR, review và merge. Chi tiết:
[PB-020](../../../codes/docs/requirements/PB-020-guest-recovery.md).

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-020, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

