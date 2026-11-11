# PB-024 Tự phát hướng dẫn và gọi số trên web

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Thuyết minh |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-018](./PB-018-request-translation.md), [PB-019](./PB-019-assistance.md), [PB-021](./PB-021-web-journey.md), [PB-023](./PB-023-event-delivery.md) |
| Đối chiếu kế hoạch | P5a |
| Branch gợi ý | `feat/pb-024-web-narration` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Tích hợp sự kiện hướng dẫn, bật/tắt tự phát, nghe lại và phát thủ công khi trình duyệt chặn.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/web/src/PatientJourney.tsx, components.tsx, runtime.tsx; tests/browser/.

## Tiêu chí chấp nhận

- [ ] Tự phát mặc định khi được phép; gọi đúng số/phòng/ngôn ngữ; không lặp theo mỗi lần polling hoặc Visit.Version.
- [ ] Tắt tự phát vẫn nghe lại được; đổi Visit/bước/ngôn ngữ dừng tiếng cũ; logout và request/callback đến muộn không phát sai người.
- [ ] Có văn bản/nút phát khi thiếu giọng/autoplay bị chặn; polling nhanh chỉ khi màn hình hoạt động và dọn timer đúng.

## Kiểm chứng bắt buộc

Browser mocked speech kiểm tra auto/manual/dedup/cancel/failure; đo commit → hiển thị, kiểm tra âm thanh thực tế riêng khi có giọng.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không cam kết phát lúc tab/app đã đóng; bản đồ speech thuộc PB-026.

## Phối hợp và phụ thuộc

components/runtime dùng chung; không sửa authentication ngoài cleanup cần thiết.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-024, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

