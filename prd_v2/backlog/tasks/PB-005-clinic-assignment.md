# PB-005 Quản trị bác sĩ đang hoạt động theo phòng

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai và kiểm chứng local hoàn tất, chờ review/PR/merge |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Quản trị |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-004](./PB-004-core-schema.md) |
| Đối chiếu kế hoạch | P1 / QD-02 |
| Branch gợi ý | `feat/pb-005-clinic-assignment` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Hoàn thiện API và form Admin chọn bác sĩ thuộc phòng, hiển thị người đang hoạt động và điều kiện được thay đổi.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Administration/AdminEndpoints.cs; Identity/Access.cs; Infrastructure/HospitalCatalog.cs; apps/web/src/Admin.tsx; tests/catalog/.

## Tiêu chí chấp nhận

- [x] Chỉ chọn Doctor có tài khoản dùng được, đúng phòng/phạm vi; một phòng không có hai bác sĩ hoạt động dù thao tác đồng thời.
- [x] Không thay phân công/đổi bác sĩ của phòng khi còn Visit Active theo cách áp dụng trong kế hoạch. Khóa tài khoản bảo mật không tự chuyển ca.
- [x] Khởi động lại/nhập roster không ghi đè lựa chọn Admin; cấu hình và audit lưu đủ người/thời điểm.

## Kiểm chứng bắt buộc

API quyền, cạnh tranh và chặn đổi; test catalog restart/idempotence; browser form chọn/đổi bị chặn.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không xây bàn giao ca, chuyển Visit sang bác sĩ khác hoặc quản lý lịch trực.

## Phối hợp và phụ thuộc

Admin.tsx/HospitalCatalog.cs dùng chung với PB-013; phối hợp hoặc tách component mới.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai local ngày 13/11/2026 trên nhánh có sẵn `AnhBao_PB005_clinic_assignment`.

- [API phân công](../../../codes/backend/Hospital.Api/Administration/ClinicAssignments.cs) dùng schema PB-004, transaction/version/idempotency chung với tiếp nhận và audit before/after.
- [Form Admin](../../../codes/apps/web/src/ClinicAssignments.tsx) có chọn thành viên, chọn/bỏ bác sĩ hoạt động, xem lại/hủy/xác nhận, hiển thị Visit Active và xử lý lỗi phiên bản. Nhãn đủ sáu ngôn ngữ.
- Hồ sơ bác sĩ/directory lấy phân công từ database. Access và danh sách Visit kiểm tra phòng cho bác sĩ đang xử lý Visit Active. Khóa tài khoản thu hồi session ngay và giữ nguyên phân công, Visit cùng snapshot.
- [API tests](../../../codes/tests/catalog/assignments.test.mjs), [browser tests](../../../codes/tests/browser/clinic-assignment.spec.ts), [runner](../../../codes/tests/catalog/pb005.ps1), [đối chiếu restart/nhập lại roster](../../../codes/tests/catalog/restart.mjs). CI native gọi cùng runner.
- [Hướng dẫn API, vận hành và kiểm thử](../../../codes/docs/requirements/PB-005-CLINIC-ASSIGNMENT.md).

### Kiểm chứng thực chạy ngày 13/11/2026

Từ `codes/`.

| Lệnh | Kết quả |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/catalog/pb005.ps1 -SqlServer localhost` | PASS — build web/publish API, 9 API, 2 browser desktop/mobile, restart và nhập lại roster |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost` | PASS — 7 API PB-008, 7 API PB-006, 2 browser PB-008, 8 browser PB-006 |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost -Port 5299 -LegacyOnly` | PASS — 23 ca API legacy, V2 tắt |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/catalog/run.ps1 -SqlServer localhost -Configuration Release` | PASS — nhập bổ sung, bảo toàn dữ liệu cũ, API legacy và idempotence |
| `npm.cmd run typecheck` | PASS — web/mobile/shared/contracts |
| `npm.cmd run lint` | PASS — 0 cảnh báo |
| `npm.cmd run test:languages:unit` | PASS — 3 ca, đủ nhãn sáu ngôn ngữ |
| `npm.cmd run test:directory:unit` | PASS — 3 ca |
| `git diff --check` | PASS |

Artifact PB-005 nằm ở `codes/artifacts/pb005-*`, ảnh lưu thành công/bị khóa nằm
trong `codes/artifacts/pb005-browser-results`. Database kiểm thử được giữ để đối
chiếu. Lần nghiệm thu cuối dùng `HospitalAcceptance_1794579253883`, gồm kiểm tra
schema OpenAPI. Hồi quy V2 dùng `HospitalAcceptance_1794578967239`, legacy dùng
`HospitalAcceptance_1794579042065`, catalog cũ dùng `HospitalAcceptance_1794578992590`.
Tổng 46 ca API, 12 ca browser và 6 ca unit PASS, cùng các đối chiếu catalog/restart.
Các tiến trình kiểm thử đã dừng. SQL Windows authentication và API/browser chạy ngoài sandbox.
Môi trường local dùng Node 24.19.0, .NET SDK 10.0.401 so với bản khóa 22.19.0 và
10.0.400. Vite cảnh báo chunk trên 500 kB. CI GitHub, review, PR và merge đang chờ.

Đề xuất PR **[PB-005] Quản trị bác sĩ hoạt động theo phòng và khóa đổi khi còn Visit Active**.
Trước thay đổi Admin quản lý nhân sự và danh mục chung. Sau thay đổi Admin quản
lý thành viên/bác sĩ hoạt động theo phòng trên database, được bảo vệ bởi version,
giao dịch, quyền và Visit Active. Các file chung thay đổi gồm Admin.tsx,
AdminEndpoints.cs, Access.cs, HospitalCatalog.cs, JourneyEndpoints.cs,
types.ts/i18n và CI/tests. Các dependency được tái sử dụng từ mã PB-004/PB-008 đã
có trên nhánh. Trạng thái Done chờ quy trình review/merge bên dưới.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-005, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

