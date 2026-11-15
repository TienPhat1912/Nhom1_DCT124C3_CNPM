# PB-030 — Diễn tập nâng cấp và khôi phục dữ liệu

Chạy từ `codes/`. Bộ rehearsal chỉ tạo database mới mang tiền tố `HospitalPB030_<runId>_` trên SQL Server cục bộ; không dùng connection của ứng dụng, không đọc `.env`, không bật luồng V2. Database và backup fixture được giữ lại để kiểm tra.

## Chạy rehearsal

Yêu cầu .NET SDK theo `global.json`, SQL Server/LocalDB và tài khoản Windows có quyền tạo database, backup, restore, tạo user không login. SQL Server service phải ghi được thư mục backup/data của instance.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/migration/run.ps1 -SqlServer '.\SQLEXPRESS'
if ($LASTEXITCODE -ne 0) { throw 'Rehearsal failed' }
```

Có thể thay server bằng `(localdb)\MSSQLLocalDB`. Với SQL authentication trên instance local, tự cung cấp connection qua `PB030_SQL_CONNECTION` bằng cơ chế quản lý secret, rồi chạy trực tiếp:

```powershell
dotnet run --project tests/migration/Migration.Tests.csproj -c Release
if ($LASTEXITCODE -ne 0) { throw 'Rehearsal failed' }
```

Runner luôn bỏ tên database trong connection và tạo tên mới. `PB030_BACKUP_DIRECTORY` tùy chọn là đường dẫn **trên máy SQL Server**, mặc định lấy `InstanceDefaultBackupPath`; thư mục phải có sẵn. `PB030_REPORT` tùy chọn đổi nơi lưu báo cáo, mặc định `artifacts/pb030-rehearsal.json`. Script PowerShell dùng Windows authentication và phục hồi các biến môi trường đã thay khi kết thúc.

Exit code 0 cùng `passed: true` xác nhận rehearsal đã qua. Exit code khác 0 phải dừng quy trình; không dùng báo cáo của lần chạy trước. JSON ghi run ID, migration đã áp dụng, ID finding, số dòng và SHA-256 từng bảng; không ghi token, connection string, nội dung lâm sàng hay snapshot gốc. CI Windows gọi cùng script trong `scripts/test/ci-native.ps1` và thu báo cáo JSON vào artifact.

## Quy trình trên bản sao dữ liệu cần nâng cấp

Rehearsal fixture không thay thế việc diễn tập trên bản sao dữ liệu thật. PB-030 không thực hiện các bước dưới đây trên demo/online của nhóm.

1. Chốt commit, artifact ứng dụng, danh sách migration và database nguồn. Tạm dừng **mọi** tiến trình ghi trước khi lấy baseline/backup. `Workflow__PrdV2Enabled=false` chỉ khóa luồng V2, không phải chế độ chỉ đọc. Lưu cấu hình, Data Protection key ring và cách khôi phục secret bên ngoài báo cáo; giữ key ring để QR/token đã bảo vệ còn đọc được.
2. Backup full bằng `COPY_ONLY, CHECKSUM`; chạy `RESTORE VERIFYONLY ... WITH CHECKSUM`. Đặt tên file mới cho mỗi lần chạy. Restore backup vào database riêng, dùng `RESTORE FILELISTONLY` và `WITH MOVE` cho tất cả file; không dùng `WITH REPLACE`. Xác nhận đúng database và migration nguồn. VERIFYONLY chưa chứng minh restore được; bước restore và đối chiếu dữ liệu là bắt buộc.
3. Trên bản sao ở migration `20261025035340_VietnameseSource`, chạy [audit PB-002](../requirements/PB-002-LEGACY-AUDIT.md). Lưu findings trước khi migration. Lưu số dòng, ID/ownership và hash trên **các cột cũ** của từng bảng theo thứ tự khóa chính; lưu riêng `__EFMigrationsHistory`. Bộ rehearsal minh họa cách lấy baseline này. Không khởi động ứng dụng để audit vì startup có migration/seed/catalog sync.
4. Dừng nếu có nhiều order mở, nhiều ca đang khám/phòng, hồ sơ mở trùng, snapshot đích thiếu/sai hoặc thông tin đang hoạt động chưa xác minh. Giao từng ID cho người phụ trách nghiệp vụ; ghi bằng chứng và phương án xử lý rồi diễn tập lại từ bản sao mới. Không xóa dòng, gán bác sĩ hiện tại cho lịch sử, tự đóng Visit, đổi Cancelled/Skipped thành Completed hoặc tách Patient đã liên kết Guest để vượt constraint.
5. Với bản sao đã được đối chiếu, chạy migration theo thứ tự EF, vẫn tắt V2 và dừng ghi. Dùng `dotnet ef database update` với design-time factory để tránh seed/catalog sync; đặt `ConnectionStrings__Hospital` rõ ràng tới **bản sao**, không dựa vào fallback. Khôi phục biến môi trường sau khi chạy. Ví dụ lệnh sau chỉ được chạy sau khi đã đặt connection tới bản sao:

   ```powershell
   if (-not $env:ConnectionStrings__Hospital) { throw 'Set the reviewed copy connection first' }
   dotnet tool restore --tool-manifest dotnet-tools.json
   if ($LASTEXITCODE -ne 0) { throw 'Tool restore failed' }
   dotnet ef database update --project backend/Hospital.Api --no-build --configuration Release
   if ($LASTEXITCODE -ne 0) { throw 'Migration failed; keep writers stopped' }
   ```

6. Đối chiếu lại mọi cột cũ với baseline, số dòng/FK/ownership/grant/snapshot, migration history và model snapshot. Chạy `DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS, NO_INFOMSGS`; kiểm tra FK không bị disable/untrusted. Chạy migration lần hai và đối chiếu toàn bộ bảng sau nâng cấp để chứng minh không nhân đôi hoặc ghi đè.
7. Chạy cả [review PB-004](../../scripts/data/core-schema-review.sql) để lưu thông tin còn thiếu trong lịch sử và [cutover-review.sql](../../scripts/data/cutover-review.sql) bằng tài khoản chỉ đọc trên schema mới. Dùng `sqlcmd -b -S <server> -d <copy> -E -C -i scripts/data/cutover-review.sql`, kiểm tra exit code và các dòng kết quả. **Exit code 0 chỉ nghĩa là truy vấn thành công; có dòng kết quả vẫn phải chặn cutover.** Chỉ dùng `-C` khi đã chủ động tin chứng chỉ server đó.
8. Khi không còn blocker, người phụ trách duyệt các findings lịch sử và kết quả smoke/acceptance PB-031. Sau đó mới quyết định chuyển connection tới database đã kiểm tra, bật `Workflow__PrdV2Enabled=true` và mở lại ghi. Kiểm tra phân công phòng/bác sĩ, tiếp nhận, gọi khám, cấp phiếu, dịch vụ, quyết toán và quyền khôi phục Guest trên môi trường acceptance trước khi phát hành.

Phiếu cũ có `LegacyMissing`, ExamStatus cũ null hoặc roster chưa xác nhận được giữ nguyên. Với Visit **đang Active**, các thiếu sót này là blocker; cần nghiệp vụ xác minh riêng, không dùng tên hiện tại để tạo lại snapshot lịch sử. Với lịch sử Closed, chúng được lưu trong audit/review và cần người phụ trách duyệt; query cutover không yêu cầu bịa thêm dữ liệu để làm đủ trường mới. Zero blocker là điều kiện cần, không tự cấp phép phát hành.

Gate cũng chặn order legacy còn mở dù trạng thái là `Ordered` và chưa vướng unique index `NotCompleted`. Không suy ra an toàn từ việc SQL migration chạy thành công.

## Khôi phục khi nâng cấp hoặc kiểm tra thất bại

Giữ mọi writer dừng và V2 tắt; ghi commit, các migration **đã** commit và finding/SQL error number. Không retry khi chưa biết trạng thái hiện tại. EF có thể đã commit migration trước đó dù migration sau bị chặn.

Restore backup trước nâng cấp vào **database khác** với tên/file mới; không ghi đè database đang điều tra. Đối chiếu số dòng/hash cột cũ, migration history, FK, PatientId của Visit/Request, grant của phiên Guest/account, QR, recovery/link claim và audit GuestLinked. Chỉ chuyển connection về database đã khôi phục sau khi kiểm tra và xác nhận phiên bản ứng dụng tương thích. Bản rehearsal kiểm tra restore cả fixture sạch và fixture xung đột, rồi nâng cấp lại bản restore sạch.

Backup trước cutover không có giao dịch phát sinh sau cutover. Nếu đã mở ghi, dừng writer và giữ lại database mới cùng log/backup sau cutover; cần kế hoạch đối soát/replay được duyệt trước khi chuyển về backup cũ. PB-030 không chứng minh RPO=0 hay khôi phục point-in-time trên production/Azure.

Không dùng `database update <old migration>` làm phương án khôi phục dữ liệu đã hoạt động. Một số Down bị chặn khi có dữ liệu mới: core schema `51004`, phiếu đã cấp `51008`, lịch sử gọi khám `51011`, order V2 `51014`. Những Down khác có thể xóa bảng/cột và đã commit trước khi gặp guard. Rehearsal chỉ thử Down trên database **rỗng**; với dữ liệu lịch sử, phương án đã kiểm chứng là restore backup sang database khác.

## Phạm vi và lưu giữ bằng chứng

Baseline legacy là `VietnameseSource`, schema đích được lấy động từ assembly; lúc bàn giao là `20261115133759_SessionPresence`. Dữ liệu trước `VietnameseSource` có thay đổi riêng về nội dung nguồn/ngôn ngữ; cần đối chiếu [LANGUAGES.md](LANGUAGES.md) và diễn tập riêng, không áp dụng cam kết giữ nguyên mọi cột của PB-030 cho migration đó.

Fixture gồm dữ liệu tổng hợp, lịch sử Closed/PendingActivation, order Completed/Cancelled/Skipped, snapshot đích lịch sử khác tên phòng hiện tại, summary/follow-up đã Published, quyết toán, Guest đã liên kết account, hai grant cùng Visit, phiên Guest revoked, recovery/link claim đã consumed và audit GuestLinked. Nhánh xung đột có nhiều ca/phòng, nhiều order và snapshot thiếu. Không sửa migration nghiệp vụ hiện có.

JSON trong `artifacts/` và file `.bak` không commit. Database/backup được giữ theo run ID; chỉ dọn sau khi đã đối chiếu bằng chứng và xác nhận đúng các fixture do lần chạy đó tạo. Báo cáo bàn giao nằm ở [PB-030-MIGRATION-REHEARSAL.md](../requirements/PB-030-MIGRATION-REHEARSAL.md).
