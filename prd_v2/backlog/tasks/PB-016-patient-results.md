# PB-016 Xem kết quả và khuyến nghị trên web và mobile

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Bệnh nhân |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-009](./PB-009-mobile-reception.md), [PB-014](./PB-014-complete-examination.md) |
| Đối chiếu kế hoạch | P3b |
| Branch gợi ý | `feat/pb-016-patient-results` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Đồng bộ hiển thị kết quả cấu trúc đã xác nhận, lịch sử và khuyến nghị tái khám theo quyền.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Content/ContentEndpoints.cs; apps/web/src/PatientRecords.tsx; apps/mobile/src/Records.tsx; tests/browser/, tests/android/.

## Tiêu chí chấp nhận

- [ ] Kết quả xem được khi ExamStatus Completed dù Visit Active; trước đó không lộ nội dung nháp qua API/UI/narration.
- [ ] Account chỉ xem lịch sử của Account; Guest chỉ các Visit được grant. Không có lời mời liên kết hoặc booking handoff.
- [ ] Khuyến nghị tái khám gắn đúng Visit và dữ liệu Việt gốc; bản dịch/fallback có nhãn phù hợp; lịch sử legacy vẫn đọc đúng.

## Kiểm chứng bắt buộc

API ownership/grant/unpublished; browser và native kết quả trước quyết toán, đổi ngôn ngữ, lịch sử legacy.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không tạo lịch hẹn hoặc Visit tái khám tự động.

## Phối hợp và phụ thuộc

PatientRecords/Records cũng chứa hỗ trợ; phối hợp PB-019 hoặc tách component hỗ trợ.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-016, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

