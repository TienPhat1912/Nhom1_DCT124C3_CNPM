# PB-006 Tối giản yêu cầu tiếp nhận trên API và web bệnh nhân

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Tiếp nhận |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-003](./PB-003-remove-guest-link.md), [PB-004](./PB-004-core-schema.md) |
| Đối chiếu kế hoạch | P2b |
| Branch gợi ý | `feat/pb-006-registration-request` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Form liên hệ, khoa mong muốn tùy chọn và một mô tả; lưu nguyên văn/ngôn ngữ nguồn. Chặn request chờ hoặc Visit Active theo Patient, mở lại hồ sơ hiện có.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Reception/ReceptionEndpoints.cs; Infrastructure/HospitalDb.cs; apps/web/src/PatientReception.tsx; packages/shared/src/types.ts.

## Tiêu chí chấp nhận

- [ ] Gửi đồng thời cùng Patient không tạo nhiều yêu cầu chờ; lỗi/trả lời có requestId hoặc visitId để tiếp tục.
- [ ] Không trim/ghi đè bản gốc mô tả; ngôn ngữ nguồn gắn với lần nhập. Khoa mong muốn không quyết định quyền của Reception.
- [ ] Web không dùng booking hoặc trường Requests/đối thoại bổ sung trong luồng mới; lịch sử cũ vẫn đọc được theo quyền.

## Kiểm chứng bắt buộc

API race với Account và Guest riêng; test mô tả giữ nguyên; browser gửi mới/trùng/đang có Visit; index cần thiết được test bằng migration fixture.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không dịch mô tả tại submit hoặc tự chọn chuyên khoa; mobile thuộc PB-009.

## Phối hợp và phụ thuộc

ReceptionEndpoints.cs sẽ được PB-008/018 sửa tiếp; merge theo phụ thuộc, tránh sửa cùng block.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-006, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

