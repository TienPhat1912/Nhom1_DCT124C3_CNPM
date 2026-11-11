# PB-021 Hoàn thiện Journey bốn trạng thái trên web

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Bệnh nhân |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-012](./PB-012-service-return.md), [PB-015](./PB-015-final-settlement.md) |
| Đối chiếu kế hoạch | P3 / QD-03 |
| Branch gợi ý | `feat/pb-021-web-journey` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Hiển thị rõ bước hiện tại, trạng thái khám, nơi cần đến và hành động tiếp theo trên web.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/web/src/PatientJourney.tsx, App.tsx, runtime.tsx; packages/shared/src/types.ts; tests/browser/patient.spec.ts.

## Tiêu chí chấp nhận

- [ ] Đang thực hiện dịch vụ chỉ đúng điểm dịch vụ; complete tự chuyển hướng dẫn về phòng cũ và Chờ khám; giữ số phiếu.
- [ ] ExamStatus, Visit và Journey không bị gộp thành một trạng thái; Closed/Completed hiển thị lịch sử đúng, không cần bệnh nhân bấm kết thúc.
- [ ] Reload/mất mạng giữ dữ liệu đã xem có nhãn cũ; phản hồi đến muộn không ghi đè trạng thái mới. Nghe lại/chỉ đường/hỗ trợ trong tối đa hai thao tác.

## Kiểm chứng bắt buộc

Browser luồng có/không dịch vụ, nhiều vòng, offline/reconnect/out-of-order; typecheck/build.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

TTS tự động thuộc PB-024, không thiết kế lại toàn bộ giao diện.

## Phối hợp và phụ thuộc

PB-024 sửa tiếp Journey/components; hoàn tất task này trước.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-021, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

