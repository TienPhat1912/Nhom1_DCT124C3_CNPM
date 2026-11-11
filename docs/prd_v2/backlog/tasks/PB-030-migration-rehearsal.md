# PB-030 Kiểm chứng nâng cấp và phương án khôi phục dữ liệu

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Nghiệm thu |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-002](./PB-002-legacy-audit.md), [PB-005](./PB-005-clinic-assignment.md), [PB-007](./PB-007-ticket-number.md), [PB-013](./PB-013-clinical-catalog.md), [PB-015](./PB-015-final-settlement.md), [PB-020](./PB-020-guest-recovery.md), [PB-028](./PB-028-presence-api.md) |
| Đối chiếu kế hoạch | P6 / mục 6 |
| Branch gợi ý | `feat/pb-030-migration-rehearsal` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Ghép các migration đã có thành quy trình nâng cấp thử trên database mới và bản sao legacy; viết báo cáo và hướng dẫn rollback.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: scripts/test/ hoặc tests/migration/; backend/Hospital.Api/Migrations/; docs/guides/ (hướng dẫn nâng cấp).

## Tiêu chí chấp nhận

- [ ] Giữ ID/lịch sử/grant/snapshot; không tự đóng ca, đổi bác sĩ, đổi Cancelled/Skipped thành Completed hoặc tách lịch sử Guest đã liên kết.
- [ ] Các ca nhiều order/phòng nhiều ca hoặc thiếu dữ liệu bị chặn cutover có báo cáo; không dùng xóa dữ liệu để vượt constraint.
- [ ] Có thứ tự backup → audit → migrate → kiểm tra → bật luồng mới; thử khôi phục trên database riêng và ghi giới hạn downgrade.

## Kiểm chứng bắt buộc

Rehearsal đầy đủ trên fixture legacy gồm ca xung đột và sạch; kiểm tra số lượng/FK/ownership trước sau; chạy lại không làm nhân đôi.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không chạy migration/reset trên database demo/online của nhóm trong task này.

## Phối hợp và phụ thuộc

Chỉ bắt đầu sau các schema liên quan đã merge; có thêm migration thì cập nhật rehearsal trước release.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-030, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

