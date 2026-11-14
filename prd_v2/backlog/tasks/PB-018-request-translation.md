# PB-018 Dịch mô tả khi Reception mở chi tiết tiếp nhận

| Trường | Giá trị |
|---|---|
| Trạng thái | In Progress |
| Người nhận | phuch (Codex hỗ trợ) |
| Reviewer | Chưa phân công |
| Nhóm | Dịch và hỗ trợ |
| Ưu tiên | P1 |
| Cỡ việc | S |
| Phụ thuộc cần merge | [PB-008](./PB-008-confirm-reception.md), [PB-017](./PB-017-translation-provider.md) |
| Đối chiếu kế hoạch | P4 |
| Branch gợi ý | `feat/pb-018-request-translation` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Endpoint chi tiết request kiểm tra quyền rồi dịch; UI đối chiếu bản gốc/bản Việt và trạng thái lỗi.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Reception/ReceptionEndpoints.cs; apps/web/src/StaffReception.tsx; tests/translation/, tests/browser/.

## Tiêu chí chấp nhận

- [x] List và submit không gọi dịch; Reception đúng phạm vi mở detail mới lấy bản dịch.
- [x] Ngôn ngữ nguồn lấy từ request lúc nhập; đổi profile/locale không viết lại nội dung; không dịch tên/định danh.
- [x] Provider lỗi vẫn đọc bản gốc và thử lại được; không làm mất yêu cầu hoặc buộc tạo yêu cầu khác.

## Kiểm chứng bắt buộc

Theo dõi số lần gọi provider khi list/detail; API wrong scope không gọi provider; browser original/translated/failure.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không tự chẩn đoán/chọn khoa dựa trên bản dịch; không sửa bản gốc.

## Phối hợp và phụ thuộc

StaffReception.tsx nối tiếp PB-008; không refactor chức năng xác nhận/in phiếu.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Đã triển khai và kiểm thử cục bộ trên `feat/pb-018-request-translation`;
chờ PR, review và merge nên giữ In Progress. Bằng chứng, hợp đồng và giới hạn kiểm thử:
[PB-018](../../../codes/docs/requirements/PB-018-request-translation.md).

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-018, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

