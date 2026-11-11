# PB-012 Hoàn tất dịch vụ và tự trở lại hàng chờ phòng cũ

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Dịch vụ |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-011](./PB-011-single-order.md) |
| Đối chiếu kế hoạch | P3a / QD-03 |
| Branch gợi ý | `feat/pb-012-service-return` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Danh sách và nút hoàn tất cho Service; lệnh complete cập nhật order và bước quay lại.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Journeys/JourneyEndpoints.cs, Workflow.cs; apps/web/src/StaffClinical.tsx; tests/api/.

## Tiêu chí chấp nhận

- [ ] Chỉ Service đúng phạm vi hoàn tất; UI có Chưa hoàn tất/Hoàn tất, không nhập kết quả xét nghiệm/chụp chiếu.
- [ ] Order xong, Visit Waiting, đích phòng cũ và hàng chờ bác sĩ cũ thay đổi nguyên tử; giữ số phiếu, không thêm xác nhận đã tới phòng.
- [ ] Không tự chuyển InConsultation hoặc chiếm ca khác; muốn chỉ định tiếp phải được bác sĩ nhận lại. Retry hoàn tất không tạo bước quay lại trùng.

## Kiểm chứng bắt buộc

API scope/retry; test A đi dịch vụ → bác sĩ khám B → A xong chỉ vào hàng chờ; browser Service và Doctor; test hai vòng dịch vụ tuần tự.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không thêm trạng thái đang lấy mẫu bắt buộc cho mọi loại dịch vụ; không lưu kết quả chuyên môn.

## Phối hợp và phụ thuộc

Dùng lại component theo vai trò; tránh đổi giao diện bác sĩ/thu ngân ngoài phần cần thiết.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-012, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

