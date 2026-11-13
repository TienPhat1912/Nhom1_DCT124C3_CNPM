# PB-008 Xác nhận tiếp nhận và mở Journey ngay trên web

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai và kiểm chứng local hoàn tất, chờ PB-005/review/PR/merge |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Tiếp nhận |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-005](./PB-005-clinic-assignment.md), [PB-006](./PB-006-registration-request.md), [PB-007](./PB-007-ticket-number.md) |
| Đối chiếu kế hoạch | P2b |
| Branch gợi ý | `feat/pb-008-confirm-reception` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Lệnh xác nhận tạo Visit/Journey Active, phiếu và grant nguyên tử; Staff web chọn phòng, xác minh, xác nhận/in lại; Patient web mở Journey không cần redeem.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Reception/ReceptionEndpoints.cs; Journeys/Workflow.cs; apps/web/src/StaffReception.tsx, PatientJourney.tsx, App.tsx.

## Tiêu chí chấp nhận

- [x] Hai nhân viên xác nhận cùng yêu cầu không tạo hai Visit/phiếu; kiểm tra lại Patient, phòng và bác sĩ trong giao dịch.
- [x] Ghi cố định phòng/bác sĩ và snapshot; phiếu đúng số; in lại cùng Visit/ticket; phòng bận khám vẫn nhận thêm hàng chờ.
- [x] Không cần QR tiếp nhận/kích hoạt trong luồng web mới; Entry và link phiếu cũ kiểm tra quyền, không tạo thêm lượt.

## Kiểm chứng bắt buộc

API confirm cạnh tranh/rollback/grant; browser Reception → Patient Journey; in lại giữ số và reload giữ tiến độ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Chưa thay workflow khám/dịch vụ; không tự sửa tài liệu PRD đang được trợ lý khác viết.

## Phối hợp và phụ thuộc

Workflow.cs/PatientJourney.tsx là điểm dùng chung; PB-010/021 chỉ bắt đầu sau merge.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai local ngày 13/11/2026 trên nhánh có sẵn `AnhBao_PB008_confirm_reception`.

- [Lệnh xác nhận V2](../../../codes/backend/Hospital.Api/Reception/ReceptionConfirmation.cs), tích hợp qua ReceptionEndpoints; dùng schema PB-004 và allocator PB-007, không thêm migration.
- [StaffReceptionV2](../../../codes/apps/web/src/StaffReceptionV2.tsx); Patient tự mở Journey sau xác nhận; phiếu dùng snapshot và in lại giữ nguyên.
- [API tests](../../../codes/tests/api/confirm-reception.test.mjs), [browser tests](../../../codes/tests/browser/confirm-reception.spec.ts), [runner database riêng](../../../codes/tests/reception/run.ps1). Đã tích hợp CI.
- [Hướng dẫn API, tính nguyên tử, triển khai và giới hạn](../../../codes/docs/requirements/PB-008-CONFIRM-RECEPTION.md).

Phụ thuộc: nhánh local có merge PB-006 (#18, `6fe598a`) và PB-007 (#20, `c5a1355`). PB-005 chưa có mã quản trị phân công trên nhánh này. PB-008 đọc trực tiếp bảng phân công đã tồn tại từ PB-004, không tham chiếu endpoint chưa có; chưa đủ điều kiện merge/bật toàn bộ luồng trước PB-005. Không đánh Done khi chưa có PR/review/merge.

### Kiểm chứng thực chạy ngày 13/11/2026

Từ `codes/`:

| Lệnh | Kết quả |
|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost` | PASS — build web/publish .NET; 7 API PB-008 + 7 API hồi quy PB-006; 2 browser PB-008 + 8 browser PB-006, desktop và mobile viewport |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost -Port 5299 -LegacyOnly` | PASS — build/publish, 23 ca API legacy với V2 tắt |
| `npm.cmd run typecheck` | PASS — web/mobile/shared và contracts |
| `npm.cmd run lint` | PASS — không cảnh báo |
| `git diff --check` | PASS |

Tổng **37 ca API + 10 ca browser PASS**. Lần chạy cuối dùng database mới
`HospitalAcceptance_1794565833397` (V2) và `HospitalAcceptance_1794565902237` (legacy).
Artifact nằm trong `codes/artifacts/pb008-*`, database được giữ để đối chiếu; các API
test server đã được dừng. Các ca rollback so số lượng Visits, phiếu, Journey,
ReceptionRecord, grant, receipt, audit, notification và tổng counter trước/sau lỗi.

Giới hạn: SQL Windows authentication, tiến trình API và browser test cần quyền
ngoài sandbox và đã được cấp quyền. Chưa chạy CI trên GitHub, native Android hay
máy in vật lý; browser xác minh gọi in lại và snapshot/số không đổi. Không chạy
migration/deploy trên database ứng dụng đang dùng; PB-008 không thêm migration.

Đề xuất PR: **[PB-008] Xác nhận tiếp nhận nguyên tử và mở Journey trên web không cần QR**.
Trước thay đổi request V2 chưa thể xác nhận; sau thay đổi Reception chọn phòng/bác sĩ
đã cấu hình, xác nhận tạo một Visit/Journey/phiếu/grant, Patient mở Journey ngay,
in lại dùng snapshot cố định. Thay đổi ngoài đường dẫn chính phục vụ endpoint V2,
đọc snapshot, guard lệnh legacy, phân tách UI lịch sử, kiểm thử/CI và tài liệu.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-008, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

