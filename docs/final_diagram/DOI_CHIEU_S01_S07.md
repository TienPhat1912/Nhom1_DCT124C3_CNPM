# Đối chiếu chỉnh sửa S01–S07

Ngày kiểm kê: **14/11/2026**. Nhánh: `update_backlog`. Commit: `73d89fd7b1346f9f1f73fe86d1d7eb142d23d2c0`.

Đây là rà soát tài liệu tại thời điểm dự án đang phát triển, chưa phải nghiệm thu cuối. Chỉ sửa file Draw.io và bản đối chiếu này; không sửa mã ứng dụng, cấu hình hoặc dữ liệu. Không chạy kiểm thử ứng dụng. Bộ bàn giao vẫn gồm 9 file Draw.io, 31 trang, trong đó có 18 Activity.

| Mã | Trước | Sau |
| --- | --- | --- |
| S01 | AD-06 cho chọn điểm đầu thủ công và lặp lại khi không có tuyến | Bỏ hai đường quay lại chọn điểm đầu. Thiếu vị trí hoặc không có tuyến đều chuyển sang hướng dẫn chữ/thông tin điểm đến, cho phép yêu cầu hỗ trợ và kết thúc phiên. Đổi tuyến phải qua quyết định tìm được tuyến trước khi tiếp tục di chuyển. |
| S02 | P8 chưa đọc D1; không thể suy ra online từ phiên | Thêm kho D1 lặp và luồng D1 → P8. Ghi rõ LastSeenAt/heartbeat là phần thiết kế mục tiêu bổ sung vào D1, được ghi qua P1; thêm heartbeat vào đầu vào bệnh nhân ở ngữ cảnh và mức 0. P8 dùng TTL, trạng thái phiên và chống đếm trùng Account. Không khẳng định model hiện có dữ liệu này. |
| S03 | Ba DFD mô tả dịch vụ ngoài trả về cả âm thanh | Đổi tác nhân ngoài thành dịch văn bản; đầu ra/đầu vào chỉ là văn bản cần dịch và bản dịch. Mức 1 cung cấp văn bản hướng dẫn cho ứng dụng, nơi Web Speech API/expo-speech tạo âm thanh. |
| S04 | Toàn bộ UC-05 mở rộng UC-04 | Xóa cạnh UC-05 → UC-04 và nhãn riêng của cạnh đó. Giữ UC-06 mở rộng UC-04, ghi điểm mở rộng “Chỉ đường” và điều kiện bệnh nhân chọn Chỉ đường ở bước hiện tại. |
| S05 | Một số nhãn nằm ngoài khổ trang; tiêu đề D02 có Y âm | D01 rộng 2700; D04 trang 1 rộng 2450; DFD mức 0 rộng 4000, cao 2700 để chứa chú thích nguồn online. Tiêu đề D02 ở Y=5. Giữ tọa độ các khối nghiệp vụ cũ. |
| S06 | Quan hệ từ Nhân viên đến phòng/Visit thiếu giới hạn vai trò | Đặt nhãn “Phân công bác sĩ” và “Bác sĩ phụ trách”, giữ chú thích phân công phòng chỉ áp dụng cho bác sĩ. |
| S07 | D03 là mô hình rút gọn nhưng chưa dẫn chiếu đầy đủ; tên snapshot của DoctorOrder viết gộp chưa chính xác | Giữ 5 trang ERD rút gọn; ghi rõ lược bớt thuộc tính/đường FK và dẫn tới hai file EF Core. Đổi thành ServiceSnapshot, DestinationSnapshot, OrderedBySnapshot. Làm rõ SourceLanguage của AssistanceRequest là thuộc tính, không phải FK. |

## Căn cứ S07

Đối chiếu trực tiếp `codes/backend/Hospital.Api/Domain/Entities.cs` và `codes/backend/Hospital.Api/Infrastructure/HospitalDb.cs` ở commit trên, bao gồm:

- `Entity.Id` là PK Guid; `Version` là concurrency token; có `CreatedAt`.
- FK unique từ ReceptionRecord tới RegistrationRequest, Visit tới ReceptionRecord, ClinicalRecord tới Visit; quan hệ một–một Visit–PatientJourney và Visit–ExaminationTicket.
- `ClinicDoctor.DoctorId` unique; alternate key `(ClinicLocationId, DoctorId)`; `ClinicRoom.ClinicLocationId` unique và FK ghép tới membership cùng phòng.
- AccessGrant gắn Session–Visit; unique `(SessionId, VisitId)`.
- Các unique pair của StepDependency, StaffScope, ClinicalSymptom, ClinicalDiagnosis; FK ghép `(SymptomCatalogId, Kind)` của ClinicalSymptom.
- Unique phiếu theo phòng/ngày/số có filter cho dữ liệu mới; các trường nullable của dữ liệu legacy được giữ rõ.
- Filtered unique index giới hạn một Visit Active/InConsultation mỗi phòng và một DoctorOrder NotCompleted mỗi Visit.
- Các unique pair của ConsultationCall, TicketDailyCounter, WorkflowMapping, GuidanceTemplate, SummaryVersion, AuditEvent và CommandReceipt.
- Trạng thái Visit, PatientJourney, JourneyStep theo check constraint; ngôn ngữ gốc của ClinicalRecord/Template, FollowUp, GuidanceTemplate và HospitalRoute là `vi`.

ERD này không liệt kê toàn bộ cột, index, check constraint và đường FK của CSDL. Các nguồn EF Core trên là căn cứ đầy đủ; không dùng bản rút gọn như một sơ đồ database đầy đủ.

## Khác biệt phạm vi cần giữ rõ

S01 trong biên bản mới được áp dụng cho **luồng RTLS mục tiêu**. Backlog hiện tại PB-033/034/026 vẫn cho phép người trình bày đổi điểm đầu demo và giữ chế độ thủ công. Vì vậy, AD-06 không phải mô tả nguyên trạng chức năng demo. Không thay backlog hay mã nguồn để biến khác biệt này thành một tuyên bố đã triển khai.

LastSeenAt ở DFD là **thiết kế mục tiêu**, không phải cột đã có trong model hiện tại. Nơi lưu vật lý cuối cùng cần được cập nhật khi PB-028/029 chốt triển khai. Chưa có căn cứ để chứng nhận số online đã được tính đúng trong ứng dụng.

## Kiểm tra và giới hạn

Kiểm tra cấu trúc XML, ID và tham chiếu trên toàn bộ 31 trang; kiểm tra khả năng đi tới nhánh kết thúc của AD-06 và tọa độ các phần tử trong biên trang. Render cục bộ bằng thư viện viewer chính thức của Draw.io để rà nhãn và đường nối; hình kiểm tra chỉ ở thư mục tạm, không bàn giao PNG/SVG. Không tải nội dung sơ đồ lên dịch vụ ngoài.

Việc kiểm tra này không phải chứng nhận ứng dụng đáp ứng toàn bộ PRD và không thay thế bước mở/xem lại tài liệu trong diagrams.net trước khi đưa vào báo cáo cuối.
