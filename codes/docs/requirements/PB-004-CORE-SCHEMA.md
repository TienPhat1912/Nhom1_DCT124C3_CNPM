# PB-004 — Schema nền phòng khám và chuyển đổi legacy

Migration: `20261112151204_CoreClinicSchema`, sau `20261025035340_VietnameseSource`.
Đây là bước **bổ sung schema**, không bật luồng PRD-v2, không thay endpoint và không
thêm số phiếu, schema lâm sàng hoặc presence. Hợp đồng đích vẫn là PB-001 trong
[API.md](../architecture/API.md); trường nullable chuyển tiếp không nới lỏng DTO V2.

## Cấu trúc

| Bảng / trường | Ý nghĩa và ràng buộc |
|---|---|
| `ClinicDoctor` | Một dòng phân công DoctorId → ClinicLocationId; DoctorId unique, FK Users và Location, alternate key (ClinicLocationId, DoctorId). Một bác sĩ không thể thuộc hai phòng. |
| `ClinicRoom` | Một dòng/phòng, ClinicLocationId unique; ActiveDoctorId nullable cho phòng chưa có người trực. FK kép tới ClinicDoctor buộc bác sĩ hoạt động thuộc đúng phòng. Một phòng chỉ có một giá trị ActiveDoctorId. |
| `Visit.ClinicLocationId` | FK Location, nullable khi chưa xác định; giữ độc lập với phân công hiện tại để không đổi phòng lịch sử. |
| `Visit.DoctorId` | Giữ nguyên FK Users hiện có; không đổi ID, không backfill từ bác sĩ đang trực. Không FK tới phân công hiện tại vì phân công có thể thay đổi sau khi lượt đóng. |
| `Visit.ExamStatus` | Nullable cho legacy; khi có giá trị chỉ nhận Waiting / InConsultation / InService / Completed. |
| `Visit.ConsultationCount` | Nullable khi không biết số lần tiếp nhận; khi có giá trị phải ≥0. Không suy số lần gọi từ số bước Journey. |
| `Visit.ExaminationCompletedAt` | Nullable, chỉ được ghi khi ExamStatus=Completed. Không lấy PublishedAt làm ngày kết thúc khám. |
| `ExaminationTicket` | PatientSnapshot, ClinicSnapshot, DoctorSnapshot là JSON object riêng, không join tên hiện tại khi in lại. SnapshotSource=LegacyMissing bắt buộc ba trường null; Captured bắt buộc cả ba là JSON object. |
| `RegistrationRequest` | SourceLanguage nullable và PreferredDepartmentId nullable FK Department, độc lập với DepartmentId dùng cho phạm vi tiếp nhận. Null khoa mong muốn là lựa chọn hợp lệ. |
| `AssistanceRequest` | SourceLanguage nullable; không lấy locale hồ sơ Patient để suy lại ngôn ngữ gốc. |

Nguồn ngôn ngữ khi biết chỉ nhận vi/en/zh/ja, theo LocaleV2. Dữ liệu cũ có locale
ko/ru vẫn được giữ trong Patient, SourceLanguage mới để null. Không sửa Description
hoặc Requests. Tất cả FK mới dùng Restrict, không cascade xóa lịch sử. Version của
hai bảng phân công dùng cơ chế concurrency hiện có.

Snapshot JSON tương ứng `patientSnapshot`, `clinicSnapshot`, `doctorSnapshot` trong
`ExaminationTicketV2`. SQL kiểm tra object/đủ ba tài liệu; PB-008 phải xác thực đầy đủ
các thuộc tính theo DTO và ghi nguyên tử khi tiếp nhận. Không cho client tự cung cấp
snapshot/tác giả. PB-004 không thêm endpoint ghi các trường này. SQL JSON dùng hàm
có từ SQL Server 2016, không yêu cầu overload `ISJSON(..., OBJECT)` của SQL 2022.

Role=Doctor, User.Active, thông tin đăng nhập, trạng thái phòng/khoa và khóa đổi
phân công khi còn Visit Active là guard của PB-005; FK không thay kiểm tra quyền.
Khóa tài khoản vẫn giữ nguyên DoctorId lịch sử, không tự bàn giao sang người khác.

## Backfill và báo cáo

Migration chỉ điền Visit.ClinicLocationId khi:

