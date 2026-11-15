# PB-027 Rà soát bốn ngôn ngữ cho toàn bộ luồng mới

| Trường | Giá trị |
|---|---|
| Trạng thái | In Progress |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Ngôn ngữ |
| Ưu tiên | P1 |
| Cỡ việc | S |
| Phụ thuộc cần merge | [PB-016](./PB-016-patient-results.md), [PB-018](./PB-018-request-translation.md), [PB-019](./PB-019-assistance.md), [PB-020](./PB-020-guest-recovery.md), [PB-026](./PB-026-route-narration.md), [PB-029](./PB-029-presence-clients.md) |
| Đối chiếu kế hoạch | P5a |
| Branch gợi ý | `feat/pb-027-four-languages` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Đồng bộ Entry/config/UI/TTS với vi/en/zh/ja và kiểm tra nhãn của các task mới.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: packages/shared/src/locales.ts, i18n.ts, translations/; backend/Hospital.Api/Content/TranslationService.cs; Reception/ReceptionEndpoints.cs; web/mobile language picker.

## Tiêu chí chấp nhận

- [ ] Entry, picker, API và speech có cùng bốn lựa chọn chính; không còn endpoint Entry chỉ trả vi/en.
- [x] Không thiếu nhãn trạng thái/validation/hành động mới; không còn lời mời liên kết Guest hoặc booking trong luồng mới.
- [ ] Locale ko/ru đã lưu không gây lỗi hoặc xóa lịch sử; fallback rõ, đổi ngôn ngữ không thay Visit/tiến độ.

## Kiểm chứng bắt buộc

Languages unit/translation/browser; native bốn ngôn ngữ và layout; kiểm tra dữ liệu locale legacy.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Các task UI trước vẫn phải thêm nhãn cần dùng của chính task; không đợi PB-027 mới có chữ hiển thị.

## Phối hợp và phụ thuộc

Chạy gần cuối để tránh nhiều người cùng sửa locales/i18n; task này là rà soát toàn bộ.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Đã triển khai trên `feat/pb-027-four-languages`, base main `eb868b1` sau PB-029.
Typecheck/lint/publish/Android export pass; 15 language unit/component, 94 hồi quy
native, 20 browser và 2 API locale legacy pass; translation/provider pass.
Còn gate layout/giọng đọc/deep link trên APK thật hoặc giả lập;
giữ In Progress. [Bàn giao và cách chạy lại](../../../codes/docs/requirements/PB-027-FOUR-LANGUAGES.md).

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-027, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

