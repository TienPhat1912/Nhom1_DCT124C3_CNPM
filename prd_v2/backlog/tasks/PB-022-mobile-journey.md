# PB-022 Hoàn thiện Journey bốn trạng thái trên mobile

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Mobile |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-009](./PB-009-mobile-reception.md), [PB-012](./PB-012-service-return.md), [PB-015](./PB-015-final-settlement.md) |
| Đối chiếu kế hoạch | P3 / QD-03 |
| Branch gợi ý | `feat/pb-022-mobile-journey` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Đồng bộ trải nghiệm trạng thái và điểm đến trên mobile theo cùng DTO web.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/mobile/src/Journey.tsx, App.tsx, runtime.tsx, ui.tsx; tests/android/.

## Tiêu chí chấp nhận

- [ ] Chuyển đúng Waiting/InConsultation/InService/Completed; dịch vụ xong về phòng cũ, giữ Visit/phiếu.
- [ ] Restart/deep link/reconnect giữ đúng Visit; dữ liệu cũ được đánh dấu; đổi phiên xóa dữ liệu nhạy cảm.
- [ ] Không còn kích hoạt, liên kết hoặc tự hoàn tất nhà thuốc; thao tác nghe/chỉ đường/hỗ trợ dễ truy cập, chữ lớn không cắt nội dung.

## Kiểm chứng bắt buộc

Typecheck/build native; giả lập happy path, app restart, offline/retry, font scaling và deep link.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Chưa thêm tự phát TTS; PB-025 phụ trách.

## Phối hợp và phụ thuộc

Runtime/Journey mobile dùng chung PB-025/029; tránh cùng sửa lúc đang In progress.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-022, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

