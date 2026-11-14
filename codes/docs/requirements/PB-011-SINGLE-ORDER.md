# PB-011 — Một chỉ định dịch vụ mỗi lần khám

## Luồng và phạm vi

Với `Workflow:PrdV2Enabled=true`, Doctor đang phụ trách ca InConsultation chọn một
dịch vụ, ghi chú, xem trước rồi xác nhận. Cancel trước confirm chỉ bỏ preview khỏi
giao diện, không đổi Visit/Journey hoặc tạo DoctorOrder.

Confirm tạo đúng một order NotCompleted, hoàn tất bước Consultation hoặc
ReturnConsultation đang InProgress, tạo Service Ready ở đích snapshot, chuyển Visit
InService và tăng WorkRevision. Visit/Journey vẫn Active, bác sĩ/phòng/số phiếu giữ
nguyên. Service trở thành currentStep, ca cũ không còn chiếm phòng hoặc danh sách
Waiting, bác sĩ nhận người khác được. Mục InService riêng chỉ để mở lại chỉ định
đã xác nhận ở chế độ đọc, kể cả sau reload.

Không triển khai complete service, kết quả chuyên môn hoặc tự quay về phòng;
PB-012 thực hiện order/service Completed → ReturnConsultation Ready → Waiting
nguyên tử. Không cho chỉ định tiếp trước khi bác sĩ nhận lại ca. Các capability
hoàn tất dịch vụ/khám/quyết toán chưa triển khai vẫn false.

## Thay đổi hợp đồng PB-001

Hợp đồng confirm cũ chỉ có version/serviceId/note nên không chứng minh được cấu
hình đã review. PB-011 bổ sung PreviewOrderInputV2 và OrderPreviewV2;
**ConfirmOrderInputV2 thêm previewId bắt buộc**. Shared types, contract fixtures,
API docs và client được cập nhật cùng thay đổi này. Các caller gửi ba trường cũ
vào endpoint V2 nhận 422; endpoint legacy giữ hợp đồng cũ và chặn ghi trên Visit V2.

| Endpoint `/api/v2` | Input/output |
|---|---|
| GET `/order-services` | Doctor đọc các service Active `{id,code,nameVi}`; preview kiểm tra cấu hình đầy đủ |
| POST `/visits/{id}/orders/preview` | `{version,serviceId,note}` → OrderPreviewV2 |
| POST `/visits/{id}/orders` | `{version,serviceId,note,previewId}` → VisitV2 |
| GET `/visits/{id}` | orders có snapshot, currentStep Service và canConfirmOrder tính từ quyền/trạng thái |
| GET `/clinics/{id}/queue` | Waiting/current như PB-010; thêm `inService[]` riêng, không trộn vào Waiting |

Cả hai POST yêu cầu Idempotency-Key, chỉ Doctor đúng Visit/phòng/phân công còn dùng
được. Kiểm tra quyền trước receipt replay và trong transaction. JSON yêu cầu đúng
allowlist, từ chối trường lạ/lặp hoặc sai kiểu; không nhận actor/status/snapshot.
Note được trim, tối đa 500 ký tự theo validation hiện có.

## Preview và cấu hình

OrderPreview lưu VisitId, DoctorId, VisitVersion, ServiceId, note chuẩn hóa,
ConfigurationHash và ExpiresAt (5 phút UTC). PreviewId là navigation/confirmation
reference, không cấp quyền. Preview và receipt là metadata; không tạo order hoặc
thay version nghiệp vụ. Retry preview cùng key có thể trả cùng preview đã hết hạn;
client phải tạo preview mới trước confirm.

Hash bao gồm toàn bộ service, location, department, mapping và template Việt đã
đọc (ID/version/thuộc tính/nội dung). Confirm so sánh lại hash, input và người tạo,
Visit/version, hạn dùng. Đổi service/note/Visit/doctor hoặc config sau preview không
được xác nhận. Các lỗi 409 làm UI bỏ preview và yêu cầu xem lại; lỗi mạng/5xx giữ
preview và key để retry. Hủy không xóa metadata preview đã lưu, metadata tự hết hạn.

Service/Location/Department phải Active và cùng khoa, mapping published mới nhất
phải có đúng **một node Service trực tiếp**, không phụ thuộc node khác, khớp
HospitalService.LocationId; cần template vi published. Mapping legacy nhiều bước/
IntermediatePayment không được dùng cho V2, vẫn giữ nguyên ở luồng legacy. V2 theo
PB-001 phải có một Service Ready ngay sau confirm. ReturnRequired legacy không
quyết định có khám lại trong V2; PB-012 luôn đưa về phòng/bác sĩ cũ.

CommandBus dùng SQL app lock và transaction xuyên process. Capture giữ UPDLOCK/
HOLDLOCK trên các hàng/range cấu hình đến commit, bao gồm cập nhật ngoài CommandBus.
Hai confirm/key khác nhau chỉ một thành công, key còn lại bị conflict. Cùng key/input
replay nguyên VisitV2, không tạo order/step/audit/notification lần nữa; quyền vẫn
được kiểm tra. Lỗi persist rollback toàn bộ Visit, order, steps, dependency,
WorkRevision, audit/notification và receipt.

