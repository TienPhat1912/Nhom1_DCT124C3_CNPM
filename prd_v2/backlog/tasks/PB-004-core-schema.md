# PB-004 Bổ sung schema phòng, trạng thái khám và snapshot

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Nền tảng |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-001](./PB-001-contracts.md), [PB-002](./PB-002-legacy-audit.md) |
| Đối chiếu kế hoạch | P1 |
| Branch gợi ý | `feat/pb-004-core-schema` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Tạo migration bổ sung cho quan hệ bác sĩ–phòng, bác sĩ hoạt động, ClinicLocationId, ExamStatus/lần tiếp nhận và snapshot phiếu. Thêm nguồn ngôn ngữ/khoa mong muốn cho request, nguồn ngôn ngữ cho assistance.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Domain/Entities.cs; Infrastructure/HospitalDb.cs; Migrations/; Infrastructure/Seed.cs; packages/shared/src/types.ts.

## Tiêu chí chấp nhận

- [ ] Database mới seed được; cấu trúc và FK biểu diễn một bác sĩ thuộc một phòng, giữ bác sĩ của Visit và bốn trạng thái khám.
- [ ] Database cũ được backfill chỉ khi ánh xạ chắc chắn; hồ sơ mơ hồ được báo cáo, không đoán hoặc xóa. Cột mới chưa đủ dữ liệu được xử lý bằng bước chuyển đổi rõ ràng.
- [ ] Migration bổ sung không bật ngay unique constraint nếu dữ liệu cũ chưa đạt; nêu rõ gói nào kích hoạt ràng buộc. Schema không làm code cũ ngừng build.

## Kiểm chứng bắt buộc

Migration trên database mới và bản sao fixture cũ; build .NET/typecheck; kiểm tra snapshot/ID/history được giữ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không thêm schema lâm sàng, số phiếu hoặc presence trong PR này; chúng thuộc PB-007/013/028.

## Phối hợp và phụ thuộc

Một người chịu trách nhiệm EF migration ở đợt này; các PR migration sau phải lấy snapshot đã merge.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-004, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

