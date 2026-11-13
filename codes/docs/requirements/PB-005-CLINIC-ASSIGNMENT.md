# PB-005 Phân công bác sĩ theo phòng khám

## Sử dụng trên web

Trong Quản trị bệnh viện, mở **Phân công phòng khám**. Tìm phòng theo tên hoặc số
phòng, chọn bác sĩ thuộc phòng, xem lại và xác nhận lưu. Sau đó chọn bác sĩ đang
hoạt động từ các thành viên đã lưu, xem lại và xác nhận. Màn hình hiển thị bác sĩ
hiện tại, số Visit Active liên quan, tình trạng tài khoản và điều kiện thay đổi.
Nhãn hỗ trợ đủ sáu ngôn ngữ của ứng dụng.

Danh sách phòng lấy từ Location trong database. Admin có thể tạo địa điểm trong
tab Địa điểm trước khi phân công. Với hồ sơ Excel, cấp email thật, mật khẩu và
phạm vi khoa trong Nhân sự trước khi thêm vào phòng. Mỗi bác sĩ thuộc tối đa một
phòng, một phòng có nhiều thành viên và một lựa chọn bác sĩ hoạt động.

Khi cần chuyển phòng sau khi các Visit đã đóng, bỏ chọn bác sĩ hoạt động, xóa
thành viên ở phòng cũ rồi thêm vào phòng mới. Khi xuất hiện lỗi phiên bản, tải lại,
xem lại lựa chọn và xác nhận với dữ liệu mới. Form giữ lỗi và lựa chọn để người
dùng xử lý. Retry sau mất phản hồi giữ cùng key và payload bằng useMutation chung.

## API

Mọi endpoint dưới đây yêu cầu phiên Admin. Nhóm quản trị này dùng được khi
`Workflow:PrdV2Enabled=false` để cấu hình trước khi bật luồng tiếp nhận V2.

| HTTP | Đường dẫn | Dữ liệu |
|---|---|---|
| GET | `/api/v2/admin/clinics` | `AdminClinicAssignment[]`, gồm các Location để cấu hình |
| GET | `/api/v2/admin/clinics/{id}/assignment` | `AdminClinicAssignment` của Location đã tồn tại |
| PUT | `/api/v2/admin/clinics/{id}/doctors` | `{version, doctorIds}` → phân công sau lưu |
| PUT | `/api/v2/admin/clinics/{id}/active-doctor` | `{version, doctorId}` → phân công sau lưu |

`AdminClinicAssignment` mở rộng ClinicAssignmentV2 với departmentId, nameVi, room,
available và activeDoctorUsable. Phân công mới có version 0. Lần thay đổi đầu tạo
ClinicRoom version 1. Sửa thành viên hoặc bác sĩ hoạt động đều tăng cùng phiên bản
phòng. Gửi cùng dữ liệu với key mới và version hiện tại là thao tác giữ nguyên.

`doctorId=null` bỏ lựa chọn đang hoạt động. `doctorIds` là tập thành viên thay thế,
tối đa 500 ID khác nhau. Bác sĩ đang hoạt động phải nằm trong tập thành viên.
Trường version, doctorId/doctorIds phải hiện diện đúng kiểu. Trường lạ, trùng tên,
GUID rỗng, mảng trùng ID và version âm/lẻ bị từ chối bằng 422 validation.

Mỗi PUT yêu cầu Idempotency-Key 8–100 ký tự. Receipt gắn hợp đồng prd-v2, Admin,
tên lệnh và phòng. Cùng key/payload trả lại snapshot đã commit. Đổi payload trên
cùng key trả 409 idempotencyConflict. Key mới/version cũ trả 409 conflict.

## Giao dịch, quyền và dữ liệu cũ

CommandBus giữ transaction-owned SQL application lock chung với tiếp nhận,
cập nhật tài khoản và cấu hình. Trong giao dịch, API đọc lại quyền Admin, khóa
ClinicRoom bằng UPDLOCK/HOLDLOCK, kiểm tra version, Visit, vai trò, thông tin đăng
nhập, phạm vi khoa và thành viên. Ràng buộc PB-004 bảo vệ duy nhất DoctorId trong
ClinicDoctor, duy nhất ClinicLocationId trong ClinicRoom và FK bác sĩ hoạt động
đúng thành viên phòng. Hai Admin cùng sửa một phiên bản chỉ có một thay đổi thành
công. Hai phòng cùng nhận một bác sĩ chỉ có một phân công thành công.

Mọi Visit có Status Active đều khóa thay đổi liên quan, gồm Waiting,
InConsultation, InService và Completed đang chờ quyết toán. Guard tính cả phòng
trên Visit, đích Consultation của dữ liệu legacy và bác sĩ đang phụ trách Visit
cũ thiếu ClinicLocationId. Thêm bác sĩ có Visit Active ở nơi khác cũng bị chặn.
Kết quả khám hoàn tất vẫn giữ khóa cho tới khi Visit đóng.

