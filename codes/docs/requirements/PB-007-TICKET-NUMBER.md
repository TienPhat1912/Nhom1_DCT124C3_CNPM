# PB-007 — Cấp số phiếu theo phòng và ngày

Bộ cấp số dành cho luồng V2, chưa gọi từ endpoint xác nhận cũ. PB-008 tích hợp
bộ cấp số vào confirm và UI. Không thay API, shared DTO hoặc số `H-` hiện có.

## Dữ liệu và số hiển thị

- `ExaminationTicket.ClinicLocationId`, `IssuedOn` (`date`), `SequenceNumber`:
  cùng null cho phiếu lịch sử, hoặc cùng có giá trị với số thứ tự > 0.
- Unique filtered index `UX_Ticket_ClinicDateSequence` bảo vệ bộ ba này.
- `TicketDailyCounters`: unique `(ClinicLocationId, IssuedOn)`, `LastNumber > 0`,
  FK tới Location. Ticket cũng có FK tới Location. Các FK dùng Restrict.
- Counter bắt đầu 1 theo mỗi phòng/ngày. `Number` lưu `001`, `002`, …, `1000`
  theo hợp đồng `TicketNumberV2`; không cắt ngắn sau 999.
- `AllocatedTicketNumber` trả đủ bốn trường của hợp đồng. `DisplayNumber` là
  `<clinic-guid-N>/<yyyyMMdd>/<number>`, một tham chiếu đầy đủ phân biệt phòng/ngày.
  PB-008 có thể trình bày mã/tên phòng từ snapshot cùng ngày và số; không dùng
  `001` đơn lẻ làm mã tra cứu toàn hệ thống.
- Ngày được lấy từ `TimeProvider.GetUtcNow()` và chuyển sang `Asia/Ho_Chi_Minh`,
  không phụ thuộc giờ máy hay ngôn ngữ UI. Khóa và tham chiếu dùng invariant culture.
- Phòng phải có cấu hình `ClinicRoom`. Kiểm tra quyền tiếp nhận, bác sĩ hoạt động,
  snapshot và tạo Visit/Journey là trách nhiệm của confirm PB-008.

## Tích hợp trong PB-008

`TicketNumberAllocator` đăng ký scoped, `TimeProvider.System` singleton. Ví dụ
phần action bên trong `CommandBus.Run` (không phải một endpoint mới):

```csharp
return await bus.Run(scope, input, async () => {
    // Xác thực quyền, request, phòng, bác sĩ; tạo Visit/Journey và snapshot trước.
    var ticket = new ExaminationTicket { VisitId = visit.Id };
    db.Add(ticket);
    var number = await allocator.AssignAsync(ticket, clinicLocationId);
    // Trả DTO bất biến chứa ticket ID và các trường của number.
    return new { ticket.Id, number.ClinicLocationId, number.IssuedOn,
        number.SequenceNumber, number.Number, number.DisplayNumber };
});
```

Allocator yêu cầu giao dịch SQL của caller; không tự Begin/Commit/SaveChanges.
Nó khóa `sp_getapplock` độc quyền theo phòng/ngày, owner Transaction; khóa bao gồm
cả trường hợp chưa có counter. Trong khóa, SQL UPDATE tăng counter hoặc INSERT
counter đầu tiên. Không đọc `MAX` trên phiếu. Timeout khóa phát SQL 51007; caller
rollback và retry cùng event key, không coi đó là đã cấp thành công.

Counter, ticket, Visit/Journey và command receipt phải commit trong cùng giao dịch.
`CommandBus` lưu kết quả và replay khi cùng scope/key/payload; payload đổi bị 409.
Allocator riêng không làm idempotency: mỗi lần gọi thành công là một lần cấp số.
Sau rollback phải bỏ DbContext/entity đã dùng và bắt đầu command mới với cùng key.
Không tái dùng entity đang mang số trong bộ nhớ sau rollback.

Allocator chỉ chấp nhận entity mới ở trạng thái Added trong DbContext của command,
từ chối phiếu đã có bất kỳ trường cấp số hoặc `Number` không rỗng, kể cả phiếu `H-`
cũ và phiếu lịch sử bị trống số. Đọc/in lại sử dụng giá trị đã lưu; không gọi allocator.
Ràng buộc SQL bảo vệ tính hợp lệ và trùng số; code đọc/in không được cập nhật
trường cấp số của phiếu đã phát hành. Đổi phòng hiển thị hoặc sang ngày không
đánh lại số. Counter int vượt giới hạn sẽ làm SQL thất bại và rollback; không quay vòng.

## Migration và rollback

Migration `20261112200836_TicketNumberPerClinicDay` nối sau PB-006
`20261112153806_RegistrationUniquenessV2`. Áp dụng theo cơ chế migration hiện có
hoặc `dotnet ef database update` với kết nối được chỉ định cho môi trường đích.
Không đổi tên/mã/ID phiếu cũ, không suy diễn ngày/phòng từ CreatedAt, Visit hay `H-`.
Ba cột mới của phiếu cũ đều null, counter trống sau nâng cấp.

Down chỉ được phép khi chưa có phiếu được đánh số hoặc counter. Nếu có dữ liệu,
SQL 51008 chặn trước khi thay schema; migration history, counter và toàn bộ phiếu
được giữ. Khi đó rollback ứng dụng và giữ schema; không xóa số/counter để ép Down.
Nếu chưa sử dụng bộ cấp số, Down về migration PB-006 và Up lại được kiểm thử.
Thực hiện migration khi đã dừng thao tác ghi, phối hợp thứ tự với PB-013/028 và
lấy snapshot mới nhất trước khi sinh migration tiếp theo.

## Kiểm thử

Từ `codes/`, đặt `PB007_SQL_CONNECTION` bằng kết nối local SQL/LocalDB rồi chạy:

```powershell
dotnet run --project tests/ticket-number/TicketNumber.Tests.csproj -c Release
```

Bộ test chỉ chấp nhận server local và tự thay database bằng `HospitalPB007_<guid>`;
tạo thêm `HospitalPB007_fresh_<guid>`, giữ lại cả hai để đối chiếu. Không dùng database
ứng dụng trong connection string. Test dùng dữ liệu tổng hợp và mật khẩu fixture.
Không chạy bằng kết nối demo/online. Windows CI đặt biến từ LocalDB riêng và gọi
bộ test trong `scripts/test/ci-native.ps1`, đồng thời khôi phục biến môi trường.

38 assertions: nâng cấp legacy giữ ID/số/null; latest schema mới và snapshot; 24
transaction đồng thời trên connection/DbContext riêng (hai culture khác nhau);
hai phòng; đúng 23:59:59/00:00:00 Việt Nam trên cùng ngày UTC; rollback counter
đã tồn tại/chưa tồn tại; 12 command đồng thời cùng key chỉ có một ticket/receipt;
payload khác bị từ chối; lỗi giữa command không mất số; cấm đánh lại phiếu;
SQL check/unique/FK độc lập; 1000 không bị cắt; đổi tên phòng không đổi số;
Down có dữ liệu bị chặn và Down/Up khi chưa sử dụng thành công.

Giới hạn: chưa hook confirm/UI (PB-008), chưa chạy GitHub Actions/LocalDB trên máy
hiện tại. SQL thực tế được kiểm thử bằng SQL Server Docker riêng trên loopback.
