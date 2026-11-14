# PB-013 — Danh mục lâm sàng và mẫu kết quả Việt

Admin có tab **Danh mục lâm sàng** để quản lý Triệu chứng, Dấu hiệu, Chẩn đoán và
Mẫu kết quả Việt. Từng nhóm hỗ trợ thêm, sửa tên/nội dung, ngừng dùng và dùng lại,
tìm theo mã/tên, phân trang, hủy trước khi lưu và tải lại khi phiên bản đã thay đổi.
Doctor đọc các mục đang dùng qua API riêng. Không có quy tắc liên kết triệu chứng
với chẩn đoán, tự suy ra bệnh hay công bố kết quả bệnh nhân trong task này.

## API và DTO

Các route dưới đây thuộc `/api/v2`; `kind` là `symptoms`, `signs`, `diagnoses`,
hoặc `templates`. Được bật cùng `Workflow:PrdV2Enabled`; khi tắt trả 503 và tab
Admin không xuất hiện.

| Route | Quyền và kết quả |
|---|---|
| GET `/admin/clinical-catalog/{kind}?search=&offset=0` | Admin; cả mục đang dùng/ngừng dùng |
| POST `/admin/clinical-catalog/{kind}` | Admin; tạo mục, version đầu tiên là 1 |
| PUT `/admin/clinical-catalog/{kind}/{id}` | Admin; sửa mục đúng nhóm và version |
| GET `/clinical-catalog/{kind}?search=&offset=0` | Doctor; chỉ Active, lọc trước phân trang |

GET trả `ClinicalCatalogPageV2`: `{ items, offset, hasMore }`. Tối đa 100 mục mỗi
trang, sắp theo code rồi id; offset không âm, search tối đa 100 ký tự.
Entry chứa id/version/createdAt UTC, code/nameVi/kind/active/isDemo. Template thêm
language `vi`, diagnosisTemplate/explanationTemplate/instructionsTemplate.

POST/PUT nhận đúng `ClinicalCatalogInputV2`: `{ version, code, nameVi, active }`.
POST yêu cầu version 0; PUT yêu cầu version hiện tại > 0. Mẫu nhận thêm chính xác
`language`, `diagnosisTemplate`, `explanationTemplate`, `instructionsTemplate`.
`Idempotency-Key` bắt buộc. Không nhận id/IsDemo/kind hoặc trường kết quả bệnh nhân.
Không có DELETE: dùng `active: false` để ngừng dùng, giữ FK và lịch sử.

- Code được trim/viết hoa, 2–40 ký tự ASCII, bắt đầu A–Z, phần còn lại chỉ A–Z,
  0–9, `_`, `-`; unique trong bảng. Triệu chứng và dấu hiệu dùng chung namespace
  code. Code và phân loại không thay sau tạo; muốn mã khác cần tạo mục khác.
- NameVi trim, 2–200 ký tự. Template tiếng Việt: chẩn đoán 1–4000, giải thích
  0–4000, hướng dẫn 1–6000 ký tự sau trim.
- Chỉ hỗ trợ `{{symptoms}}`, `{{signs}}`, `{{diagnoses}}` để PB-014 chèn lựa chọn
  rõ ràng của bác sĩ; diagnosisTemplate phải chứa `{{diagnoses}}`. Từ chối biến
  lạ, ngoặc thiếu, nguồn khác `vi` và chẩn đoán tĩnh thiếu lựa chọn. PB-013 không
  tự render hay xác nhận một kết quả lâm sàng.
- Mục Admin tạo mặc định IsDemo false; Admin phải chủ động chọn trạng thái sử
  dụng. IsDemo của seed không thể đổi qua payload hoặc biến mất khi chỉnh sửa.
- Sai role trả 403; sai nhóm/id trả 404; validation trả 422; version cũ trả
  `409 conflict`; đổi code trả `409 catalogCodeImmutable`; code trùng trả
  `409 duplicate`; cùng key/body trả receipt cũ, key cũ/body khác trả
  `409 idempotencyConflict`.
- Mỗi cập nhật, kể cả không đổi nội dung, tạo một version mới. CommandBus commit
  cấu hình, audit Admin (before/after), receipt trong một transaction. Race sửa
  cùng version chỉ một bên thành công; lỗi audit rollback cấu hình và receipt.

## Schema và lịch sử

Migration `20261114023849_ClinicalCatalog` nối `SingleServiceOrder`, chỉ thêm sáu
bảng, không đổi nội dung hay suy diễn kết quả từ SummaryVersion cũ:

