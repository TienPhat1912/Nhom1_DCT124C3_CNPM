# PB-001 Chốt hợp đồng trạng thái, DTO và lỗi nghiệp vụ

| Trường | Giá trị |
|---|---|
| Trạng thái | Ready |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Nền tảng |
| Ưu tiên | P0 |
| Cỡ việc | S |
| Phụ thuộc cần merge | Không |
| Đối chiếu kế hoạch | P0 |
| Branch gợi ý | `feat/pb-001-contracts` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Viết hợp đồng chuyển trạng thái và DTO mới; bổ sung type mới theo cách tương thích để các task API/UI cùng sử dụng. Ghi rõ mỗi lệnh, quyền, version, Idempotency-Key và lỗi cạnh tranh.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: packages/shared/src/types.ts; docs/architecture/API.md; docs/architecture/DECISIONS.md.

## Tiêu chí chấp nhận

- [ ] Có đủ Waiting → InConsultation → InService → Waiting, Completed và điều kiện quyết toán; tách khỏi trạng thái Visit/Journey.
- [ ] DTO có phòng/bác sĩ, phiếu theo ngày, lần gọi khám, bước hiện tại và khả năng thao tác. Không nhận dữ liệu tác giả/quyền từ client.
- [ ] Ghi rõ cách áp dụng khóa đổi bác sĩ khi còn Visit Active và nhãn InService là các diễn giải cần đối chiếu bản PRD viết lại; không mở lại các quyết định đã chốt.

## Kiểm chứng bắt buộc

Typecheck khi thêm shared types; review bảng lệnh và mẫu request/response với thành viên API/UI.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không triển khai endpoint, migration hoặc đổi luồng đang chạy.

## Phối hợp và phụ thuộc

types.ts là file chung; người nhận PB-001 thống nhất tên trước khi task phụ thuộc bắt đầu.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-001, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

