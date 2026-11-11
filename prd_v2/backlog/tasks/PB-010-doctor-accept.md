# PB-010 Danh sách chờ và tiếp nhận một bệnh nhân vào khám

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Khám bệnh |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-008](./PB-008-confirm-reception.md) |
| Đối chiếu kế hoạch | P3a / QD-01 |
| Branch gợi ý | `feat/pb-010-doctor-accept` |
| PR | Chưa mở |

## Kết quả cần bàn giao

API danh sách chờ theo phòng và lệnh tiếp nhận; UI bác sĩ hiển thị danh sách/cùng một ca Đang khám.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Journeys/JourneyEndpoints.cs; Identity/Access.cs; Infrastructure/HospitalDb.cs; apps/web/src/StaffClinical.tsx.

## Tiêu chí chấp nhận

- [ ] Chỉ đúng bác sĩ hoạt động/phụ trách xem và nhận người Chờ khám; chọn bất kỳ người đủ điều kiện, không ép FIFO.
- [ ] Hai tab nhận hai người trong cùng phòng: tối đa một thành công; transaction và unique constraint bảo vệ một InConsultation/phòng.
- [ ] Nhận ca ghi lần khám/sự kiện gọi có ID, số phiếu/phòng; retry cùng lệnh không tăng lần hoặc tạo sự kiện trùng.

## Kiểm chứng bắt buộc

API wrong role/room, race hai Visit, retry; browser nhận ca/chặn ca thứ hai.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không implement tự phát TTS; sự kiện cơ bản là đầu vào PB-023.

## Phối hợp và phụ thuộc

StaffClinical.tsx sẽ tiếp tục được PB-011/012/014/015 sửa; không làm refactor toàn file ngoài phạm vi.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-010, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