## Dữ liệu và bất biến

- DoctorOrder thêm ConsultationNumber nullable; ServiceSnapshot,
  DestinationSnapshot và OrderedBySnapshot JSON nullable. Legacy giữ null và các
  status Ordered/Resolved/Cancelled gốc. V2 dùng NotCompleted/Completed và số vòng > 0.
- Snapshot service code/name, nơi làm dịch vụ, bác sĩ và note được lưu khi confirm.
  Sửa catalog/địa điểm sau đó không viết lại order/currentStep destination lịch sử.
- CompletedById/CompletedAt nullable chuẩn bị cho PB-012, chưa có lệnh complete.
  JourneyStep.ConsultationNumber giữ số vòng đã thực hiện, kể cả khi bước hoàn tất.
- Unique filtered `UX_Orders_OneNotCompletedPerVisit` bảo vệ một order chưa xong.
  Index `(VisitId,CreatedAt)` giữ đường tra cứu lịch sử khi thay index cũ.
- Endpoint legacy update/cancel/progress/skip/queue có guard Visit V2 hiện có:
  trả 410. Doctor UI V2 không có edit/cancel sau confirm. Không triển khai PUT/DELETE
  V2 để sửa/hủy order. Service UI legacy không hiện canProgress cho Visit V2.
- Timestamp CreatedAt của order chuẩn hóa UTC cả POST/replay/GET, tránh khác chuỗi
  `Z` sau khi đọc lại datetime2 từ SQL.

## Migration và rollback

`20261113234239_SingleServiceOrder` nối PB-010 `20261113224433_DoctorConsultation`.
Up preflight SQL 51013 nếu dữ liệu đã có nhiều NotCompleted/Visit; không xóa hoặc
đoán trạng thái. Thêm cột nullable, bảng preview, FK/check/index; giữ nguyên ID,
note/status/mapping và giá trị lịch sử legacy.

Down từ chối SQL 51014 nếu có order hoặc step chứa ConsultationNumber. Khi đó giữ
schema, rollback ứng dụng; không xóa lịch sử để ép Down. Khi chưa có dữ liệu V2 mới,
Down/Up được test và giữ legacy orders. Dừng ghi khi migration, lấy snapshot mới
nhất và phối hợp với PB-013/028. Không sửa migration PB-010 đã merge.

## Kiểm chứng local ngày 14/11/2026

Các lệnh từ `codes/`, dùng SQL Docker loopback và database acceptance mới riêng:

| Lệnh | Kết quả |
|---|---|
| `node --test tests/api/single-order.test.mjs` | PASS 6 test |
| `npx playwright test --config playwright.order.config.ts` | PASS 2 test desktop/Pixel 7 viewport |
| `dotnet run --project tests/single-order/SingleOrder.Tests.csproj -c Release` | PASS 10 assertions, PB011_SQL_CONNECTION local |
| Hồi quy `tests/api/doctor-accept.test.mjs` / `confirm-reception.test.mjs` | PASS 5 / 7 test |
| Hồi quy core-schema / ticket-number / doctor-accept migration console | PASS 79 / 38 / 9 assertions |
| .NET Release build, EF pending-model check | PASS, model/snapshot khớp |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS |
| `npm run test:languages:unit` | PASS 3 test |

API bao phủ preview không đổi nghiệp vụ, role/ownership/allowlist, thiếu/sai preview,
single-order race, replay, SQL unique độc lập, bước hiện tại Service Ready, phòng
nhận người khác, bypass legacy 410, version/config/expiry, snapshot sau sửa catalog,
lỗi ghi rollback rồi retry, Waiting/InService không chỉ định tiếp.
Browser thao tác form thật: preview, Cancel, đổi config sau preview bị từ chối,
preview lại/confirm, receipt chỉ đọc, reload mở lại order và nhận người tiếp theo.
Migration thử trên schema PB-010 với legacy orders, preflight xung đột, bảo toàn
ID/note/status, unique SQL và Down có dữ liệu bị chặn.

Logs ignored `.local/pb011-{api,browser,migration,doctor-api,confirm-regression,
core-regression,ticket-regression,doctor-migration,typecheck,lint,build,languages}.log`.
Ảnh `artifacts/chromium-{desktop,mobile}-pb011.png` chụp tùy chọn PB011_CAPTURE=1.
CI có migration test, database/process riêng cho API/browser PB-011, giữ/khôi phục
biến môi trường và kết nối của các suite trước. Chưa chạy CI GitHub/LocalDB trong
phiên này; viewport mobile không phải native. Không dùng database demo/online.

## Bàn giao PB-012

PB-012 phải kiểm tra version Visit/order, đúng Service/khoa/snapshot, hoàn tất
order/service và tạo ReturnConsultation ở phòng gốc trước khi đánh giá bước tiếp
theo. Không giải quyết bằng progress/skip legacy hoặc đổi bác sĩ/phiếu. Giữ nguyên
snapshot chỉ định và consultationNumber, ghi người/thời điểm hoàn tất; cập nhật
DTO completedBy/capabilities tại thời điểm triển khai lệnh complete thực tế.
