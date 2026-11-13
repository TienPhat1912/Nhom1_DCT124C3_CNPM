# PB-008 — Xác nhận tiếp nhận và mở Journey

## Hành vi

Với `Workflow:PrdV2Enabled=true`, Reception mở yêu cầu V2, chọn phòng có bác sĩ
hoạt động hợp lệ, ghi nhận xác minh và xác nhận. Server tạo ReceptionRecord,
Visit Active/Waiting với ConsultationCount=0, Journey Active, bước khám/quyết toán,
phiếu theo phòng/ngày và grant cho phiên Guest gốc trong **một transaction**.
Audit, notification, counter cấp số và idempotency receipt cùng transaction đó.
Không tạo QR tiếp nhận hay QR kích hoạt cho hồ sơ V2.

Patient đang xem yêu cầu sẽ tự vào Journey sau khi polling/focus thấy VisitId.
URL `#visit=<id>` giữ lượt đã chọn khi reload; API vẫn kiểm tra quyền ở mỗi lần đọc.
Phiếu hiển thị snapshot bệnh nhân, bác sĩ, phòng, ngày và số đã lưu. In lại chỉ đọc
phiếu rồi gọi chức năng in của trình duyệt. Không cấp số mới, không thay bác sĩ hoặc
lấy tên hiện tại từ profile để thay nội dung phiếu.

Phòng đang có ca InConsultation vẫn tiếp nhận thêm Visit Waiting. PB-008 không nhận
bệnh nhân vào khám, không đổi workflow khám/dịch vụ. Các lệnh progress/order/
settlement legacy bị chặn trên Visit V2; phần khám V2 thuộc PB-010 trở đi. Không coi
việc bật tiếp nhận trên môi trường test là hệ thống đã đủ điều kiện phát hành.

## API và hợp đồng

Kế thừa namespace `/api/v2/requests` của PB-006:

- `GET /api/v2/reception/clinics`: chỉ Reception, chỉ phòng thuộc phạm vi có
  Location/Department Active, bác sĩ Role=Doctor + Active + có password hash, đúng
  StaffScope và ClinicDoctor. Trả clinicLocationId, version của ClinicRoom,
  departmentId, nameVi, room, activeDoctor `{id,name}`. Không trả hash hay dùng roster.
- `POST /api/v2/requests/{id}/confirm`: chỉ Reception; bắt buộc Idempotency-Key.
  Chỉ chấp nhận đúng năm trường dưới đây, từ chối trường tác giả/quyền/snapshot hoặc
  trường lặp. Trả `{request,visit,ticket}` theo hợp đồng PB-001 cho bước tiếp nhận;
  capabilities khám chưa triển khai đều false. GET Journey hiện có tiếp tục phục vụ
  màn hình chỉ dẫn; PB-010/021 sẽ triển khai phần đọc/lệnh khám V2 tiếp theo.
- `GET /api/visits/{id}/ticket`: quyền Patient/Guest hoặc Reception trong khoa của
  Visit. Phiếu Captured trả `ExaminationTicketV2` kèm contractVersion=prd-v2; không
  có code/expiresAt. Snapshot phiếu được trả nguyên bản, không qua bộ dịch tự động.
  Phiếu legacy tiếp tục trả hợp đồng cũ và bản dịch tên khoa như trước.
- `GET /api/v2/requests/{id}`: canConfirm chỉ true cho Reception khi Submitted và
  chưa có Visit; đây là gợi ý UI, các guard thực thi luôn được kiểm tra trong POST.

```json
{
  "version": 1,
  "clinicLocationId": "00000000-0000-0000-0000-000000000001",
  "clinicAssignmentVersion": 1,
  "attendeeVerified": true,
  "verificationNote": "Đã đối chiếu trực tiếp người đến khám"
}
```

Không nhận DepartmentId/DoctorId từ client. Khoa lấy từ phòng, bác sĩ lấy từ
ClinicRoom.ActiveDoctorId sau khi đọc lại. Request giữ khoa định tuyến tiếp nhận
gốc để nhân viên tiếp nhận còn tìm được yêu cầu; Visit có khoa khám đã chọn.
Reception phải có quyền cả khoa định tuyến và khoa khám. Replay receipt và xác
nhận lại cũng kiểm tra quyền khoa của Visit, kể cả khi nhân viên đã bị thu hồi
scope sau lần xác nhận đầu.

## Tính nguyên tử và cạnh tranh

CommandBus dùng transaction-owned SQL application lock `hospital:commands` xuyên
tiến trình. Trong transaction, xác nhận đọc lại request, trạng thái Patient, request
chờ khác, Visit Active, ClinicRoom/version, Location/Department, User/StaffScope và
ClinicDoctor. Dùng UPDLOCK/HOLDLOCK trên Patient/phòng/location/khoa/bác sĩ; không
giữ dữ liệu bác sĩ từ lần xem danh sách để quyết định người nhận ca.

