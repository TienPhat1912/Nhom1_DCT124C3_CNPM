# PB-005 Quản trị bác sĩ đang hoạt động theo phòng

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Quản trị |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-004](./PB-004-core-schema.md) |
| Đối chiếu kế hoạch | P1 / QD-02 |
| Branch gợi ý | `feat/pb-005-clinic-assignment` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Hoàn thiện API và form Admin chọn bác sĩ thuộc phòng, hiển thị người đang hoạt động và điều kiện được thay đổi.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Administration/AdminEndpoints.cs; Identity/Access.cs; Infrastructure/HospitalCatalog.cs; apps/web/src/Admin.tsx; tests/catalog/.

## Tiêu chí chấp nhận

- [ ] Chỉ chọn Doctor có tài khoản dùng được, đúng phòng/phạm vi; một phòng không có hai bác sĩ hoạt động dù thao tác đồng thời.
- [ ] Không thay phân công/đổi bác sĩ của phòng khi còn Visit Active theo cách áp dụng trong kế hoạch. Khóa tài khoản bảo mật không tự chuyển ca.
- [ ] Khởi động lại/nhập roster không ghi đè lựa chọn Admin; cấu hình và audit lưu đủ người/thời điểm.

## Kiểm chứng bắt buộc

API quyền, cạnh tranh và chặn đổi; test catalog restart/idempotence; browser form chọn/đổi bị chặn.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không xây bàn giao ca, chuyển Visit sang bác sĩ khác hoặc quản lý lịch trực.

## Phối hợp và phụ thuộc

Admin.tsx/HospitalCatalog.cs dùng chung với PB-013; phối hợp hoặc tách component mới.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-005, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

