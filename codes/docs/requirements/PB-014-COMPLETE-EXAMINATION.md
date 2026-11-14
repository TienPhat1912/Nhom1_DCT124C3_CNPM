# PB-014 — Xem trước và xác nhận kết thúc khám

Bác sĩ đang khám chọn triệu chứng/dấu hiệu/chẩn đoán và mẫu Việt trong form riêng
trên DoctorQueue. Danh mục có tìm kiếm, phân trang và giữ lựa chọn qua các trang.
Phải chọn ít nhất một chẩn đoán và một mẫu; không suy ra chẩn đoán từ triệu chứng.
Preview hiển thị nội dung nguồn Việt, hỗ trợ sửa lựa chọn hoặc hủy trước xác nhận.
Sửa lựa chọn xóa preview và yêu cầu chọn/xem lại; xác nhận cần checkbox đã kiểm tra.
Thành công hiển thị kết quả đã công bố cùng tác giả ở workspace bác sĩ.

## API

Các route có prefix `/api/v2`, nằm sau Workflow:PrdV2Enabled.

- POST `/visits/{id}/examination/preview`: đúng PreviewExaminationInputV2, không
  cần key; trả ExaminationPreviewV2. Chỉ Doctor đúng Visit/phòng đang hoạt động,
  Visit/Journey Active, InConsultation, đúng một bước khám InProgress và không có
  order NotCompleted/Ordered. Kiểm tra version Visit, loại/Active/version của từng
  lựa chọn và mẫu nguồn vi. Mỗi nhóm tối đa 50 mục, không cho chọn trùng.
- Preview không ghi ClinicalRecord/SummaryVersion, không đổi Visit/Journey hoặc
  công bố nội dung. previewId là token Data Protection mã hóa/xác thực, **không
  phải GUID**; chứa Visit/doctor/input/version/fingerprint catalog và hạn 5 phút.
  Client coi token là chuỗi opaque, không parse/sửa. Key ring dùng cấu hình
  Data Protection hiện có; nhiều instance cần chia sẻ key ring/application name.
- POST `/visits/{id}/examination/complete`: chính xác `{version, previewId}`;
  key bắt buộc. Không nhận nội dung/tác giả hoặc trạng thái từ client. Kiểm tra
  quyền trước replay; trong transaction kiểm tra lại state/version, binding/expiry,
  catalog/mẫu Active/version và fingerprint cả nội dung trước khi ghi.
- GET `/visits/{id}/clinical-record`: chỉ chủ hồ sơ/Guest có grant hoặc bác sĩ
  phụ trách, trả ClinicalRecordV2 đã công bố hoặc JSON null trước xác nhận.
  Admin/Service/Cashier không đọc được. Không có API đọc preview theo Visit.

Token giả/sai binding/hết hạn hoặc danh mục/mẫu đổi trả 409 previewStale; version
cũ trả conflict; guard trạng thái trả requestLocked; payload lạ/thiếu/duplicate
lựa chọn trả 422. Cùng key/body trả receipt cũ, body khác/key cũ bị từ chối.
Khóa SQL CommandBus và khóa các bảng catalog trong capture giữ cấu hình ổn định
đến commit, bao gồm thay đổi trực tiếp từ tiến trình khác.

## Giao dịch xác nhận

Lưu ClinicalRecord với nội dung Việt đã xem, author thực tế, confirmedAt/publishedAt
UTC và snapshot mẫu; ClinicalSymptom/ClinicalDiagnosis lưu id/code/name/version/
kind/IsDemo tại xác nhận. Đánh Completed cho bước khám đang InProgress và Visit
ExamStatus; đặt ExaminationCompletedAt; tăng aggregate/Journey version, audit,
notification và receipt cùng giao dịch. Unique VisitId của PB-013 chặn nhiều record.
Lỗi bất kỳ rollback toàn bộ; race khác key chỉ một lệnh thành công.

WorkRevision và số phiếu được giữ nguyên. Workflow đánh giá Settlement Ready;
Visit/Journey vẫn Active, phòng được giải phóng cho bệnh nhân khác. Auto-close
legacy chỉ còn áp dụng cho Visit legacy; quyết toán V2 thuộc PB-015.

GET content legacy cho Visit V2 lấy kết quả ClinicalRecord đã công bố, không lấy
nháp/SummaryVersion cũ; trước công bố summary là null. Toàn bộ đường drafts V2
(đọc/tạo/publish) trả 410 trước CommandBus receipt. Progress/skip/queue/order/
settlement legacy đã có guard V2 và tiếp tục bị khóa. Lịch sử legacy vẫn hoạt động.

Không có migration hoặc dependency mới: dùng schema PB-013. Không lưu preview
trong database; không tự chỉnh nội dung lâm sàng lịch sử đã xác nhận. Các nhãn
form có đủ sáu locale, nội dung kết quả vẫn giữ nguồn vi.

## Kiểm chứng

Từ `codes/`, dùng SQL localhost/LocalDB và Windows authentication:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/complete-examination/run.ps1 -Regression -Capture
npm run typecheck
npm run lint
npm run test:languages:unit
```

Runner build/publish Release và tạo HospitalAcceptance mới; chạy API PB-014 và
browser desktop/Pixel 7 viewport; -Regression tạo database mới riêng cho từng suite
PB-013/012/011/010/008. Không ghi database demo/online; giữ fixture, dừng process và
khôi phục biến môi trường. -Capture lưu artifacts/*-pb014.png với dữ liệu tổng hợp.

API kiểm tra quyền/guard, payload, phân loại/version catalog, preview không lộ,
legacy bypass, token giả, stale catalog/template, rollback trigger, replay/race,
công bố ngay, snapshot không đổi sau sửa catalog và luồng dịch vụ → nhận lại →
kết thúc khám. Browser kiểm tra chọn → preview → sửa → preview → hủy → preview →
confirm; patient API không thấy nháp và thấy kết quả sau confirm.

CI có phase PB-014 API/browser riêng. Không thay các input/output của PB-001;
previewId là string theo hợp đồng. Các giới hạn môi trường/kết quả local ghi trong
task card; chưa thay thế nghiệm thu triển khai nhiều instance hoặc CI đầy đủ.

## PR đề xuất

`[PB-014] Xác nhận kết quả từ danh mục và kết thúc khám nguyên tử`

Doctor đang khám chọn danh mục và mẫu Việt, review/cancel/edit trước confirm.
Preview riêng tư có binding/expiry/config fingerprint; xác nhận lưu snapshot và
công bố cùng ExamStatus Completed, đưa Journey tới quyết toán và giải phóng ca.
Đóng đường drafts/publish legacy cho V2, giữ lịch sử cũ; bổ sung API/browser/race/
rollback tests và CI. Không có migration; PB-015 tiếp tục quyết toán cuối.
