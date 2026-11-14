# PB-012 Hoàn tất dịch vụ và tự trở lại hàng chờ phòng cũ

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/test local hoàn tất; chờ review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Dịch vụ |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-011](./PB-011-single-order.md) |
| Đối chiếu kế hoạch | P3a / QD-03 |
| Branch gợi ý | `feat/pb-012-service-return` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Danh sách và nút hoàn tất cho Service; lệnh complete cập nhật order và bước quay lại.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Journeys/JourneyEndpoints.cs, Workflow.cs; apps/web/src/StaffClinical.tsx; tests/api/.

## Tiêu chí chấp nhận

- [x] Chỉ Service đúng phạm vi hoàn tất; UI có Chưa hoàn tất/Hoàn tất, không nhập kết quả xét nghiệm/chụp chiếu.
- [x] Order xong, Visit Waiting, đích phòng cũ và hàng chờ bác sĩ cũ thay đổi nguyên tử; giữ số phiếu, không thêm xác nhận đã tới phòng.
- [x] Không tự chuyển InConsultation hoặc chiếm ca khác; muốn chỉ định tiếp phải được bác sĩ nhận lại. Retry hoàn tất không tạo bước quay lại trùng.

## Kiểm chứng bắt buộc

API scope/retry; test A đi dịch vụ → bác sĩ khám B → A xong chỉ vào hàng chờ; browser Service và Doctor; test hai vòng dịch vụ tuần tự.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không thêm trạng thái đang lấy mẫu bắt buộc cho mọi loại dịch vụ; không lưu kết quả chuyên môn.

## Phối hợp và phụ thuộc

Dùng lại component theo vai trò; tránh đổi giao diện bác sĩ/thu ngân ngoài phần cần thiết.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai trên nhánh hiện có `AnhBao_PB012_service_return`, base `3febc1d`
(merge PB-011 PR #25; PB-010 PR #24). Dependency đã có trong lịch sử checkout.
PB-012 chưa có PR hay reviewer nên không đánh Done/merge.

- [Hợp đồng và hướng dẫn kiểm chứng PB-012](../../../codes/docs/requirements/PB-012-SERVICE-RETURN.md).
- [API tests](../../../codes/tests/api/service-return.test.mjs),
  [browser tests](../../../codes/tests/browser/service-return.spec.ts),
  [runner SQL local riêng](../../../codes/tests/service-return/run.ps1).
- Backend thêm ServiceReturns, completion transaction và snapshot return trong
  Workflow; DoctorConsultations trả capabilities/provenance và chuẩn hóa UTC.
- Web ServiceOrders hiển thị hai danh sách và nút hoàn tất, nhãn sáu locale;
  App/StaffClinical mở workspace Service V2 trực tiếp.
- Shared thêm ServiceOrderWorkItemV2; không đổi input complete đã chốt PB-001;
  không có migration mới. CI thêm API/browser PB-012 trên fixture riêng.

### Kiểm chứng local ngày 14/11/2026

| Lệnh/kịch bản (từ codes/) | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/service-return/run.ps1 -SqlServer localhost -Regression -Capture` | API PB-012 6/6; browser 2/2; hồi quy PB-011 6/6, PB-010 5/5, PB-008 7/7 | `.local/pb012-acceptance.log`; mỗi suite API có database riêng |
| `powershell -NoProfile -ExecutionPolicy Bypass -File tests/service-return/run.ps1` (chạy chốt) | PASS; runner exit 0; API 6/6, browser 2/2 | `.local/pb012-final.log`, fixture `HospitalAcceptance_1794622289679` |
| `node --test tests/api/service-return.test.mjs` (qua runner) | PASS 6/6 | Scope/replay sau thu hồi quyền, strict payload/version, A/B, hai vòng, race/retry, rollback, guard trạng thái, snapshot/provenance |
| `npx playwright test --config playwright.service.config.ts` (qua runner) | PASS 2/2 | Chromium desktop và Pixel 7 viewport; Service + Doctor, reload lịch sử và hai vòng |
| `dotnet build backend/Hospital.Api/Hospital.Api.csproj -c Release --no-restore` | PASS, 0 warning/error | Runner cũng publish Release thành công; không có thay đổi schema |
| `npm run typecheck` | PASS | Web/mobile/shared và contracts |
| `npm run lint` | PASS | Không có warning ESLint |
| `npm run build` | PASS | Có cảnh báo bundle web trên 500 kB, không lỗi build |
| `npm run test:languages:unit` | PASS 3/3 | Nhãn/dictionary sáu locale |
| `git diff --check`; parser PowerShell runner/CI | PASS | Không lỗi whitespace/cú pháp |

Fixture acceptance `HospitalAcceptance_1794622154650`; hồi quy PB-011
`HospitalAcceptance_1794622204014`, PB-010 `HospitalAcceptance_1794622216884`, PB-008
`HospitalAcceptance_1794622226915`. Chỉ dùng SQL Server localhost, Windows
authentication, giữ lại fixture; API process dừng sau test. Các fixture thử trước
cũng được giữ. Ảnh local `codes/artifacts/chromium-{desktop,mobile}-pb012-{service,doctor}.png`
đã xem, dữ liệu tổng hợp. Không ghi database demo/online.

Môi trường local: Windows, .NET SDK 10.0.401, Node 24.19.0 (manifest yêu cầu Node 22;
CI dùng toolchain repo). Chưa chạy toàn bộ GitHub CI, default legacy API/browser,
native Android hoặc migration regression trong phiên này; PB-012 không đổi schema
hay mobile. Build có cảnh báo chunk size và test có warning màu console của Node.

Test rollback ban đầu phát hiện timestamp bước khám mất UTC khi đọc SQL: đã chuẩn
hóa và chạy lại. Test thu hồi quyền đã sửa fixture để lấy đúng scope khoa dịch vụ
thay vì lấy scope bất kỳ. Không bỏ assertion hoặc nới guard để test qua.

### Nội dung PR đề xuất

**Tiêu đề:** `[PB-012] Hoàn tất dịch vụ và tự trở lại hàng chờ phòng cũ`

Service đúng khoa có danh sách Chưa hoàn tất/Hoàn tất và nút hoàn tất; transaction
cập nhật order/Service, tạo ReturnConsultation Ready và chuyển Visit Waiting về
phòng/bác sĩ gốc, giữ số phiếu. Retry không lặp return/audit/notification, không
chiếm ca khác; bác sĩ phải nhận lại trước khi chỉ định tiếp. Thêm provenance/UTC,
API/browser/race/rollback tests, runner riêng và CI; không có migration. Chi tiết
và lệnh kiểm chứng ở tài liệu bàn giao PB-012 liên kết phía trên.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-012, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

