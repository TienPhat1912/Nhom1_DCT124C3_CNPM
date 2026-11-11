# PB-003 Bỏ liên kết Guest với tài khoản trên API, web và mobile

| Trường | Giá trị |
|---|---|
| Trạng thái | Ready |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Tài khoản |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | Không |
| Đối chiếu kế hoạch | P2a / QD-06 |
| Branch gợi ý | `feat/pb-003-remove-guest-link` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Loại lời mời, màn hình và API tạo liên kết mới. Giữ đăng ký/login độc lập và khôi phục Guest.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Identity/IdentityEndpoints.cs; apps/web/src/Auth.tsx, App.tsx, PatientJourney.tsx; apps/mobile/src/Auth.tsx, App.tsx, Journey.tsx; nhãn và test liên quan.

## Tiêu chí chấp nhận

- [ ] link-claim/convert không còn tạo claim hoặc thay PatientId/grant; client cũ nhận lỗi chức năng ngừng hoặc endpoint không còn hỗ trợ.
- [ ] Account đăng ký mới không nhận dữ liệu Guest; đổi phiên xóa cache nhạy cảm và dừng âm thanh của phiên trước.
- [ ] Khôi phục Guest vẫn hoạt động; dữ liệu đã liên kết từ trước không bị tách ngược hoặc mất quyền. Không còn đường UI liên kết tại profile/Journey.

## Kiểm chứng bắt buộc

API chặn cả hai endpoint cũ; browser và mobile kiểm tra đăng ký độc lập/đổi phiên; hồi quy recovery. Cập nhật test conversion cũ thành test hành vi bị loại.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không drop bảng LinkClaim hoặc xóa lịch sử liên kết; không thay cơ chế login.

## Phối hợp và phụ thuộc

Sửa App/Auth ở cả hai nền tảng; merge trước khi các task Journey thay điều hướng.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-003, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

