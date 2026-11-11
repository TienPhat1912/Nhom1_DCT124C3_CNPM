# PB-001 Chốt hợp đồng trạng thái, DTO và lỗi nghiệp vụ

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — đã hoàn tất triển khai local, chờ review/PR/merge |
| Người nhận | Codex (theo yêu cầu người dùng) |
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

- [x] Có đủ Waiting → InConsultation → InService → Waiting, Completed và điều kiện quyết toán; tách khỏi trạng thái Visit/Journey.
- [x] DTO có phòng/bác sĩ, phiếu theo ngày, lần gọi khám, bước hiện tại và khả năng thao tác. Không nhận dữ liệu tác giả/quyền từ client.
- [x] Ghi rõ cách áp dụng khóa đổi bác sĩ khi còn Visit Active và nhãn InService là các diễn giải cần đối chiếu bản PRD viết lại; không mở lại các quyết định đã chốt.

## Kiểm chứng bắt buộc

Typecheck khi thêm shared types; review bảng lệnh và mẫu request/response với thành viên API/UI.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không triển khai endpoint, migration hoặc đổi luồng đang chạy.

## Phối hợp và phụ thuộc

types.ts là file chung; người nhận PB-001 thống nhất tên trước khi task phụ thuộc bắt đầu.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

### Kết quả local — 11/11/2026

- [Hợp đồng API](../../../codes/docs/architecture/API.md#pb-001-hợp-đồng-prd-v2): bảng trạng thái, lệnh/quyền/version/key, lỗi cạnh tranh, mẫu request/response, điều kiện quyết toán và phương án cô lập triển khai.
- [Shared types](../../../codes/packages/shared/src/types.ts): thêm ExamStatus và DTO V2; giữ nguyên DTO legacy. Input tách khỏi snapshot/actor/capabilities; backend triển khai sau phải kiểm tra trường JSON thực tế.
- [Quyết định](../../../codes/docs/architecture/DECISIONS.md#pb-001-đối-chiếu-prd-v2): giữ QD-01..06; đối chiếu bản `prd chinh thuc.docx`, FR-VISIT-03/09, FR-ADM-07, BR-20/21 xác nhận phạm vi khóa Visit Active và nhãn InService.
- [Kiểm tra hợp đồng](../../../codes/tests/contracts/prd-v2.typecheck.ts): mẫu consumer hợp lệ và 16 trường hợp phải bị TypeScript từ chối, gồm nhiều dịch vụ, trạng thái legacy, thiếu version, tác giả/quyền client và quyết toán Intermediate. `npm run test:contracts` được tích hợp vào `npm run typecheck` để CI chạy cùng kiểm tra web/mobile.

| Kiểm chứng thực chạy từ `codes/` | Kết quả |
|---|---|
| `npm.cmd run typecheck` | PASS — web, mobile và test:contracts |
| `npm.cmd run lint` | PASS — không cảnh báo |
| `npm.cmd run build` | PASS — Vite production build |
| `git diff --check` (từ repo root) | PASS |
| Kiểm tra các đường dẫn file trong API.md và DECISIONS.md bằng PowerShell | PASS |

Windows dùng `npm.cmd` vì PowerShell chặn `npm.ps1`; không thay execution policy. Không thay endpoint, schema, migration, UI hoặc luồng đang chạy. Không chạy API race/DB/browser/native vì chưa có thay đổi thực thi; kiểm tra TypeScript không chứng minh guard backend. Các ca review nghiệp vụ được ghi trong API.md để task API tương ứng triển khai và kiểm thử.

Nội dung đề xuất cho PR: **[PB-001] Chốt hợp đồng trạng thái, DTO và lỗi nghiệp vụ PRD v2**. Trước thay đổi chỉ có DTO/hợp đồng legacy; sau thay đổi API/UI có hợp đồng đích riêng, mẫu lệnh, lỗi và kiểm tra kiểu dùng chung. File chung dễ xung đột: `types.ts`; file ngoài ba đường dẫn chính chỉ phục vụ kiểm chứng (`package.json`, `tests/contracts/`) và cập nhật card này. Không có migration hoặc cấu hình runtime cần áp dụng.

Chưa mở PR, chưa có reviewer API/UI xác nhận và chưa merge; không đánh Done hoặc mở khóa task phụ thuộc chỉ dựa trên phần local. Những ô bàn giao bên dưới giữ nguyên cho tới khi có bằng chứng review/merge thực tế.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-001, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