| Bảng | Vai trò |
|---|---|
| SymptomCatalog | Code/nameVi, Kind Symptom hoặc Sign, Active/IsDemo/version |
| DiagnosisCatalog | Code/nameVi, Active/IsDemo/version |
| ClinicalTemplate | Mẫu nội dung nguồn Việt, Active/IsDemo/version |
| ClinicalRecord | Một record/Visit; nội dung Việt, tác giả, thời điểm xác nhận/công bố, TemplateId/version và toàn bộ TemplateSnapshot |
| ClinicalSymptom | Link record–symptom/sign; snapshot code/name/kind/version/IsDemo |
| ClinicalDiagnosis | Link record–diagnosis; snapshot code/name/version/IsDemo |

FK dùng Restrict, không cascade xóa lịch sử. FK ghép SymptomCatalogId/Kind chặn
link sai phân loại; unique record/catalog chặn lựa chọn trùng; unique VisitId
chặn nhiều kết quả cấu trúc cho cùng Visit. Check constraints bảo vệ code, nguồn
`vi`, version snapshot dương, JSON template và nội dung bắt buộc.

Tên/nội dung mẫu đã xác nhận phải được đọc từ snapshot trên record/link, không
join tên hiện tại để thay lịch sử. Test SQL và C# tạo fixture lịch sử tổng hợp,
đổi tên/ngừng dùng danh mục/mẫu, rồi so toàn bộ record/link trước và sau.

PB-014 sẽ xác thực các lựa chọn Active/version, ít nhất một chẩn đoán, snapshot,
author và timestamps từ server trong giao dịch xác nhận kết thúc khám. PB-013
chỉ chuẩn bị schema; không mở API ghi/đọc kết quả cấu trúc hay quyền xem kết quả
cho Admin. Luồng legacy chưa được thay bằng luồng xác nhận của PB-014.

Down chỉ cho phép khi cả sáu bảng mới trống; nếu có bất kỳ cấu hình/kết quả nào,
kể cả demo, trả SQL 51018 và giữ nguyên migration/dữ liệu. Muốn downgrade có dữ
liệu cần xuất/sao lưu và đối soát chủ động; migration không tự xóa dữ liệu.

## Fixture demo

ClinicalCatalogSeed chỉ chạy khi **Demo:Enabled và Workflow:PrdV2Enabled đều true**,
sau migration mới nhất. Mỗi nhóm có một mục minh họa với IsDemo true và mã
DEMO_*. Không có tên bệnh hay lời khuyên điều trị được suy ra từ fixture.
Mẫu demo nêu rõ chưa được bệnh viện duyệt và không dùng làm hướng dẫn chăm sóc.
UI hiển thị DEMO trong danh sách và cảnh báo khi mở mục demo.

Seed insert-only, có SQL application lock để tránh chạy trùng; khởi động lại
không đổi id/version/nội dung hoặc bật lại mục Admin đã ngừng dùng. Không thêm
fixture trong migration và không seed vào cấu hình production thông thường.

## Kiểm chứng và CI

Chạy từ `codes/`, với SQL Server localhost/LocalDB và Windows authentication:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/clinical-catalog/run.ps1 -SqlServer localhost -Regression -Capture
npm run typecheck
npm run lint
npm run test:languages:unit
dotnet ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build
```

Runner build web/publish Release; migration test tạo database `HospitalPB013_*`
riêng cho schema cũ và schema mới; API/browser dùng `HospitalAcceptance_<timestamp>`
mới. `-Regression` tạo fixture riêng cho từng suite PB-012/011/010/008. Giữ database
để kiểm tra, dừng API process và khôi phục biến môi trường sau khi chạy.
`-Capture` lưu ảnh synthetic ở `artifacts/*-pb013-{catalog,template}.png`.

API test kiểm tra role/CRUD/validation/version, active-only, phân trang, demo,
template placeholders, duplicate/race/retry/audit, rollback và snapshot lịch sử.
Browser chạy Admin trên Chromium desktop/Pixel 7 viewport, kiểm tra cả bốn nhóm,
hủy trước lưu, lỗi template, phiên bản cũ/tải lại và cảnh báo demo.
Migration test kiểm tra schema mới/cũ, giữ SummaryVersion, không backfill giả,
FK/check/unique, seed production/demo/idempotence và downgrade có bảo vệ.

CI thêm migration test và phase API/browser PB-013 trên database riêng. Không có
package mới. Kết quả local, fixture và giới hạn môi trường ghi trong task card.

## Nội dung PR đề xuất

**Tiêu đề:** `[PB-013] Danh mục lâm sàng và mẫu kết quả Việt có phiên bản`

Thêm danh mục triệu chứng/dấu hiệu/chẩn đoán và mẫu Việt cho Admin, API active-only
cho Doctor. Schema kết quả cấu trúc lưu snapshot và FK riêng để đổi/ngừng dùng
danh mục không thay lịch sử. Config có validation, version, idempotency và audit;
fixture demo được đánh dấu, không suy ra chẩn đoán. Bổ sung migration mới/cũ,
API/browser tests và CI; xác nhận/công bố kết quả bệnh nhân tiếp tục ở PB-014.
