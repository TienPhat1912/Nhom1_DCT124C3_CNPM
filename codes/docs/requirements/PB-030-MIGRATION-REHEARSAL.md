# PB-030 — Kiểm chứng nâng cấp và khôi phục dữ liệu

Ngày kiểm chứng: 16/11/2026 (Asia/Saigon). Đã triển khai local, chờ review/PR/merge.

## Kết quả

- Thêm [runner SQL thật](../../tests/migration/Program.cs), [lệnh PowerShell](../../tests/migration/run.ps1), [gate chỉ đọc](../../scripts/data/cutover-review.sql) và [runbook](../guides/MIGRATION_REHEARSAL.md).
- Nối rehearsal vào CI Windows hiện có. Runner không nhận database đích tùy ý và không sử dụng connection ứng dụng; chỉ tạo fixture local tên mới.
- Backup `COPY_ONLY, CHECKSUM` trước audit, VERIFYONLY và restore sang database khác. Giữ nguyên hash/số dòng mọi cột legacy, bao gồm ID, PatientId, bác sĩ, trạng thái, grant, claim, snapshot và lịch sử GuestLinked.
- Fixture sạch nâng cấp thành công, FK/check constraints hợp lệ; migrate lần hai không thay dữ liệu. Restore trả đúng schema và dữ liệu cũ, sau đó nâng cấp lại được.
- Fixture xung đột bị chặn trước migrate; bản restore chẩn đoán sau migrate vẫn bị gate chặn. Không xóa dữ liệu để vượt constraint. Order legacy `Ordered` được phát hiện dù unique filter mới chỉ áp dụng `NotCompleted`.
- Fixture `NotCompleted` trùng bị migration PB-011 từ chối bằng `51013`; mọi cột cũ giữ nguyên. Chỉ thử downgrade schema rỗng; runbook giải thích partial commit/guard và dùng restore cho dữ liệu đã hoạt động.

## Bằng chứng chạy local

```powershell
dotnet build tests/migration/Migration.Tests.csproj --configuration Release --no-restore
powershell -NoProfile -ExecutionPolicy Bypass -File tests/migration/run.ps1 -SqlServer '.\SQLEXPRESS'
```

Build: **PASS**, 0 warning, 0 error. Rehearsal: **PASS, 49 assertions**.

Report: `artifacts/pb030-rehearsal.json`, `passed=true`, `cutoverEnabled=false`.
Run ID: `50ca71e6e4a54b8db28594ed92ebaeca`; UTC `2026-11-15T17:42:26.0593621Z`, tức 00:42:26 ngày 16/11 tại Việt Nam.
SQL: Windows authentication trên `.\SQLEXPRESS`. Database được giữ lại với tiền tố `HospitalPB030_<runId>_`; report chứa hash/số dòng từng bảng và finding ID, không chứa nội dung nhạy cảm.

Các stage đã qua: `fresh`, `backup-verified` (hai fixture), `legacy-upgraded`, `restore-verified` (hai fixture), `preflight-blocked`, `diagnostic-copy-blocked`, `migration-guard-verified`.

## Sửa lỗi CI LocalDB

Artifact `acceptance-and-builds` của [CI run 43743465746](https://github.com/TienPhat1912/Nhom1_DCT124C3_CNPM/actions/runs/43743465746)
ghi `passed=false`, `checks=7`, `ArgumentNullException`. Bảy assertions thuộc schema mới đã qua;
lỗi phát sinh sau đó khi chuẩn bị backup fixture legacy. Code cũ đưa trực tiếp
`InstanceDefaultBackupPath` vào `Path.Combine`, không xử lý giá trị null của LocalDB.

Đã thêm fallback tới thư mục data file của chính fixture từ `sys.master_files`, giữ ưu tiên
`PB030_BACKUP_DIRECTORY` và đường dẫn mặc định có giá trị. Report lỗi ghi thêm operation,
parameter name và assertion an toàn để phân biệt lỗi môi trường với lỗi dữ liệu.
`run.ps1` chạy sáu regression checks không cần SQL trước rehearsal; cả sáu checks và
49 assertions SQL Express đã PASS sau bản sửa (`artifacts/pb030-localdb-fix.json`).
Kết quả này chưa thay thế việc chạy lại CI trên LocalDB.

## Giới hạn

Chưa chạy toàn bộ CI từ đầu hoặc diễn tập trên bản sao dữ liệu demo/online thật. Không chạy migration/reset/restore lên database dùng chung. Rehearsal fixture không kiểm chứng vận hành Azure, PITR, backup mã hóa hoặc replay giao dịch sau cutover. Bật V2/phát hành cần xét dữ liệu thật và nghiệm thu PB-031. Không thay đổi migration, API, web/mobile hay cấu hình V2.

Chưa mở PR hoặc có reviewer/merge; task chưa được đánh Done theo quy ước backlog.
