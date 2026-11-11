# PB-026 Đồng bộ chỉ đường và tự phát sau khi có tuyến

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Bản đồ |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-024](./PB-024-web-narration.md), [PB-025](./PB-025-mobile-narration.md) |
| Đối chiếu kế hoạch | P5a / P6 |
| Branch gợi ý | `feat/pb-026-route-narration` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Giữ bản đồ hiện tại, đích theo Journey; phát hướng dẫn sau khi tính tuyến và xử lý thay đổi đích.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/web/src/HospitalMap.tsx, useRouteSpeech.ts; apps/mobile/src/HospitalMap.tsx, useRouteSpeech.ts; packages/shared/src/hospitalMap.ts.

## Tiêu chí chấp nhận

- [ ] Journey đổi từ phòng khám sang dịch vụ/về phòng cũ thì tuyến/âm thanh cũ hết hiệu lực; chỉ phát khi có tuyến hợp lệ.
- [ ] TTS bản đồ và Journey không đọc chồng; tự phát tôn trọng lựa chọn tắt, vẫn nghe lại được.
- [ ] Giữ chọn vị trí thủ công khi chưa RTLS; thiếu vị trí phòng thì báo chưa có tuyến, không tự tạo tọa độ hoặc hoàn tất khám.

## Kiểm chứng bắt buộc

Map unit/browser tests, test route speech cancel/recompute; native kiểm tra đổi đích và thiếu vị trí.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không tích hợp/mô phỏng RTLS, hướng dẫn trước điểm rẽ thời gian thực hoặc vẽ lại toàn bản đồ.

## Phối hợp và phụ thuộc

Dùng cơ chế điều phối âm thanh đã chốt PB-024/025.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-026, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

