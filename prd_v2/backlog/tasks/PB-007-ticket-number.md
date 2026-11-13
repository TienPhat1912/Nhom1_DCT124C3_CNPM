# PB-007 Cấp số phiếu an toàn theo phòng và ngày

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/test local hoàn tất; chờ review và PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
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

- [x] Mỗi phòng/ngày bắt đầu 001; cấp đồng thời không trùng; có unique constraint tương ứng.
- [x] Lệnh retry nhận cùng kết quả khi được gọi trong command giao dịch; không dùng MAX+1 không khóa.
- [x] Không đánh lại số H- cũ; phiếu đã cấp không thay đổi khi sang ngày hoặc in lại. Có định dạng đủ phân biệt phòng/ngày.

## Kiểm chứng bắt buộc

Test SQL concurrent cấp số, hai phòng, qua ngày, rollback/retry và migration dữ liệu cũ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Chỉ hoàn thành bộ cấp số với test tích hợp; hook vào confirm và UI phiếu thuộc PB-008.

## Phối hợp và phụ thuộc

Có EF migration: lấy snapshot mới nhất, merge tuần tự với PB-006/013/028.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai local trên `feat/pb-007-ticket-number`, base `origin/main` tại
`6fe598a` (PR #18 PB-006). Dependency PB-004 đã merge PR #15 `ed7ec62`;
card PB-004 còn trạng thái cũ, đối chiếu lịch sử Git để xác nhận dependency.

- Thêm ba trường cấp số nullable trên ExaminationTicket, bảng TicketDailyCounters,
  FK/check/unique constraints và migration `20261112200836_TicketNumberPerClinicDay`.
- Bộ cấp số scoped dùng TimeProvider và khóa SQL theo phòng/ngày; hoạt động trong
  transaction của caller, không thay endpoint confirm cũ hoặc UI.
- [Tài liệu tích hợp, định dạng, migration và rollback](../../../codes/docs/requirements/PB-007-TICKET-NUMBER.md).
- [Test SQL nghiệp vụ và migration](../../../codes/tests/ticket-number/Program.cs),
  tích hợp vào `scripts/test/ci-native.ps1`.
- File chung cần review: Entities.cs, HospitalDb.cs, model snapshot, Program.cs,
  ci-native.ps1. Không thay shared contract; số thuần `001` giữ đúng TicketNumberV2,
  tham chiếu đầy đủ kèm phòng/ngày. PB-008 tạo snapshot/Visit và tích hợp UI.
- Migration Down chặn SQL 51008 nếu đã phát hành số/có counter, giữ nguyên dữ liệu;
  rollback ứng dụng giữ schema trong trường hợp này.

### Kiểm chứng ngày 13/11/2026

Các lệnh thực chạy từ `codes/`:

| Lệnh/kịch bản | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| `dotnet run --project tests/ticket-number/TicketNumber.Tests.csproj -c Release` | PASS — 38 assertions | SQL Server thật, container riêng loopback; `.local/pb007-sql-tests.log` |
| `dotnet run --project tests/registration/Registration.Tests.csproj -c Release` | PASS — 9 assertions | Hồi quy migration PB-006 với model mới; `.local/pb007-registration-regression.log` |
| `dotnet restore --locked-mode` + `dotnet build -c Release --no-restore` | PASS | 0 warning/error |
| `dotnet-ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build` | PASS | Model khớp snapshot |
| `npm run typecheck` | PASS | Web/mobile/shared contracts, `.local/pb007-typecheck.log` |
| `npm run lint` | PASS | 0 warning; `.local/pb007-lint.log` |
| PowerShell parser + `git diff --check` | PASS | Script CI hợp lệ, không lỗi whitespace |

Database giữ để đối chiếu: `HospitalPB007_b7710f86644a4e1aa7f0c011b1ab90bd`,
`HospitalPB007_fresh_c1a2fbd0843a4014a885446ca81a0b78` và hồi quy PB-006
`HospitalAcceptance_1794514330719`. Không đọc/ghi database demo/online.
Lần compile test đầu phát hiện biểu thức SequenceEqual qua await và SQL raw nối
chuỗi bị analyzer từ chối; đã đổi thành biến sau await và parameter hóa trước khi
chạy SQL thành công. Bổ sung bảo vệ Down/culture và phiếu đã lưu, rồi chạy lại bản
38 assertions. Các database fixture từ lần chạy trước vẫn được giữ local.

Chưa chạy toàn bộ workflow GitHub Actions hoặc LocalDB trên máy này; kết quả local
không thay kết quả CI. Chưa có reviewer/PR/merge nên chưa đánh Done.

### Sửa lỗi CI hồi quy PB-004 ngày 13/11/2026

Log CI tại release `e3db3ca` cho thấy API 23/23 và translation đạt, sau đó
PB-004 thất bại ở `Blocked downgrade preserves all data`. Test fingerprint schema
latest nhưng EF đã gỡ PB-007 trước khi guard PB-004 chặn Down; đây là so sánh sai
mốc schema, không phải allocator làm mất phiếu.

- Hai kịch bản fresh/legacy hiện đưa schema về đúng migration PB-004 trước khi
  kiểm tra Down bị chặn, so sánh đầy đủ fingerprint, rồi nâng latest và so sánh lại.
- Thêm `PB004_SQL_CONNECTION` tùy chọn cho SQL auth local để tái hiện bộ test thật
  trên Docker; luôn sinh database fixture mới. CI vẫn dùng LocalDB, xóa override
  trong quá trình test và khôi phục biến môi trường sau khi kết thúc.
- Đã tái hiện lỗi trước sửa (`.local/pb007-core-before.log`) và chạy đạt **79
  assertions** sau sửa (`.local/pb007-core-after.log`) bằng
  `dotnet run --project tests/core-schema/CoreSchema.Tests.csproj -c Release`.
- Database fixture sau sửa: `HospitalPB004_fresh_2675bbe21c184cb7bdf74e1c2bd60d63`
  và `HospitalPB004_legacy_9bcf2db5f6674912ac4aa4140ef816ee`.
- Không đổi migration đã phát hành hoặc logic cấp số; cần push bản sửa và chạy
  lại CI để xác nhận toàn bộ workflow.

### Nội dung PR đề xuất

**Tiêu đề:** `[PB-007] Cấp số phiếu an toàn theo phòng và ngày Việt Nam`

Task PB-007; dependency PB-004 PR #15 đã merge. Thêm bộ đếm phòng/ngày và cấp số
`001` trong transaction SQL; các lệnh đồng thời không trùng, retry cùng command
trả đúng kết quả cũ. Giữ nguyên số H- và ID lịch sử; ngày/phòng/số mới được lưu
để đọc/in lại, có tham chiếu đủ phân biệt phòng/ngày.

Migration nối PB-006, thêm cột nullable, unique/check/FK; Down từ chối mất dữ liệu
đã phát hành. Đã test SQL concurrent/room/day/rollback/retry/migration và build;
confirm/UI thuộc PB-008. Lấy snapshot này trước khi làm migration PB-013/028.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-007, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

