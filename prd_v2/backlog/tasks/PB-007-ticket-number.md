# PB-007 Cấp số phiếu an toàn theo phòng và ngày

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Tiếp nhận |
| Ưu tiên | P0 |
| Cỡ việc | S |
| Phụ thuộc cần merge | [PB-004](./PB-004-core-schema.md) |
| Đối chiếu kế hoạch | P1–P2 / QD-05 |
| Branch gợi ý | `feat/pb-007-ticket-number` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Bổ sung ngày/phòng/số thứ tự và bộ cấp số trong giao dịch, dùng giờ Việt Nam.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Domain/Entities.cs; Infrastructure/HospitalDb.cs; Migrations/; Reception/ (bộ cấp số mới).

## Tiêu chí chấp nhận

- [ ] Mỗi phòng/ngày bắt đầu 001; cấp đồng thời không trùng; có unique constraint tương ứng.
- [ ] Lệnh retry nhận cùng kết quả khi được gọi trong command giao dịch; không dùng MAX+1 không khóa.
- [ ] Không đánh lại số H- cũ; phiếu đã cấp không thay đổi khi sang ngày hoặc in lại. Có định dạng đủ phân biệt phòng/ngày.

## Kiểm chứng bắt buộc

Test SQL concurrent cấp số, hai phòng, qua ngày, rollback/retry và migration dữ liệu cũ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Chỉ hoàn thành bộ cấp số với test tích hợp; hook vào confirm và UI phiếu thuộc PB-008.

## Phối hợp và phụ thuộc

Có EF migration: lấy snapshot mới nhất, merge tuần tự với PB-006/013/028.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-007, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

