# PB-002 — Báo cáo dữ liệu trước nâng cấp

Công cụ: [legacy-audit.py](../../scripts/data/legacy-audit.py), truy vấn cố định [legacy-audit.sql](../../scripts/data/legacy-audit.sql). Chạy trên SQL Server với schema legacy trong `HospitalDbModelSnapshot.cs` (migration `20261025035340_VietnameseSource`); không chạy ứng dụng, seed hoặc migration. Schema sau PB-004 cần được đối chiếu lại trước khi dùng công cụ này.

## Chạy báo cáo

Yêu cầu Python 3.10+, Microsoft `sqlcmd` trong PATH và tài khoản có SELECT trên các bảng được truy vấn. Nên dùng tài khoản chỉ đọc trên bản sao database. Không đọc `.env`, không có server/database mặc định.

Từ `codes/`, Windows authentication:

```powershell
python scripts/data/legacy-audit.py --server localhost --database HospitalCopy --trust-server-certificate > legacy-audit.json
if ($LASTEXITCODE -ne 0) { throw 'Audit failed; do not use the report' }
```

Với SQL authentication, thêm `--user <login>` và cung cấp mật khẩu qua biến môi trường `SQLCMDPASSWORD` bằng cơ chế quản lý secret của môi trường. Không truyền mật khẩu bằng tham số dòng lệnh. Chỉ dùng `--trust-server-certificate` khi chủ động tin chứng chỉ của server đó.

Exit code 0 nghĩa là truy vấn thành công, kể cả khi có findings; exit code 1 nghĩa là kết nối/schema/quyền/định dạng thất bại, không tạo báo cáo hợp lệ. Lỗi thô từ SQL Server không được in ra. Tham số bắt buộc thiếu trả mã 2.

JSON chỉ gồm mã quy tắc, UUID, số lượng và nhãn schema cố định. `findingRowsByRule` đếm dòng chi tiết, không phải số nhóm xung đột: ví dụ một Patient có bốn hồ sơ mở sinh bốn dòng cùng `entityId`, mỗi dòng `recordCount=4`, `relatedId` là Visit hoặc Request cần đối chiếu. Các quy tắc khác có thể cùng chỉ đến một hồ sơ; không cộng tổng findings thành số bệnh nhân.

## Ý nghĩa các nhóm kiểm tra

| Mã | Điều kiện / ID cần đối chiếu |
|---|---|
| `patient_multiple_open_records` | Tổng Visit Active và request Submitted/NeedsInformation của một Patient >1; bao gồm xung đột một Visit + một request. |
| `room_multiple_consultations` | Nhiều Visit Active khác nhau có bước Consultation/ReturnConsultation InProgress cùng LocationId. Không đếm trùng các bước của cùng Visit. |
| `visit_multiple_open_orders` | Order chưa Resolved/Completed/Cancelled/Skipped >1 trên cùng Visit. Trạng thái lạ được coi là còn mở để không bỏ sót. |
| `doctor_room_unconfirmed` | Mọi bác sĩ Active cần xác nhận phân công phòng: schema cũ chỉ có scope khoa, chưa có phân công phòng chính thức. |
| `doctor_multiple_observed_rooms` | Bác sĩ có bước khám thuộc nhiều phòng khác nhau trong các Visit Active; chỉ là bằng chứng lịch sử, không phải lịch trực. |
| `pending_activation` | Journey PendingActivation, gồm cả hồ sơ lịch sử. |
| `settlement_requires_review` | Mọi Visit đã có revision/outcome quyết toán. Không tự suy ra đủ điều kiện đóng. |
| `settlement_before_clinical_resolution` | Quyết toán khác WorkRevision hoặc còn bước khám/dịch vụ chưa Completed, kể cả Skipped/Cancelled. |
| `skipped_cancelled_step`, `skipped_cancelled_order` | Giữ nguyên và liệt kê lịch sử Skipped/Cancelled. |
| `published_summary_requires_review`, `published_followup_requires_review` | Mọi nội dung Published: schema cũ không có dấu xác nhận kết thúc khám mới nên không thể chứng minh đã công bố đúng lúc. Không xuất nội dung sức khỏe. |
| `open_pharmacy` | Bước Pharmacy chưa Completed/Skipped/Cancelled, kể cả Visit đã đóng. |
| `ticket_snapshot_missing_legacy` | Mọi Visit: schema cũ chưa có snapshot thông tin tiếp nhận/phòng/bác sĩ/ngày/số theo PRD mới. RelatedId null nếu không có phiếu. |
| `ticket_number_missing` | Thiếu phiếu hoặc số phiếu trống. Không xuất số phiếu cũ. |
| `destination_snapshot_incomplete` | JSON sai, thiếu UUID đích hoặc khác LocationId; thiếu/trống nameVi, building, floor, room. Chỉ kiểm tra đủ dữ liệu, không chứng minh tính chính xác lịch sử. |
| `visit_clinic_ambiguous` | Không có hoặc có nhiều LocationId trong các bước khám, không đủ căn cứ chọn phòng gốc duy nhất. |
| `guest_link_history` | AuditEvent GuestLinked; không khôi phục/tách lại danh tính. |
| `legacy_patient_locale` | Patient có locale ko/ru cần đối chiếu. |

