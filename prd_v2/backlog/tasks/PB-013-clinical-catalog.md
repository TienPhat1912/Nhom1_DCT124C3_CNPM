# PB-013 Danh mục triệu chứng, dấu hiệu, chẩn đoán và mẫu Việt

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/test local hoàn tất; chờ review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Chẩn đoán |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-004](./PB-004-core-schema.md), [PB-005](./PB-005-clinic-assignment.md) |
| Đối chiếu kế hoạch | P1 / P3b |
| Branch gợi ý | `feat/pb-013-clinical-catalog` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Schema danh mục/kết quả cấu trúc và API/UI Admin quản lý danh mục/mẫu Việt; cung cấp catalog đọc cho Doctor.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Domain/Entities.cs; Infrastructure/HospitalDb.cs; Migrations/; Administration/AdminEndpoints.cs; Content/; apps/web/src/Admin.tsx.

## Tiêu chí chấp nhận

- [x] Bác sĩ đọc các mục đang dùng; Admin thêm/sửa/ngừng dùng; mã/phiên bản có validation và audit.
- [x] Ngừng dùng/sửa danh mục không làm thay đổi snapshot lịch sử; khóa ngoại và bảng liên kết chuẩn bị được cho kết quả khám.
- [x] Fixture demo được đánh dấu; không suy ra chẩn đoán từ triệu chứng hoặc tự nhận dữ liệu mẫu là danh mục bệnh viện đã duyệt.

## Kiểm chứng bắt buộc

API quyền/CRUD/validation; migration mới/cũ; browser Admin; test lịch sử không đổi khi sửa tên mục.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không xác nhận/công bố kết quả bệnh nhân; PB-014 triển khai.

## Phối hợp và phụ thuộc