1. Có ít nhất một bước Consultation/ReturnConsultation, mọi bước cùng LocationId.
2. Mọi snapshot là JSON hợp lệ, UUID `id` đủ 36 ký tự và bằng LocationId của bước.
3. Mọi snapshot có nameVi/building/floor/room không trống.
4. DepartmentId của bước, Visit và Location khớp nhau.

Một bước sai/thiếu cũng làm cả Visit không đủ căn cứ; không bỏ qua bước sai để chọn
bước còn lại. Không dùng phòng gần nhất, tên, roster, trạng thái Active của phòng
hiện tại hoặc bác sĩ hiện tại để đoán lịch sử. Một Location hợp lệ đã bị đổi tên
vẫn nhận diện bằng UUID; snapshot cũ được giữ nguyên, không sửa thành tên mới.

Visit Active và Closed đều được kiểm tra, nhưng không sửa Status, DoctorId, Version,
Journey, PendingActivation, quyết toán, order, kết quả, quyền Guest hoặc token.
Không suy ExamStatus=Completed từ Consultation Completed, Summary Published hay
quyết toán. Không suy SourceLanguage/PreferredDepartmentId từ profile/khoa tiếp nhận.
Snapshot phiếu cũ không có bằng chứng đầy đủ được đánh dấu LegacyMissing, không
tái tạo bằng tên bệnh nhân/bác sĩ/phòng hiện tại.

Báo cáo sau migration: [core-schema-review.sql](../../scripts/data/core-schema-review.sql).
Chạy từ `codes/` trên database chỉ định rõ, nên dùng bản sao và tài khoản SELECT:

```powershell
sqlcmd -S localhost -E -C -d HospitalUpgradeCopy -b -l 15 -t 60 -i scripts/data/core-schema-review.sql
if ($LASTEXITCODE -ne 0) { throw 'Review query failed' }
```

Không dùng tên ví dụ để trỏ vào database thật. `-C` chỉ dùng khi chủ động tin chứng
chỉ server. Báo cáo gồm Reason, EntityId và tổng số dòng trong từng Reason; không
xuất tên, nội dung sức khỏe, JSON snapshot, mật khẩu hoặc token. Transaction
SERIALIZABLE + ROLLBACK bảo đảm đọc nhất quán nhưng có thể giữ khóa; ưu tiên bản sao.

| Reason | Bước xử lý trước cutover |
|---|---|
| visit_clinic_unresolved | Đối chiếu hồ sơ gốc, xác nhận phòng; không tự chọn từ các phòng mâu thuẫn. |
| visit_exam_unverified | Đối chiếu trạng thái khám và số lần tiếp nhận; không chuyển null thành Waiting/0 hàng loạt. |
| ticket_snapshot_missing / visit_ticket_missing | Giữ nhãn legacy/phiếu cũ; thiếu dữ liệu lịch sử phải có quyết định chuyển đổi, không bịa snapshot. |
| request_source_unknown / assistance_source_unknown | Xác minh nguồn hoặc giữ nhãn chưa biết; chưa dịch tự động bằng locale profile. |
| doctor_assignment_unconfirmed / clinic_active_doctor_missing | Cấu hình có chủ đích qua PB-005, không suy ca trực từ roster hay Visit. |

Báo cáo này là kiểm tra readiness của schema mới, không thay công cụ khảo sát
xung đột PB-002. Không có thao tác sửa tự động hoặc cột đánh dấu “đã xử lý” để bỏ qua
cảnh báo. Các hồ sơ lịch sử thiếu bằng chứng có thể giữ nullable khi được quyết định
giữ luồng legacy; chỉ hồ sơ đủ dữ liệu mới được dùng như DTO PRD-v2.

## Thứ tự chuyển đổi và ràng buộc

1. PB-002 phải có báo cáo trước nâng cấp; lưu backup đã thử khôi phục. Chạy migration
   và báo cáo trên bản sao trước. PB-004 giữ đường ghi legacy hoạt động: bản ghi mới
   do endpoint cũ tạo tiếp tục có các trường mới null/LegacyMissing và được báo cáo.
2. PB-005 xác nhận phân công phòng/bác sĩ; PB-006/018/019 ghi ngôn ngữ gốc đúng thời
   điểm nhập; PB-008 ghi phòng, Waiting, ConsultationCount=0 và snapshot đã xác nhận.