Các nhóm `requires_review` là danh sách cần xác minh, không khẳng định mọi dòng đều sai nghiệp vụ. Đặc biệt không suy `ExamStatus=Completed` từ Summary Published hay Consultation Completed. Công cụ không tự backfill, đóng, sửa hay xóa hồ sơ. Không lấy tên phòng/roster hiện tại để tái tạo snapshot lịch sử. Báo cáo sạch chỉ có nghĩa không khớp điều kiện kiểm tra; không thay thế nghiệm thu PB-030.

## Tính chỉ đọc và nhất quán

SQL chỉ SELECT/CTE, đặt transaction SERIALIZABLE và luôn ROLLBACK; không DML, bảng tạm, procedure hay migration. SERIALIZABLE giữ một tập dữ liệu nhất quán trong lúc đọc nhưng có thể chặn ghi của ứng dụng; nên chạy trên bản sao. Có lock timeout 15 giây, query timeout 60 giây và giới hạn tiến trình 90 giây. Đóng kết nối do lỗi cũng rollback transaction. `ApplicationIntent=ReadOnly` không được dùng làm bằng chứng cấm ghi; test thực thi bằng user có SELECT và DENY INSERT/UPDATE/DELETE.

## Kiểm chứng

```powershell
$env:LEGACY_AUDIT_TEST_SERVER='localhost'
python -m unittest discover -s tests/data -p 'test_*.py' -v
python -m py_compile scripts/data/legacy-audit.py tests/data/test_legacy_audit.py
```

Test tạo database mới `HospitalLegacyAudit_<UUID>` trên local SQL Server, không nhận tên database có sẵn. Database fixture được giữ lại để kiểm tra, không tự DROP. Fixture dùng projection các cột legacy mà truy vấn đọc, không chạy API hay migration; vì vậy đây không phải test tích hợp toàn bộ EF model/khóa ngoại. Tên bảng/cột được đối chiếu model snapshot hiện tại.

Fixture sạch là dữ liệu trước tiếp nhận (Patient + một request chờ). Một Visit legacy hợp lệ vẫn thuộc nhóm thiếu snapshot mới, nên không thể gọi database có Visit legacy là hoàn toàn sạch cho nâng cấp. Fixture xung đột bao phủ mọi nhóm, kiểm tra chính xác số lượng/ID, các trạng thái terminal, bước trùng cùng Visit, JSON hỏng/null/thiếu/khác ID, và việc che lỗi chứa secret. Mỗi lần audit so COUNT_BIG và CHECKSUM_AGG của toàn bộ bảng fixture trước/sau; thêm kiểm tra quyền chỉ đọc. Checksum không thay thế backup hay bằng chứng toàn vẹn mật mã.

Không thay backend/shared/web/mobile, không có migration; build/typecheck/lint của các thành phần đó không áp dụng cho thay đổi Python/SQL này. Chưa chạy trên dữ liệu thực tế hoặc bản sao production.
