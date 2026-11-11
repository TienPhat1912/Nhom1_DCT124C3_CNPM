# PB-013 Danh mục triệu chứng, dấu hiệu, chẩn đoán và mẫu Việt

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Chẩn đoán |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-004](./PB-004-core-schema.md), [PB-005](./PB-005-clinic-assignment.md) |
| Đối chiếu kế hoạch | P1 / P3b |
| Branch gợi ý | `feat/pb-013-clinical-catalog` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Schema danh mục/kết quả cấu trúc và API/UI Admin quản lý danh mục/mẫu Việt; cung cấp catalog đọc cho Doctor.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Domain/Entities.cs; Infrastructure/HospitalDb.cs; Migrations/; Administration/AdminEndpoints.cs; Content/; apps/web/src/Admin.tsx.

## Tiêu chí chấp nhận

- [ ] Bác sĩ đọc các mục đang dùng; Admin thêm/sửa/ngừng dùng; mã/phiên bản có validation và audit.
- [ ] Ngừng dùng/sửa danh mục không làm thay đổi snapshot lịch sử; khóa ngoại và bảng liên kết chuẩn bị được cho kết quả khám.
- [ ] Fixture demo được đánh dấu; không suy ra chẩn đoán từ triệu chứng hoặc tự nhận dữ liệu mẫu là danh mục bệnh viện đã duyệt.

## Kiểm chứng bắt buộc

API quyền/CRUD/validation; migration mới/cũ; browser Admin; test lịch sử không đổi khi sửa tên mục.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không xác nhận/công bố kết quả bệnh nhân; PB-014 triển khai.

## Phối hợp và phụ thuộc

Có migration và Admin.tsx; phụ thuộc PB-005 để hạn chế đụng cùng form.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-013, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