3. PB-010 tăng lần tiếp nhận; PB-012 xử lý trở về Waiting; PB-014 xác nhận Completed
   và ExaminationCompletedAt; PB-015 quyết toán theo trạng thái đã xác nhận.
4. Kiểm tra/xử lý xung đột PB-002 và các dòng còn thiếu trong báo cáo này trước
   PB-030 rehearsal/cutover. Không bật luồng V2 trên dữ liệu chưa đủ chỉ vì migration chạy được.

PB-004 **không thêm unique index trên dữ liệu legacy**. Chỉ có unique trên hai bảng
phân công mới, ban đầu rỗng; an toàn với các bác sĩ/Visit cũ chưa phân công. Index
(ClinicLocationId, Status, ExamStatus) là index thường. Các task sở hữu ràng buộc
nghiệp vụ phải thêm bước kiểm tra trước khi bật constraint:

- PB-006/008: một request pending/một Visit Active cho Patient (kèm kiểm tra chéo
  request–Visit trong giao dịch; hai index riêng không đủ kiểm tra chéo).
- PB-007: số phiếu phòng/ngày; PB-010: một ca InConsultation/phòng.
- PB-011: một order mở/Visit; PB-030 xác nhận toàn bộ điều kiện trên bản sao trước cutover.

Không bật unique bằng cách hủy/xóa lượt hoặc order cũ. Không thêm các constraint
này trong PB-004 vì luồng legacy và dữ liệu xung đột vẫn phải hoạt động để đối chiếu.

## Seed và rollback

Demo database mới tạo đúng hai phân công/phòng demo với hai bác sĩ có tài khoản.
Seed chỉ chạy khi Demo.Enabled và chưa có Users, không import phân công từ roster,
không thay bác sĩ hoạt động khi restart, không backfill database có người dùng cũ.

Down chỉ chạy khi không có dữ liệu trong các trường/bảng mới. Có dữ liệu mới, kể
cả ClinicLocationId vừa backfill, sẽ THROW 51004 trước khi xóa schema. Không xóa
dữ liệu để làm Down chạy qua; dùng backup trước nâng cấp đã kiểm chứng và kế hoạch
đối chiếu những ghi phát sinh sau backup. Down không phải rollback nghiệp vụ an toàn
sau cutover. Migration Up không sửa/xóa bất kỳ cột lịch sử nào.

## Kiểm chứng và cách chạy lại

```powershell
dotnet restore tests/core-schema/CoreSchema.Tests.csproj
dotnet build tests/core-schema/CoreSchema.Tests.csproj -c Release --no-restore
$env:PB004_SQL_SERVER='localhost'
dotnet run --project tests/core-schema/CoreSchema.Tests.csproj -c Release --no-build --no-restore
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Test chỉ chấp nhận server local, luôn sinh tên database mới `HospitalPB004_<loại>_<UUID>`,
không lấy connection string ứng dụng, không nhận tên database có sẵn và không tự
DROP database. Tài khoản test cần quyền tạo database/user để thử DDL và đọc dưới
principal chỉ có SELECT, bị DENY INSERT/UPDATE/DELETE. Database test giữ lại để đối chiếu.

Fixture legacy chạy migration cũ thật, insert qua schema/FK thật rồi nâng cấp;
không dùng projection schema giả. Test đối chiếu SHA-256 của JSON theo ID chứa mọi
cột cũ của mọi bảng ứng dụng, gồm snapshots, IDs, DoctorId, Version, grants, recovery,
audit GuestLinked, Published, quyết toán sớm và order Cancelled. Có các ca phòng
duy nhất, bước lặp, nhiều phòng, JSON hỏng, thiếu bước, snapshot khác ID, một bước
hỏng trộn bước tốt, khoa mâu thuẫn và Visit Closed. Test cũng kiểm tra snapshot
không đổi khi profile đổi, constraint từ chối dữ liệu sai, rerun/seed idempotent,
down rỗng thành công và down có dữ liệu bị chặn. EF HasPendingModelChanges phải false.

`scripts/test/ci-native.ps1` đã tích hợp bộ test trên instance LocalDB riêng của CI.
Kiểm chứng local không thay thế lần CI/review và rehearsal trên bản sao dữ liệu thực
trong PB-030. Không chạy migration trên database demo/online đang dùng trong task này.
