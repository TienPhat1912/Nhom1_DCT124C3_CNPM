# PB-002 Tạo báo cáo dữ liệu cũ trước nâng cấp

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — đã triển khai local, chờ review/PR/merge |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Nền tảng |
| Ưu tiên | P0 |
| Cỡ việc | S |
| Phụ thuộc cần merge | Không |
| Đối chiếu kế hoạch | P0 / mục 6 |
| Branch gợi ý | `feat/pb-002-legacy-audit` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Tạo công cụ chỉ đọc để thống kê dữ liệu không phù hợp quy tắc mới, dùng database được chỉ định rõ ràng.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: scripts/data/ (script mới); tests/ (fixture liên quan); docs/requirements/.

## Tiêu chí chấp nhận

- [x] Phát hiện Patient có nhiều Visit Active/request chờ, phòng nhiều ca đang khám, Visit nhiều order mở và bác sĩ chưa rõ phòng.
- [x] Liệt kê PendingActivation, quyết toán sớm, Skipped/Cancelled, nội dung publish sớm, nhà thuốc còn mở và phiếu/snapshot chưa đủ dữ liệu.
- [x] Báo cáo dùng ID và số lượng cần đối chiếu; không in mật khẩu, token hoặc mô tả sức khỏe. Chạy không thay đổi database.

## Kiểm chứng bắt buộc

Chạy trên fixture có từng loại xung đột và fixture sạch; so số lượng trước/sau để chứng minh không ghi dữ liệu.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không sửa, xóa hoặc tự đóng các hồ sơ bị phát hiện.

## Phối hợp và phụ thuộc

Độc lập với các task UI; chưa đụng EF model snapshot.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai local ngày 12/11/2026 trên nhánh `AnhBao_PB002_legacy_audit` có sẵn:

- Công cụ: [legacy-audit.py](../../../codes/scripts/data/legacy-audit.py), [SQL chỉ đọc](../../../codes/scripts/data/legacy-audit.sql).
- Hướng dẫn, quy tắc và giới hạn: [PB-002-LEGACY-AUDIT.md](../../../codes/docs/requirements/PB-002-LEGACY-AUDIT.md).
- Fixture/test SQL Server: [test_legacy_audit.py](../../../codes/tests/data/test_legacy_audit.py). Kiểm tra dữ liệu sạch/xung đột, số lượng và checksum trước/sau, chạy bằng user SELECT bị DENY INSERT/UPDATE/DELETE.
- Nội dung Published và quyết toán cũ được đưa vào danh sách cần đối chiếu vì schema chưa có dấu xác nhận kết thúc khám; không suy diễn hồ sơ đã hoàn tất. Mọi Visit legacy thiếu snapshot phiếu mới đều được báo cáo.
- Không có migration, không thay model/EF snapshot. Chưa chạy dữ liệu production. Chưa mở PR, chưa có reviewer hoặc merge nên chưa đánh Done theo quy ước backlog.

Kiểm chứng ngày 12/11/2026 (chạy từ `codes/`):

- `$env:LEGACY_AUDIT_TEST_SERVER='localhost'; python -m unittest discover -s tests/data -p 'test_*.py' -v`: **PASS 4 tests**, gồm fixture sạch, đủ 19 nhóm cảnh báo, kiểm tra không ghi và CLI JSON. Database kiểm chứng cuối được giữ lại: `HospitalLegacyAudit_58dd828d42324551a62e4f725934172c`.
- `python -m py_compile scripts/data/legacy-audit.py tests/data/test_legacy_audit.py`: **PASS**.
- `git diff --check`: **PASS**.
- SQL Server local cần chạy ngoài sandbox vì kết nối Windows authentication trong sandbox lỗi SSL credentials; lần chạy được cấp quyền đã pass. Fixture chỉ chứa projection các cột được đọc, chưa kiểm chứng migration/foreign key của toàn ứng dụng. Build/typecheck/lint web/backend không áp dụng vì chỉ thay Python/SQL/tài liệu.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-002, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