Có migration và Admin.tsx; phụ thuộc PB-005 để hạn chế đụng cùng form.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai trên nhánh hiện có `AnhBao_PB013_clinical_catalog`, base `0caec24`
(PB-012 PR #26). Dependency PB-004 PR #15 (`ed7ec62`), PB-005 PR #22 (`6e06a54`)
đã có trong lịch sử checkout. PB-013 chưa có PR/reviewer nên không đánh Done/merge.

- [Hợp đồng, schema và hướng dẫn PB-013](../../../codes/docs/requirements/PB-013-CLINICAL-CATALOG.md).
- [API tests](../../../codes/tests/api/clinical-catalog.test.mjs),
  [browser tests](../../../codes/tests/browser/clinical-catalog.spec.ts),
  [migration tests](../../../codes/tests/clinical-catalog/Program.cs),
  [runner SQL riêng](../../../codes/tests/clinical-catalog/run.ps1).
- Admin có bốn nhóm, CRUD bằng tạo/sửa/ngừng dùng/dùng lại, tìm kiếm/phân trang,
  validation, xử lý phiên bản cũ/tải lại, hủy trước lưu và nhãn sáu locale. Doctor
  có API active-only, không có suy diễn chẩn đoán hay công bố kết quả bệnh nhân.
- Mutation có key, optimistic concurrency, audit before/after và rollback cùng
  transaction. Code/phân loại ổn định; snapshot lịch sử giữ tên/mã/phiên bản.
- Migration `20261114023849_ClinicalCatalog` thêm sáu bảng catalog/template/result/
  liên kết; unique/check/FK Restrict, không backfill SummaryVersion. Down chặn
  bằng 51018 nếu bất kỳ bảng mới có dữ liệu, kể cả demo.
- Seed riêng chỉ khi Demo và V2 cùng bật, IsDemo không sửa được qua API, insert-only
  và không bật lại mục đã ngừng dùng. Tab/API nằm sau Workflow:PrdV2Enabled.
- File chung cần review: Entities.cs, HospitalDb.cs, model snapshot, Program.cs,
  AdminEndpoints.cs/Admin.tsx, shared types và ci-native.ps1. Thêm DTO catalog
  và hai mã lỗi; giữ nguyên hợp đồng ClinicalRecordV2/PB-014 đã chốt.

### Kiểm chứng local ngày 14/11/2026

| Lệnh/kịch bản (từ codes/) | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/clinical-catalog/run.ps1 -SqlServer localhost -Regression -Capture` | PASS, runner exit 0 | `.local/pb013-final.log`; web build, Release publish, migration/API/browser và 4 suite hồi quy |
| `dotnet run --project tests/clinical-catalog/ClinicalCatalog.Tests.csproj -c Release` (runner) | PASS 33 assertions | Schema mới/cũ, giữ legacy, snapshot, FK/check/unique, seed/idempotence, downgrade |
| `node --test tests/api/clinical-catalog.test.mjs` (runner) | PASS 7/7 | Role/CRUD/validation, template Việt, race/retry/audit, history, pagination, rollback |
| `npx playwright test --config playwright.clinical.config.ts` (runner) | PASS 2/2 | Chromium desktop + Pixel 7 viewport; bốn nhóm, demo, stale edit/refresh, cancel và reload |
| Hồi quy API PB-012 / PB-011 / PB-010 / PB-008 | PASS 6/6 / 6/6 / 5/5 / 7/7 | Mỗi suite có database riêng trong cùng runner |
| `dotnet build tests/clinical-catalog/ClinicalCatalog.Tests.csproj -c Release --no-restore` | PASS, 0 warning/error | Build API và migration-test project |
| `dotnet ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build` | PASS | Không có model change thiếu migration |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS | Web/mobile/shared/contracts; build có cảnh báo chunk trên 500 kB |
| `npm run test:languages:unit` | PASS 3/3 | Dictionary/nhãn sáu locale |
| `git diff --check`; parser PowerShell runner/CI | PASS | Không lỗi whitespace/cú pháp |

Fixture cuối: API `HospitalAcceptance_1794624599819`; migration
`HospitalPB013_6d315c6eff4d495ea7f4ace4d37a4384` và
`HospitalPB013_Fresh_d14eeb48df934a99826f0d4d43c6db7e`.
Hồi quy PB-012/011/010/008 lần lượt `HospitalAcceptance_1794624638057`,
`HospitalAcceptance_1794624652602`, `HospitalAcceptance_1794624665925`,
`HospitalAcceptance_1794624677196`. Fixture thử trước được giữ, không ghi database
demo/online; runner dừng process API và khôi phục biến môi trường sau test.
Ảnh local `codes/artifacts/chromium-{desktop,mobile}-pb013-{catalog,template}.png`
đã xem; chỉ chứa dữ liệu tổng hợp.

Lần migration đầu phát hiện khác biệt LIKE của SQL Unicode khi đặt dấu `-` cuối
character class; đã sửa constraint mã sang `[^-A-Z0-9_]`, kiểm tra SQL, chạy lại
fixture mới và xác nhận model/snapshot khớp. Fixture history dùng hex Unicode
để tránh lỗi parse JSON argument của sqlcmd Windows. Không bỏ assertion hoặc
nới validation để test qua.

Chưa chạy toàn bộ GitHub CI/default legacy browser/API, Android hoặc triển khai
lên server trong phiên này. CI đã thêm migration/API/browser PB-013. Node local
là 24.19.0, khác manifest Node 22; .NET SDK 10.0.401, SQL Server localhost Windows
authentication. Restore test project/kết nối SQL cần chạy ngoài sandbox của máy;
không có dependency/package mới. Các cảnh báo build chunk size, Node module type/
console color và chuẩn hóa line ending của Git không làm test thất bại.

### Nội dung PR đề xuất

**Tiêu đề:** `[PB-013] Danh mục lâm sàng và mẫu kết quả Việt có phiên bản`

Thêm danh mục triệu chứng/dấu hiệu/chẩn đoán và mẫu Việt cho Admin, API active-only
cho Doctor. Schema kết quả cấu trúc có snapshot và bảng liên kết để sửa/ngừng dùng
danh mục không đổi lịch sử. Có validation, version, idempotency/audit, fixture demo
được đánh dấu và migration downgrade bảo vệ dữ liệu. Thêm API/browser/migration
tests và CI; xác nhận/công bố kết quả bệnh nhân tiếp tục ở PB-014.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-013, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

