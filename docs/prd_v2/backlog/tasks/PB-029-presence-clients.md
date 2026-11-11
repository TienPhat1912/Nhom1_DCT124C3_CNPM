# PB-029 Heartbeat web/mobile và thẻ online trên Dashboard

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Dashboard |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-021](./PB-021-web-journey.md), [PB-022](./PB-022-mobile-journey.md), [PB-028](./PB-028-presence-api.md) |
| Đối chiếu kế hoạch | P5b |
| Branch gợi ý | `feat/pb-029-presence-clients` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Client gửi heartbeat khi sử dụng; Admin xem số online với thời điểm cập nhật và trạng thái mất kết nối.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/web/src/runtime.tsx, AdminDashboard.tsx; apps/mobile/src/runtime.tsx, App.tsx; tests/browser/admin.spec.ts.

## Tiêu chí chấp nhận

- [ ] Heartbeat khoảng 15 giây khi foreground; đổi phiên/logout dừng nhịp cũ; cleanup không tạo nhiều timer theo render.
- [ ] Dashboard refresh khoảng 5 giây, hiển thị số từ API và updatedAt; lỗi mạng không biến số cũ thành số mới.
- [ ] Guest/Account độc lập, nhiều tab Account không cộng trùng; foreground trở lại cập nhật đúng; mobile background không tiếp tục tự khai đang dùng.

## Kiểm chứng bắt buộc

Browser multi-tab/logout/stale state; native lifecycle và switch session; timer test có fake clock; API-integrated count.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không viết lại layout Dashboard hoặc các biểu đồ hiện có.

## Phối hợp và phụ thuộc

Runtime web/mobile dùng chung; lấy code sau PB-021/022 và phối hợp nếu PB-024/025 đang sửa.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-029, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

