# PB-002 Tạo báo cáo dữ liệu cũ trước nâng cấp

| Trường | Giá trị |
|---|---|
| Trạng thái | Ready |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Nền tảng |
| Ưu tiên | P0 |
| Cỡ việc | S |
| Phụ thuộc cần merge | Không |
| Đối chiếu kế hoạch | P0 / mục 6 |
| Branch gợi ý | `feat/pb-002-legacy-audit` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Tạo công cụ chỉ đọc để thống kê dữ liệu không phù hợp quy tắc mới, dùng database được chỉ định rõ ràng.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: scripts/data/ (script mới); tests/ (fixture liên quan); docs/requirements/.

## Tiêu chí chấp nhận

- [ ] Phát hiện Patient có nhiều Visit Active/request chờ, phòng nhiều ca đang khám, Visit nhiều order mở và bác sĩ chưa rõ phòng.
- [ ] Liệt kê PendingActivation, quyết toán sớm, Skipped/Cancelled, nội dung publish sớm, nhà thuốc còn mở và phiếu/snapshot chưa đủ dữ liệu.
- [ ] Báo cáo dùng ID và số lượng cần đối chiếu; không in mật khẩu, token hoặc mô tả sức khỏe. Chạy không thay đổi database.

## Kiểm chứng bắt buộc

Chạy trên fixture có từng loại xung đột và fixture sạch; so số lượng trước/sau để chứng minh không ghi dữ liệu.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không sửa, xóa hoặc tự đóng các hồ sơ bị phát hiện.

## Phối hợp và phụ thuộc

Độc lập với các task UI; chưa đụng EF model snapshot.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-002, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

