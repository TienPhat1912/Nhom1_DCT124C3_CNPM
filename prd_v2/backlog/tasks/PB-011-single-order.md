# PB-011 Chỉ định đúng một dịch vụ và khóa sau xác nhận

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/test local hoàn tất; chờ review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Khám bệnh |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-010](./PB-010-doctor-accept.md) |
| Đối chiếu kế hoạch | P3a / QD-04 |
| Branch gợi ý | `feat/pb-011-single-order` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Form một dịch vụ → xem trước → xác nhận; API tạo order bất biến và chuyển InService.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Journeys/JourneyEndpoints.cs, Workflow.cs; Infrastructure/HospitalDb.cs; apps/web/src/StaffClinical.tsx.

## Tiêu chí chấp nhận

- [x] Chỉ bác sĩ đang khám được xác nhận; tối đa một order chưa xong/Visit, được bảo vệ khi thao tác đồng thời.
- [x] Commit tạo đúng một order, chuyển InService, đích dịch vụ, loại khỏi hàng chờ và nhả ca; phòng nhận bệnh nhân khác được.
- [x] API/UI sửa/hủy order và skip/progress trái quy tắc bị chặn. Cấu hình dịch vụ/địa điểm đổi sau preview thì yêu cầu xem lại.

## Kiểm chứng bắt buộc

API single-order race, rollback, old update/cancel bypass; browser preview/cancel trước confirm/confirm; kiểm tra currentStep không giữ consultation cũ.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không lưu kết quả chuyên môn hoặc cho nhiều dịch vụ song song; complete thuộc PB-012.

## Phối hợp và phụ thuộc

Thay workflow và migration index order; rebase snapshot mới nhất trước tạo migration.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Nhánh `feat/pb-011-single-order`, base main `0e87eeb` (PB-010 PR #24). Dependency đã
merge, không cần chờ PB-013. Commit/push theo yêu cầu người dùng; upstream là nhánh
PB-011, không phải origin/main;
chưa có reviewer/PR nên chưa đánh Done.

- SingleOrders: services/preview/confirm, quyền bác sĩ đang khám, preview gắn
  Visit/version/doctor/input/config 5 phút; transaction, row locks, receipt và snapshot.
- DoctorOrder/JourneyStep thêm số vòng và snapshot; OrderPreview là metadata,
  không đổi nghiệp vụ khi preview/Cancel. Schema chuẩn bị completion fields nullable
  cho PB-012, chưa thêm lệnh hoàn tất.
- Migration `20261113234239_SingleServiceOrder` nối PB-010, preflight 51013,
  Down 51014 bảo vệ dữ liệu; unique pending order và index lookup lịch sử.
- DoctorOrderForm tách khỏi queue: một service → preview → Cancel/confirm;
  receipt chỉ đọc và mở lại sau reload, InService tách khỏi Waiting. Labels sáu locale.
- **Hợp đồng PB-001 được mở rộng:** PreviewOrderInputV2/OrderPreviewV2 và
  ConfirmOrderInputV2 thêm previewId bắt buộc; cập nhật shared/contracts/API docs.
  Caller V2 ba trường cũ nhận 422. Mapping V2 chỉ một node Service trực tiếp;
  mapping legacy nhiều bước không bị đổi.
- [Tài liệu bàn giao](../../../codes/docs/requirements/PB-011-SINGLE-ORDER.md),
  [API tests](../../../codes/tests/api/single-order.test.mjs),
  [browser tests](../../../codes/tests/browser/single-order.spec.ts),
  [migration tests](../../../codes/tests/single-order/Program.cs).
- File chung cần review: Entities.cs, HospitalDb.cs, snapshot, Program.cs,
  DoctorConsultations.cs/DoctorQueue.tsx, shared types/labels, ci-native.ps1.
  Legacy mutation guard hiện có được kiểm thử lại, không bỏ bảo vệ để tái sử dụng.

### Kiểm chứng local ngày 14/11/2026

| Lệnh/kịch bản | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| `node --test tests/api/single-order.test.mjs` | PASS 6/6 | `.local/pb011-api.log`; SQL race/retry/rollback/legacy bypass/config/snapshot |
| `npx playwright test --config playwright.order.config.ts` | PASS 2/2 | `.local/pb011-browser.log`; desktop + Pixel 7 viewport |
| `dotnet run --project tests/single-order/SingleOrder.Tests.csproj -c Release` | PASS 10 assertions | `.local/pb011-migration.log`; SQL Docker local riêng |
| Hồi quy API PB-010 / PB-008 | PASS 5/5 / 7/7 | `.local/pb011-doctor-api.log`, `pb011-confirm-regression.log` |
| Hồi quy core-schema / ticket-number / doctor-accept migration | PASS 79 / 38 / 9 assertions | `.local/pb011-{core-regression,ticket-regression,doctor-migration}.log` |
| Build .NET Release + EF pending-model check | PASS | 0 warning/error, model khớp snapshot |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS | `.local/pb011-{typecheck,lint,build}.log` |
| `npm run test:languages:unit` | PASS 3/3 | `.local/pb011-languages.log` |

Fixture cuối `HospitalAcceptance_1794614357462` (fixture trước
`HospitalAcceptance_1794613576706` được giữ), migration fixture
`HospitalPB011_d7e1f777ad864e64a5d8bd660f641821`. Chỉ dùng SQL Docker loopback riêng;
không ghi demo/online. Các fixture thử trước cũng được giữ lại.
Ảnh local `codes/artifacts/chromium-{desktop,mobile}-pb011.png` đã xem; dữ liệu tổng
hợp, không secrets; chỉ chụp với PB011_CAPTURE, không bắt CI chụp ảnh toàn trang.

Lần API test đầu phát hiện CreatedAt của order mất hậu tố Z sau đọc SQL; đã chuẩn
hóa UTC và test lại 6/6. Migration được sinh lại trước commit để thêm index lookup
lịch sử, rồi kiểm thử trên database mới; không sửa migration đã merge. Chưa chạy
toàn bộ GitHub CI/Windows LocalDB hoặc regression legacy API 23 ca trong phiên này;
CI giữ các gate đó và thêm phase PB-011 riêng. Không cần native Android trong scope.

### Nội dung PR đề xuất

**Tiêu đề:** `[PB-011] Xem trước và xác nhận một dịch vụ bất biến mỗi lần khám`

Bác sĩ đang khám chọn một service, review cấu hình và confirm bằng previewId.
Transaction tạo một order NotCompleted và Service Ready, chuyển InService và nhả
ca phòng; retry không lặp order. Snapshot giữ nguyên sau sửa catalog, API/UI không
cho sửa/hủy/skip qua legacy. Thêm schema/index/rollback guard, API/browser/migration
tests và CI. Hợp đồng confirm thêm previewId, caller phải preview trước. Hoàn tất
dịch vụ/quay về phòng thuộc PB-012; phối hợp migration mới với PB-013/028.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-011, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

