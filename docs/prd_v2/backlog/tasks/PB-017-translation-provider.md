# PB-017 Dịch văn bản có ngôn ngữ nguồn và đích

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Dịch và hỗ trợ |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-001](./PB-001-contracts.md) |
| Đối chiếu kế hoạch | P4 |
| Branch gợi ý | `feat/pb-017-translation-provider` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Mở rộng hợp đồng dịch cho nguồn bất kỳ trong phạm vi ngôn ngữ hỗ trợ sang Việt, giữ đường dịch Việt sang ngôn ngữ bệnh nhân.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Content/TranslationService.cs; tests/translation/; docs/guides/LANGUAGES.md.

## Tiêu chí chấp nhận

- [ ] Hợp đồng tách bản gốc, bản dịch, nguồn/đích, trạng thái fallback; không trả bản gốc với nhãn đã dịch.
- [ ] Cache phân biệt nguồn/đích/phiên bản và ngữ cảnh hồ sơ; timeout/retry không ghi nội dung nhạy cảm vào log.
- [ ] Có provider giả lập cho test và cấu hình provider thật; không đưa việc dịch mô tả vào response filter chung.

## Kiểm chứng bắt buộc

Translation tests với vi→en, en/zh/ja→vi, vi→vi, timeout, cache invalidation và cô lập ngữ cảnh; hồi quy nội dung bệnh viện.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không dịch ngay khi submit/list; tích hợp chi tiết request/assistance ở PB-018/019.

## Phối hợp và phụ thuộc

TranslationService dùng chung; merge trước các task tích hợp.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-017, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

