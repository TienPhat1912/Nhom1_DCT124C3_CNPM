# PB-004 Bổ sung schema phòng, trạng thái khám và snapshot

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai và kiểm chứng local hoàn tất, chờ review/PR và dependency merge |
| Người nhận | Codex (theo yêu cầu người dùng) |
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

- [x] Database mới seed được; cấu trúc và FK biểu diễn một bác sĩ thuộc một phòng, giữ bác sĩ của Visit và bốn trạng thái khám.
- [x] Database cũ được backfill chỉ khi ánh xạ chắc chắn; hồ sơ mơ hồ được báo cáo, không đoán hoặc xóa. Cột mới chưa đủ dữ liệu được xử lý bằng bước chuyển đổi rõ ràng.
- [x] Migration bổ sung không bật ngay unique constraint nếu dữ liệu cũ chưa đạt; nêu rõ gói nào kích hoạt ràng buộc. Schema không làm code cũ ngừng build.

## Kiểm chứng bắt buộc

Migration trên database mới và bản sao fixture cũ; build .NET/typecheck; kiểm tra snapshot/ID/history được giữ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không thêm schema lâm sàng, số phiếu hoặc presence trong PR này; chúng thuộc PB-007/013/028.

## Phối hợp và phụ thuộc

Một người chịu trách nhiệm EF migration ở đợt này; các PR migration sau phải lấy snapshot đã merge.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai local trên nhánh có sẵn `AnhBao_PB004_core_schema`:

- Migration `20261112151204_CoreClinicSchema`, EF Designer/model snapshot đồng bộ; thêm bảng phân công/phòng, các trường Visit/request/assistance và snapshot phiếu.
- [Hướng dẫn schema, backfill, cutover và rollback](../../../codes/docs/requirements/PB-004-CORE-SCHEMA.md).
- [Báo cáo ID/số lượng hồ sơ cần đối chiếu](../../../codes/scripts/data/core-schema-review.sql), chỉ đọc.
- [Bộ test SQL Server thực](../../../codes/tests/core-schema/Program.cs), đã tích hợp `scripts/test/ci-native.ps1`.
- Không thêm số phiếu, clinical catalog hoặc presence. Không sửa sáu quyết định nghiệp vụ; chưa bật luồng V2.

Phụ thuộc: lịch sử nhánh local có merge PB-001 (PR #12, `adaeaa3`); file card PB-001 chưa cập nhật trạng thái. Mã/báo cáo PB-002 chưa có trên nhánh này. Không giả định PB-002 đã merge, không mở khóa merge/cutover bằng kết quả local PB-004. Chưa mở PR, chưa có reviewer/merge nên chưa đánh Done.

### Kiểm chứng ngày 12/11/2026

Các lệnh chạy từ `codes/`:

| Lệnh | Kết quả |
|---|---|
| `dotnet restore tests/core-schema/CoreSchema.Tests.csproj` | PASS |
| `dotnet build tests/core-schema/CoreSchema.Tests.csproj -c Release --no-restore` | PASS — backend + test, 0 warning/error |
| `$env:PB004_SQL_SERVER='localhost'; dotnet run --project tests/core-schema/CoreSchema.Tests.csproj -c Release --no-build --no-restore` | PASS — 77 assertions, schema/FK thật, seed mới, nâng cấp legacy, SHA-256 toàn bộ cột lịch sử, báo cáo chỉ đọc, constraint, downgrade và EF snapshot |
| `npm.cmd run typecheck` | PASS — web/mobile/shared/contracts |
| `npm.cmd run lint` | PASS — không cảnh báo |
| `npm.cmd run build` | PASS — Vite production |
| `dotnet tool run dotnet-ef -- migrations script 20261025035340_VietnameseSource 20261112151204_CoreClinicSchema --idempotent --project backend/Hospital.Api --configuration Release --no-build --output artifacts/pb004-migration.sql` | PASS — sinh script; test database dùng EF migrator, chưa thực thi riêng file script |
| `git diff --check` | PASS |

Database kiểm chứng cuối được giữ để đối chiếu:

- `HospitalPB004_fresh_28c2c71432ec4a398ee028588c33526e`
- `HospitalPB004_legacy_eb03b29c4c8148468bba986a3da5704f`

Giới hạn: restore cần quyền đọc NuGet.Config; kết nối Windows authentication bị sandbox chặn SSL credentials, nên restore/test SQL chạy ngoài sandbox sau khi được cấp quyền. Không thay cấu hình sandbox/SQL Server. Chưa chạy toàn bộ CI/browser/native hoặc rehearsal trên backup dữ liệu thực; fixture legacy là dữ liệu tổng hợp trên schema migration cũ thật. Không chạy migration database ứng dụng/demo/online.

Nội dung đề xuất PR: **[PB-004] Bổ sung schema phòng khám và chuyển đổi legacy an toàn**. Trước thay đổi chưa có phân công phòng/bác sĩ hoạt động, trạng thái khám hay snapshot phiếu. Sau thay đổi có schema bổ sung tương thích legacy, backfill phòng có bằng chứng duy nhất, báo cáo phần chưa xác định và bảo vệ rollback khỏi mất dữ liệu. Unique trên dữ liệu cũ được trì hoãn cho task nghiệp vụ tương ứng; tài liệu nêu rõ PB-006/007/008/010/011/030. File ngoài phạm vi chính phục vụ báo cáo, kiểm thử CI và hướng dẫn bàn giao.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-004, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

