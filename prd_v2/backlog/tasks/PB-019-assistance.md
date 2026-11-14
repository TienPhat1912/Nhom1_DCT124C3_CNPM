# PB-019 Reception xử lý hỗ trợ và xem bản dịch chi tiết

| Trường | Giá trị |
|---|---|
| Trạng thái | In Progress |
| Người nhận | phuch (Codex hỗ trợ) |
| Reviewer | Chưa phân công |
| Nhóm | Dịch và hỗ trợ |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-008](./PB-008-confirm-reception.md), [PB-009](./PB-009-mobile-reception.md), [PB-017](./PB-017-translation-provider.md) |
| Đối chiếu kế hoạch | P4 |
| Branch gợi ý | `feat/pb-019-assistance` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Thêm chi tiết assistance có dịch, giới hạn Reception xử lý, đồng bộ form/status bệnh nhân trên hai nền tảng.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Support/SupportEndpoints.cs; apps/web/src/StaffSupport.tsx, PatientRecords.tsx, App.tsx; apps/mobile/src/Records.tsx.

## Tiêu chí chấp nhận

- [ ] Guest/Account gửi được trước Journey; trong Journey lưu đúng Visit/Step/địa điểm; list staff trả metadata cần thiết.
- [x] Reception đúng phạm vi đọc gốc/dịch và cập nhật Chờ xử lý/Đang xử lý/Đã xử lý; Service bị chặn cả API và UI.
- [ ] Yêu cầu phát sinh tại khu dịch vụ vẫn tới Reception có thẩm quyền; lỗi dịch không ngăn ghi nhận/xử lý; bệnh nhân theo dõi được trạng thái.

## Kiểm chứng bắt buộc

API before-Visit/context/permission/state/version; provider detail-only; browser Reception và bệnh nhân; native gửi/theo dõi.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không bổ sung phân hệ chuyển hỗ trợ phức tạp hoặc cấp Service quyền xử lý.

## Phối hợp và phụ thuộc

App và Records dùng chung nhiều task; giới hạn sửa vùng hỗ trợ, cập nhật nhãn của riêng task.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Đã triển khai API/web/mobile và thêm kiểm thử trên nhánh
`feat/pb-019-assistance`; chờ PR, review và merge. Kiểm thử thiết bị/giả lập Android còn
thiếu do môi trường chưa có SDK/JDK/adb; giữ In Progress, chưa đánh Done.
Hợp đồng, lệnh kiểm thử và giới hạn:
[PB-019](../../../codes/docs/requirements/PB-019-assistance.md).

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-019, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

