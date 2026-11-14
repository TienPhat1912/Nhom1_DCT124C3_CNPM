# PB-031 Nghiệm thu tích hợp, hiệu năng và bản build

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Nghiệm thu |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-016](./PB-016-patient-results.md), [PB-018](./PB-018-request-translation.md), [PB-019](./PB-019-assistance.md), [PB-020](./PB-020-guest-recovery.md), [PB-027](./PB-027-four-languages.md), [PB-029](./PB-029-presence-clients.md), [PB-030](./PB-030-migration-rehearsal.md) |
| Đối chiếu kế hoạch | P6 |
| Branch gợi ý | `feat/pb-031-acceptance-release` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Chạy kịch bản ở mục 9 kế hoạch qua các vai trò và hai nền tảng; đo hiệu năng, tạo artifact web/API/Android theo script sẵn có.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: tests/api/, tests/browser/, tests/android/; scripts/test/; artifacts/ (kết quả local, không commit).

## Tiêu chí chấp nhận

- [ ] Hoàn thành A/B cùng phòng, nhiều vòng dịch vụ tuần tự, chẩn đoán trước quyết toán, hai outcome đóng Journey và Guest độc lập/khôi phục.
- [ ] Nghiệm thu bản đồ/RTLS mô phỏng PB-033/034/026 theo [chu kỳ và ngoại lệ PB-026](./PB-026-route-narration.md): cùng tầng, khác tầng, khác tòa; chặng khoảng 5 giây và dừng chờ chỉ dẫn; đổi đích, mất tín hiệu, tắt tiếng, ngắt bởi gọi số và đến đích không tự đổi trạng thái khám. Có bằng chứng web/Android và nhãn mô phỏng rõ ràng. Phụ thuộc được bao hàm qua PB-027 → PB-026 → PB-034 → PB-033.
- [ ] Kiểm tra 20 người dùng, thao tác thông thường theo mục tiêu 2 giây và gọi khám ≤3 giây ở điều kiện ổn định; báo số đo/môi trường, không chỉ kết luận đạt.
- [ ] Typecheck/lint/build và test liên quan đạt; kiểm chứng Android theo khả năng môi trường; mọi phần chưa đo/thiết bị chưa thử ghi rõ, không tự đánh Done nếu còn tiêu chí bắt buộc.

## Kịch bản nghiệm thu bản đồ và mô phỏng

| Nhóm | Kịch bản bắt buộc |
|---|---|
| Bản đồ | Danh sách phủ tòa/tầng/phòng; cùng tầng; khác tầng qua thang; khác tòa qua lối nối; cạnh đóng; đích chưa ánh xạ; không xuyên tường/phòng |
| Chu kỳ | Chặng 5 giây; dừng tối thiểu 1 giây; câu đọc dài hơn thời gian dừng; tắt tiếng; tự phát bị chặn; TTS lỗi; đến đích đúng một lần |
| Phiên | Pause/resume/reset; đóng/mở lại; đổi tài khoản; nền/foreground; không có timer/callback còn sót |
| Journey | Đổi đích giữa cạnh, đang đọc, đang đổi tầng; gọi số ngắt thuyết minh; đến nơi không đổi trạng thái khám |
| Vị trí | Đứng yên vẫn fresh; mất/stale tín hiệu; khôi phục; lệch tuyến và tính lại; không có đường |
| Nền tảng | Web browser test và demo trên Android/giả lập; ảnh/video tuyến cùng tầng, khác tầng, khác tòa; ghi rõ giới hạn môi trường |

Kiểm thử logic thời gian bằng đồng hồ giả để kiểm chứng ranh giới và hủy phiên; quan sát chuyển động/thuyết minh bằng browser/native để kiểm chứng trải nghiệm thực. Các PR chạy typecheck/lint/build và bộ map/narration liên quan theo README backlog.

## Kiểm chứng bắt buộc

Chạy bộ acceptance trên database riêng; nêu lệnh và kết quả trong PR, artifact dùng cơ chế CI có sẵn; kiểm tra quyền/retry/network/speech.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không thêm chức năng mới hoặc deploy production; lỗi phát hiện tạo task sửa nhỏ có ID rõ, rồi kiểm thử lại phần ảnh hưởng.

## Phối hợp và phụ thuộc

Task nghiệm thu không thay thế test của từng PR; chỉ kiểm tra tích hợp cuối.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-031, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

