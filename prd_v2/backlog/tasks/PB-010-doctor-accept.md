# PB-010 Danh sách chờ và tiếp nhận một bệnh nhân vào khám

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/test local hoàn tất; chờ review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Khám bệnh |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-008](./PB-008-confirm-reception.md) |
| Đối chiếu kế hoạch | P3a / QD-01 |
| Branch gợi ý | `feat/pb-010-doctor-accept` |
| PR | Chưa mở |

## Kết quả cần bàn giao

API danh sách chờ theo phòng và lệnh tiếp nhận; UI bác sĩ hiển thị danh sách/cùng một ca Đang khám.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Journeys/JourneyEndpoints.cs; Identity/Access.cs; Infrastructure/HospitalDb.cs; apps/web/src/StaffClinical.tsx.

## Tiêu chí chấp nhận

- [x] Chỉ đúng bác sĩ hoạt động/phụ trách xem và nhận người Chờ khám; chọn bất kỳ người đủ điều kiện, không ép FIFO.
- [x] Hai tab nhận hai người trong cùng phòng: tối đa một thành công; transaction và unique constraint bảo vệ một InConsultation/phòng.
- [x] Nhận ca ghi lần khám/sự kiện gọi có ID, số phiếu/phòng; retry cùng lệnh không tăng lần hoặc tạo sự kiện trùng.

## Kiểm chứng bắt buộc

API wrong role/room, race hai Visit, retry; browser nhận ca/chặn ca thứ hai.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không implement tự phát TTS; sự kiện cơ bản là đầu vào PB-023.

## Phối hợp và phụ thuộc

StaffClinical.tsx sẽ tiếp tục được PB-011/012/014/015 sửa; không làm refactor toàn file ngoài phạm vi.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Nhánh local `feat/pb-010-doctor-accept`, base `origin/main` `f97b348` (PR #23,
đã gồm PB-009). Dependency PB-008 đã merge PR #21; PB-009 không phải dependency
bắt buộc của PB-010. Không theo dõi upstream
main. Commit/push nhánh PB-010 theo yêu cầu người dùng; chưa có reviewer/PR nên chưa đánh Done.

- Thêm DoctorConsultations: queue lọc quyền trước phân trang, POST accept đúng
  input `{version}`, GET VisitV2 với event/capability cho workspace Doctor.
- Thêm ConsultationCall lưu snapshot/event ID/lần khám; transaction/receipt/audit/
  notification cùng commit. Unique index theo phòng bảo vệ một Active InConsultation.
- Migration `20261113224433_DoctorConsultation` nối PB-007, preflight SQL 51010;
  Down chặn 51011 khi có event. Không xóa dữ liệu, đánh lại H- hoặc đổi bác sĩ.
- UI DoctorQueue tách khỏi StaffClinical, có current consultation, nhận ca bất kỳ,
  chặn ca thứ hai, pagination/poll/error/reload. Labels sáu locale, không hiển thị
  event ID kỹ thuật trong UI; không thêm TTS hoặc clinical command của task sau.
- [Tài liệu runtime/rollback/test](../../../codes/docs/requirements/PB-010-DOCTOR-ACCEPT.md),
  [API tests](../../../codes/tests/api/doctor-accept.test.mjs),
  [browser tests](../../../codes/tests/browser/doctor-accept.spec.ts),
  [migration tests](../../../codes/tests/doctor-accept/Program.cs).
- File chung: Entities.cs, HospitalDb.cs, model snapshot, Program.cs,
  StaffClinical.tsx/App.tsx, shared labels và ci-native.ps1. OpenAPI cập nhật bốn path mới.
  App bỏ bộ chọn Visit legacy ở workspace Doctor V2 vì danh sách phòng tự quản lý
  ca hiện tại; các workspace còn lại giữ cách chọn cũ.

### Kiểm chứng ngày 14/11/2026

| Lệnh/kịch bản | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| `node --test tests/api/doctor-accept.test.mjs` | PASS 5/5 | SQL thật, race/retry/rollback/revoked scope; `.local/pb010-api.log` |
| `npx playwright test --config playwright.doctor.config.ts` | PASS 2/2 | Desktop + Pixel 7 viewport; `.local/pb010-browser.log` |
| `dotnet run --project tests/doctor-accept/DoctorAccept.Tests.csproj -c Release` | PASS 9 assertions | `.local/pb010-migration.log`, SQL Docker loopback riêng |
| Hồi quy `tests/core-schema/CoreSchema.Tests.csproj` | PASS 79 assertions | `.local/pb010-core-regression.log` |
| Hồi quy `tests/ticket-number/TicketNumber.Tests.csproj` | PASS 38 assertions | `.local/pb010-ticket-regression.log` |
| `node --test tests/api/confirm-reception.test.mjs` | PASS 7/7 | `.local/pb010-confirm-regression.log`; PB-008 với schema mới |
| Build .NET Release + EF pending-model check | PASS | 0 warning/error; snapshot khớp model |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS | `.local/pb010-{typecheck,lint,build}.log` |
| `npm run test:languages:unit` | PASS 3/3 | `.local/pb010-languages.log` |

Ảnh local đã xem: `codes/artifacts/chromium-desktop-pb010.png` và
`chromium-mobile-pb010.png`. Dữ liệu tổng hợp, không có secrets. Screenshot tùy chọn
PB010_CAPTURE, không bắt CI chụp ảnh toàn trang để tránh lặp lỗi timeout PB-006.

Database acceptance cuối `HospitalAcceptance_1794610988139` (fixture đầu
`HospitalAcceptance_1794610174888` được giữ), migration fixture
`HospitalPB010_fba7c913d3c44600b12ef435f12eee5e`. Các database fixture được giữ lại;
không dùng database demo/online. Lần API test đầu dùng undefined cho forged doctorId
nên JSON bỏ trường đó, tạo command hợp lệ ngoài ý muốn; đã sửa fixture thành UUID
và chạy lại trên database mới, sau đó bộ 5 test cuối đạt. Không che lỗi lần đầu.

Kiểm tra cuối phát hiện workspace thiếu destructure config sau khi bỏ Visit picker;
typecheck và browser bắt lỗi, đã bổ sung và chạy lại. CI Doctor dùng database mới
riêng vì test PB-008 chủ động giữ phòng bận, khôi phục connection/database sau phase;
không dọn state suite khác để ép test qua.

Chưa chạy toàn bộ CI GitHub/LocalDB hoặc regression API legacy trong phiên này;
CI hiện có vẫn chạy các gate đó. Không cần native Android trong scope PB-010.
Reviewer/merge và luồng clinical/TTS của task sau chưa được nghiệm thu ở đây.

### Nội dung PR đề xuất

**Tiêu đề:** `[PB-010] Danh sách chờ và nhận một bệnh nhân vào khám theo phòng`

Bác sĩ đang hoạt động chọn bất kỳ Visit Waiting đúng phòng/phụ trách và nhận vào
khám. Transaction và unique index bảo vệ một InConsultation/phòng; tăng lần khám
và lưu event gọi với snapshot phiếu, retry không lặp sự kiện hoặc tăng lần.
UI hiển thị ca hiện tại và chặn nhận ca tiếp theo. Thêm migration có bảo vệ dữ liệu,
API/browser/migration tests và CI; chưa triển khai chỉ định, hoàn tất khám hoặc TTS.
Dependency PB-008 đã merge; phối hợp snapshot với migration PB-013/028.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-010, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

