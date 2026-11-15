# PB-025 Tự phát hướng dẫn và gọi số trên mobile

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — đã triển khai local, chờ nghiệm thu thiết bị/review/merge |
| Người nhận | Codex (triển khai local theo yêu cầu) |
| Reviewer | Chưa phân công |
| Nhóm | Thuyết minh |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-019](./PB-019-assistance.md), [PB-022](./PB-022-mobile-journey.md), [PB-023](./PB-023-event-delivery.md) |
| Đối chiếu kế hoạch | P5a |
| Branch gợi ý | `feat/pb-025-mobile-narration` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Tích hợp Expo Speech với event/call mới, điều khiển tự phát và xử lý vòng đời mobile.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/mobile/src/Journey.tsx, runtime.tsx; tests/unit/native-narration.test.mjs; tests/android/.

## Tiêu chí chấp nhận

- [ ] Gọi số/hướng dẫn đúng sự kiện và ngôn ngữ; bật mặc định khi được phép, có tắt/nghe lại/văn bản.
- [ ] Dừng khi rời màn hình/đổi phiên/ngôn ngữ; callback cũ không phát nội dung của người trước; không lặp vì polling.
- [ ] Background ngừng polling không cần thiết; foreground tải trạng thái mới và bỏ sự kiện cũ, giữ fallback khi thiếu giọng.

## Kiểm chứng bắt buộc

Unit narration cancellation/stale callbacks; giả lập foreground/background/reconnect; kiểm tra giọng thực tế nếu thiết bị hỗ trợ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không tích hợp push nền hoặc RTLS.

## Phối hợp và phụ thuộc

Runtime mobile nối tiếp PB-022; đồng bộ quy tắc ưu tiên âm thanh với PB-024.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-025, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

## Triển khai local

Đã tích hợp Expo Speech, bật/tắt tự phát, nghe lại và văn bản, polling PB-023,
chống lặp theo nội dung và hủy request/callback cũ khi đổi phiên/ngôn ngữ/bước.
Background dừng tiếng/polling; foreground xác thực lại trạng thái và bỏ lịch sử.
Chi tiết kiểm chứng và giới hạn: [PB-025-MOBILE-NARRATION](../../../codes/docs/requirements/PB-025-MOBILE-NARRATION.md).
Ngày 15/11/2026: 67/67 ca native, 3/3 ca ngôn ngữ, typecheck, lint, web build
và Expo Android export đạt; script narration (21 ca) đã nối vào CI hiện hữu.
Giữ checklist nghiệm thu chưa đóng: chưa có SDK platform 36 để build/cài APK,
chưa chạy gate thiết bị/âm thanh thật; chưa xác nhận dependency merge hoặc có
PR/reviewer/merge. Không coi kiểm thử mô phỏng là nghiệm thu thiết bị.