Admin có thể khóa tài khoản bác sĩ ngay khi còn Visit Active. Các session bị thu
hồi, tiếp nhận loại phòng có bác sĩ bị khóa và bác sĩ mất quyền truy cập ngay.
ClinicRoom.ActiveDoctorId, DoctorId của Visit và snapshot phiếu được giữ nguyên.
Sau khi các Visit đóng, Admin có thể chọn thành viên hợp lệ khác. Việc đổi vai trò
Doctor hoặc bỏ phạm vi khoa đang gắn phòng yêu cầu xử lý thành viên trước. Đổi khoa
của địa điểm yêu cầu xử lý các phân công hiện có. Visit Active bảo vệ cả thay đổi
khoa và việc ngừng hoạt động phòng.

GET hồ sơ nhân viên và liên kết phòng của bác sĩ trong directory đọc ClinicDoctor
trong database. Doctor đọc chi tiết/danh sách Visit Active phải đúng DoctorId và
phân công phòng đang hoạt động. Visit đã đóng giữ quyền lịch sử của bác sĩ phụ
trách theo phạm vi khoa. Luồng tiếp nhận legacy tiếp tục dùng hợp đồng cũ.

Lưu phân công và audit diễn ra cùng giao dịch với receipt. Các event
ClinicDoctorsConfigured và ClinicActiveDoctorConfigured có ActorId từ session,
CreatedAt UTC, phòng và giá trị before/after. Admin đọc qua `/api/admin/audit`.
Schema dùng lại ClinicDoctor, ClinicRoom và AuditEvent của PB-004. Roster tiếp tục
nhập bổ sung tài khoản/danh mục, các lựa chọn phân công được giữ trong database.

Các lỗi chính gồm 401 sessionRequired/sessionExpired, 403 forbidden/outOfScope,
404 notFound, 422 validation/doctorNotInClinic và 409 conflict,
idempotencyConflict, clinicUnavailable, doctorUnavailable, clinicHasActiveVisits,
doctorAlreadyAssigned, activeDoctorMustBeCleared, configurationInUse.

## Kiểm chứng

Chạy từ `codes/` với SQL Server local và quyền tạo database kiểm thử.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/catalog/pb005.ps1 -SqlServer localhost
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:languages:unit
npm.cmd run test:directory:unit
```

Runner tạo database HospitalAcceptance mới, build web/publish API, chạy 9 ca API,
2 ca Playwright desktop/mobile viewport, restart rồi đối chiếu cấu hình. Sau đó
xóa dấu nhập Catalog trong fixture, restart để buộc nhập lại roster và đối chiếu
lần nữa. Kiểm tra bảo toàn thành viên, lựa chọn, phiên bản, tài khoản, phạm vi,
Visit và audit. Database/artifact được giữ để đối chiếu và tiến trình test được
dừng trong finally. CI native gọi cùng runner với instance SQL riêng.

API kiểm tra quyền của mọi vai trò/Guest, schema input, tài khoản/khoa/thành viên,
hai Admin đồng thời, hai phòng cạnh tranh một bác sĩ, replay/audit, version,
cả bốn trạng thái Active, Visit legacy, khóa bảo mật, dữ liệu roster đã cấp tài
khoản và cạnh tranh với lệnh xác nhận tiếp nhận. Browser đi qua form thật, xem
lại/hủy/lưu, reload, lỗi version cũ và Visit mở sau bước xem lại, rồi xác minh
nút bị khóa ở cả hai viewport.

Ảnh `assignment-saved.png` và `assignment-locked.png` nằm trong từng thư mục test
tại `artifacts/pb005-browser-results`. Báo cáo HTML nằm ở
`artifacts/pb005-playwright-report/index.html`.

Hồi quy liên quan dùng các lệnh sau trên database mới riêng.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost
powershell -NoProfile -ExecutionPolicy Bypass -File tests/reception/run.ps1 -SqlServer localhost -Port 5299 -LegacyOnly
powershell -NoProfile -ExecutionPolicy Bypass -File tests/catalog/run.ps1 -SqlServer localhost -Configuration Release
```

Kiểm chứng local ngày 13/11/2026 dùng SQL Server Windows authentication,
Node 24.19.0 và .NET SDK 10.0.401. Repo khóa Node 22.19.0 và .NET SDK 10.0.400,
việc kiểm tra đúng phiên bản đã khóa thuộc lần chạy CI. Vite build có cảnh báo
chunk lớn hơn 500 kB. Kết quả CI trên GitHub và review/merge vẫn đang chờ.