TicketNumberAllocator PB-007 vẫn sở hữu khóa và counter phòng/ngày Việt Nam.
Nếu lỗi sau khi cấp số, counter và các entity đều rollback. Có fixture vô hiệu hóa
đích thu ngân để buộc lỗi đúng tại giai đoạn này, sau đó thử lại cùng key thành công.

Hai nhân viên/key khác nhau xác nhận cùng yêu cầu đều nhận cùng Visit/ticket:
người sau thấy ReceptionRecord đã tồn tại và không cấp thêm. Cùng key/body nhận
đúng response đã commit; cùng key/body khác trả idempotencyConflict. Version hoặc
ClinicAssignmentVersion cũ trả conflict; UI tải lại phòng, yêu cầu chọn và xác minh
lại, không tự chấp nhận một bác sĩ mới sau refresh.

Các lỗi chính: 403 forbidden/outOfScope; 409 conflict, requestLocked,
activeVisitExists, pendingRequestExists, clinicUnavailable, doctorUnavailable,
destinationInvalid, requestInvalid; 422 validation/verificationRequired;
503 workflowNotEnabled. Request legacy gửi vào lệnh V2 trả legacyRecord, lệnh confirm
legacy gửi request V2 trả legacyCommandDisabled. Backend xác thực quyền và dữ liệu,
không dựa vào nút bị ẩn/disabled.

## Guest, lịch sử và cấu hình

Guest chỉ có grant cho SessionId gốc với hạn dùng của session; Account đọc theo
PatientId và không cần grant. Guest khác kể cả cùng PatientId nhưng chưa có grant
không được đọc Visit/ticket. Không cấp quyền dựa vào việc biết số phiếu hoặc URL.
Session gốc hết hạn phải dùng recovery đã xác minh, không kéo dài hạn chỉ vì confirm.

Entry và redeem/link phiếu cũ giữ kiểm tra quyền hiện có, không tạo thêm Visit.
Hồ sơ V2 không dùng refresh-qr legacy; API này trả 410. Reissue phiếu V2 sau xác minh
chỉ ghi audit, không tạo QR/phiếu/số mới. Reception có mục hồ sơ cũ riêng; lịch sử
request legacy và phiếu H- vẫn dùng hợp đồng cũ. Không có migration trong PB-008.

PB-005 chưa có trên nhánh triển khai này. Công cụ tiếp nhận đọc các bảng PB-004
thật, không gọi endpoint quản trị chưa tồn tại. Demo mới có phân công seed sẵn;
database cũ chưa cấu hình trả danh sách phòng trống. PB-005 cần được merge và kiểm
thử khóa đổi phân công khi có Visit Active trước khi merge/bật luồng chung. Không
import roster hoặc tự chọn một bác sĩ để vượt điều kiện này.

## Kiểm chứng

Chạy từ `codes/` với SQL Server local có quyền tạo database và schema:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost
powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost -Port 5299 -LegacyOnly
npm.cmd run typecheck
npm.cmd run lint
```

Runner build web/publish .NET vào thư mục artifact mới, khởi động API local ở chế độ
test, tạo database `HospitalAcceptance_<timestamp>` mới, chạy test và dừng đúng tiến
trình đã tạo. Database/artifact được giữ để đối chiếu. Không lấy connection string
hay mật khẩu ứng dụng, không deploy lên môi trường thật. Có thể dùng instance
LocalDB/named instance local. SQL fixture chỉ cho phép tên database acceptance và
server local. `-LegacyOnly` tắt V2 và chạy bộ API hồi quy cũ trên database mới riêng.

Bộ kiểm thử PB-008 gồm:

- API: hai Reception cạnh tranh (Account/Guest), replay/mismatched-key, grant và
  truy cập trái quyền, snapshot/in lại giữ số, không tạo QR; rollback mọi entity,
  notification/audit/receipt và counter sau lỗi; version, xác minh, schema input,
  bác sĩ bị khóa, scope, request bị rút, xung đột Visit Active/request legacy và
  replay sau thu hồi scope khoa khám; phòng bận vẫn cấp phiếu chờ tiếp theo.
- Playwright desktop/mobile viewport: Patient gửi form thật → Reception chọn
  phòng/xác minh/confirm → in lại → Patient tự mở Journey không redeem → reload
  vẫn giữ Visit, ngày/số phiếu và tiến độ. Browser kiểm tra lệnh in, không kiểm tra
  máy in vật lý hoặc native Android.
- Hồi quy PB-006: API và browser, nguyên văn mô tả/ngôn ngữ, quyền và request cũ.
- Hồi quy API legacy khi tắt V2: tiếp nhận/QR, khám/dịch vụ, công bố, quyết toán,
  Guest recovery và truy cập lịch sử.

CI `scripts/test/ci-native.ps1` chạy API và browser PB-008 trong giai đoạn bật V2,
trên instance SQL riêng của CI. Những thay đổi ngoài file chính phục vụ phân tách
V2/legacy, hợp đồng đọc, test và tài liệu; không sửa PRD hay sáu quyết định nghiệp vụ.
