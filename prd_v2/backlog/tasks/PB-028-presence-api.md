# PB-028 Heartbeat và API thống kê trực tuyến

| Trường | Giá trị |
|---|---|
| Trạng thái | In Progress |
| Người nhận | phuch (Codex hỗ trợ) |
| Reviewer | Chưa phân công |
| Nhóm | Dashboard |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-001](./PB-001-contracts.md), [PB-003](./PB-003-remove-guest-link.md), [PB-004](./PB-004-core-schema.md) |
| Đối chiếu kế hoạch | P5b |
| Branch gợi ý | `feat/pb-028-presence-api` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Lưu tín hiệu hiện diện hợp lệ và tổng hợp số online cho Admin; cấu hình heartbeat/TTL.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Domain/Entities.cs; Infrastructure/HospitalDb.cs; Migrations/; Identity/; Administration/AdminDashboard.cs.

## Tiêu chí chấp nhận

- [x] Heartbeat lấy danh tính từ session; không tin userId/role client; không đi qua khóa ghi nghiệp vụ toàn cục.
- [x] Account nhiều phiên tính một; Guest theo phiên; loại revoked/expired/logout/quá TTL; không gộp Guest/Account theo tên.
- [x] Giữ số liệu vận hành Dashboard hiện có; trả generatedAt và định nghĩa thời hạn; không coi mọi session chưa hết hạn là online.

## Kiểm chứng bắt buộc

API fake-clock hoặc clock điều khiển cho TTL/logout/revoke; multi-session dedup; role Admin; đo ảnh hưởng heartbeat lên nghiệp vụ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không thêm lịch sử vị trí hoặc thống kê hành vi cá nhân; client/UI thuộc PB-029.

## Phối hợp và phụ thuộc

Có migration; merge tuần tự sau snapshot hiện hành, phối hợp PB-013/007.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Đã triển khai trên `feat/pb-028-presence-api`, gồm migration SessionPresence,
API heartbeat/aggregate và Dashboard.online. Kiểm thử SQL/HTTP/migration/tải đã có
trong task; giữ In Progress chờ PR, review và merge.
Chi tiết hợp đồng, cấu hình, số đo và giới hạn:
[PB-028](../../../codes/docs/requirements/PB-028-presence-api.md).

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-028, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

