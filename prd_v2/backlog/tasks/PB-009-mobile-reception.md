# PB-009 Đồng bộ tiếp nhận và kích hoạt Journey trên mobile

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Mobile |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-003](./PB-003-remove-guest-link.md), [PB-008](./PB-008-confirm-reception.md) |
| Đối chiếu kế hoạch | P2b |
| Branch gợi ý | `feat/pb-009-mobile-reception` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Dùng hợp đồng tiếp nhận mới; mobile theo dõi yêu cầu và vào Journey Active, hiển thị phiếu mới.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/mobile/src/Reception.tsx, Journey.tsx, App.tsx, Auth.tsx; tests/android/.

## Tiêu chí chấp nhận

- [ ] Form giống phạm vi web: liên hệ, khoa tùy chọn, mô tả gốc/ngôn ngữ; request/Visit đã có mở lại đúng hồ sơ.
- [ ] Bỏ booking/QR kích hoạt/luồng liên kết; vẫn có Entry/deep link và quyền phục hồi phù hợp.
- [ ] Restart, mất mạng và đổi ngôn ngữ không tạo request/Visit mới hoặc mất dữ liệu đã lưu; phiếu giữ số khi in/xem lại.

## Kiểm chứng bắt buộc

Typecheck, kiểm tra native trên giả lập cho submit → confirm từ web → Journey, cold start/deep link và offline/retry.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không thêm tự phát hoặc hoàn thiện toàn bộ trạng thái khám, thuộc PB-022/025.

## Phối hợp và phụ thuộc

App/Journey/Auth mobile dùng chung PB-020/022; tách commit/component nhỏ để review.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-009, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

