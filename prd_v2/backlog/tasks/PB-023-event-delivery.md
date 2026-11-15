# PB-023 Cập nhật gọi khám nhanh và sự kiện không trùng

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress |
| Người nhận | Codex (triển khai local theo yêu cầu) |
| Reviewer | Chưa phân công |
| Nhóm | Thuyết minh |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-010](./PB-010-doctor-accept.md), [PB-012](./PB-012-service-return.md), [PB-014](./PB-014-complete-examination.md), [PB-015](./PB-015-final-settlement.md) |
| Đối chiếu kế hoạch | P5a |
| Branch gợi ý | `feat/pb-023-event-delivery` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Chuẩn hóa sự kiện hướng dẫn/gọi số có ID và lần khám; endpoint cập nhật nhẹ cho client polling nhanh.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Support/SupportEndpoints.cs; Journeys/; Content/; Infrastructure/ApiSupport.cs; packages/shared/src/types.ts.

## Tiêu chí chấp nhận

- [x] Sự kiện chỉ đọc được sau commit và trong quyền Visit; có ID, số phiếu/phòng, ngôn ngữ/nội dung hoặc tham chiếu phiên bản.
- [x] Retry lệnh không tạo thông báo mới; sự kiện hết hiệu lực được nhận diện, reconnect không coi toàn bộ lịch sử là lời gọi mới.
- [x] Endpoint nhẹ hỗ trợ polling khoảng một giây khi foreground, có cách lấy trạng thái hiện hành; không yêu cầu rewrite sang microservice/realtime mới.

## Kiểm chứng bắt buộc

API permission, duplicate command, stale event và rollback; đo thử tải endpoint; hợp đồng client có ví dụ reconnect.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không phát âm thanh trên client; PB-024/025 tích hợp.

## Phối hợp và phụ thuộc

ApiSupport/Notification schema nếu thay đổi phải phối hợp migration; không đưa heartbeat vào khóa nghiệp vụ.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-023, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

## Triển khai local

Nhánh `feat/pb-023-event-delivery`. Hợp đồng, ví dụ reconnect, migration và lệnh kiểm chứng:
[PB-023-EVENT-DELIVERY](../../../codes/docs/requirements/PB-023-EVENT-DELIVERY.md).
Chưa có PR/reviewer/merge; trạng thái chưa phải Done.

Kiểm chứng local 15/11/2026: PB-023 8/8 ca API; 34/34 ca hồi quy PB-008/010/011/012/014/015;
migration schema cũ/giữ dữ liệu/downgrade/reupgrade, Release publish, typecheck, lint và web build đạt.
Mẫu tải cuối: 100 request, concurrency 10, p50 11 ms, p95 22 ms, max 27 ms, response tối đa 1368 byte.

