# PB-010 — Danh sách chờ và nhận ca khám

## Hành vi

Khi `Workflow:PrdV2Enabled=true`, workspace Doctor hiển thị các phòng đang phụ trách,
danh sách Waiting và một ca InConsultation hiện có. Doctor chọn bất kỳ bệnh nhân
đủ điều kiện, không bắt buộc FIFO. Thứ tự hiển thị theo ngày/số phiếu rồi Visit ID;
phân trang 100, lọc phòng/Doctor/trạng thái trước phân trang.

Nhận ca chuyển Visit Waiting → InConsultation, tăng ConsultationCount một lần,
đặt bước Consultation/ReturnConsultation Ready → InProgress và tăng version của
Visit/Journey/bước. Không đổi phiếu, ngày cấp, bác sĩ hoặc phòng. Audit,
notification, sự kiện gọi và command receipt commit trong cùng giao dịch.

Chưa triển khai chỉ định, hoàn tất dịch vụ/khám, quyết toán V2 hoặc tự phát TTS.
Các capability đó vẫn false. Các task tiếp theo sử dụng sự kiện/counter đã lưu;
không dùng lệnh progress legacy để giải phóng ca V2. UI legacy giữ nguyên khi tắt cờ.

## API runtime

Mọi endpoint mới dưới `/api/v2`, cờ tắt trả 503 workflowNotEnabled. Xác thực và
kiểm tra Origin/X-Hospital-Client dùng middleware hiện có.

| Endpoint | Kết quả/quyền |
|---|---|
| GET `/doctor/clinics` | Doctor; phòng có phân công hợp lệ hiện tại, không lấy từ roster |
| GET `/clinics/{clinicId}/queue?offset=0` | Doctor đúng phòng; `{clinicLocationId,currentVisitId,waiting[]}` |
| GET `/visits/{id}` | Access.Visit kiểm tra chủ hồ sơ/grant/nhân viên; Doctor kiểm tra phân công hoạt động hiện tại; dữ liệu V2 Captured |
| POST `/visits/{id}/consultations/accept` | Doctor đúng Visit/phòng; đúng một trường `{version:positiveInt}`; Idempotency-Key bắt buộc; trả VisitV2 |

Queue chỉ có Visit Active, Journey Active, đúng Doctor/phòng, ExamStatus Waiting;
currentVisitId là ca InConsultation. Version từng Visit được dùng khi nhận ca.
GET Visit tính canAcceptConsultation cho Doctor đúng quyền, Waiting, có bước khám
Ready và phòng trống; Patient/Guest không có capability nhận ca. Gợi ý này không
thay guard POST. Các phần đọc V2 khác vẫn thuộc task tương ứng; API legacy đọc
Journey tiếp tục dùng cho mobile và luồng chỉ dẫn PB-008/009.

Phân công hợp lệ gồm ClinicRoom.ActiveDoctorId, ClinicDoctor, Doctor Active,
Role=Doctor, có password hash, đúng StaffScope, Location/Department Active. POST
kiểm tra trước replay receipt và đọc lại trong transaction. Không nhận actor,
doctor, patient, clinic, status, snapshot, consultationNumber hoặc event ID từ client.
Không cho request JSON dư/lặp/sai kiểu. Sai quyền/phòng trả 403, version cũ hoặc
phòng bận/trạng thái không hợp lệ trả 409; input sai trả 422.

## Transaction, gọi khám và retry

CommandBus giữ transaction-owned SQL app lock `hospital:commands` xuyên tiến trình.
Lệnh đọc lại assignment/Visit, kiểm tra room busy và ghi các thay đổi trước commit.
Unique filtered index `UX_Visits_OneConsultationPerClinic` bảo vệ thêm ở database:
ClinicLocationId unique khi Status=Active và ExamStatus=InConsultation. Hai command
khác Visit trong cùng phòng chỉ một thành công; người còn lại nhận 409 clinicBusy.

ConsultationCall có ID riêng, VisitId, ClinicLocationId, DoctorId, ConsultationNumber,
ContentRevision và PayloadJson chứa ConsultationCallV2. Payload lưu nguyên snapshot
phiếu/phòng/bác sĩ từ thời điểm confirm, occurredAt UTC, contentRevision=1. Unique
(VisitId, ConsultationNumber), FK và check positive/JSON bảo vệ dữ liệu. Không có
endpoint sửa/xóa sự kiện hoặc phát âm thanh trong PB-010.

Retry cùng actor/Visit/key/body replay nguyên VisitV2 đã commit, cùng event ID và số
lần, không tạo audit/notification/call mới. Payload đổi với cùng key bị 409. Key mới
trên Visit đã InConsultation không tăng lần. Khi luồng sau đưa Visit trở về Waiting
với bước khám Ready, nhận lại tăng lần và tạo event mới, giữ phiếu gốc. API tests
dùng SQL fixture để mô phỏng bước sau; không cung cấp endpoint hoàn tất giả.

Nếu lưu event hoặc entity khác thất bại, transaction rollback cả count/status,
audit/notification/call và receipt; retry cùng key sau sửa lỗi có thể thành công.
Sự kiện chỉ đọc được qua GET sau commit. PB-023 chịu trách nhiệm transport/TTS và
chống phát lặp theo event ID, không dùng Visit.version làm ID gọi khám.

## Migration và rollback

Migration `20261113224433_DoctorConsultation` nối sau PB-007
`20261112200836_TicketNumberPerClinicDay`. Up kiểm tra trước: nếu có nhiều Active
InConsultation cùng phòng, SQL 51010 chặn, không sửa/xóa/đoán dữ liệu. Sau đó thêm
bảng event và unique index. Phiếu H-, ID và lịch sử có sẵn giữ nguyên.

Down chặn SQL 51011 nếu có event, tránh mất lịch sử gọi. Khi đã có sự kiện, rollback
ứng dụng và giữ schema; không xóa event để ép downgrade. Nếu chưa có event, Down
chỉ bỏ bảng/index PB-010. Dừng ghi khi migration, dùng kết nối đúng môi trường,
lấy snapshot mới nhất và phối hợp thứ tự migration với PB-013/028.

## Kiểm chứng local ngày 14/11/2026

Từ `codes/`, API/web cần database acceptance mới riêng, V2 bật; không dùng demo/online.
API tests cần API_URL, DEMO_PASSWORD, ACCEPTANCE_DB và SQL fixture local;
browser cần thêm WEB_URL. Migration test chỉ nhận server local và tự đổi database
thành `HospitalPB010_<guid>`. Windows CI đặt các biến từ LocalDB riêng.

| Lệnh | Kết quả |
|---|---|
| `node --test tests/api/doctor-accept.test.mjs` | PASS 5 test |
| `npx playwright test --config playwright.doctor.config.ts` | PASS 2 test: desktop + Pixel 7 viewport |
| `dotnet run --project tests/doctor-accept/DoctorAccept.Tests.csproj -c Release` | PASS 9 migration assertions; đặt PB010_SQL_CONNECTION |
| `dotnet run --project tests/core-schema/CoreSchema.Tests.csproj -c Release` | PASS 79 assertions trên model mới |
| `dotnet run --project tests/ticket-number/TicketNumber.Tests.csproj -c Release` | PASS 38 assertions hồi quy |
| `node --test tests/api/confirm-reception.test.mjs` | PASS 7 test hồi quy PB-008 trên schema mới |
| `dotnet build backend/Hospital.Api -c Release --no-restore` | PASS 0 warning/error |
| `dotnet-ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build` | PASS model/snapshot |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS |
| `npm run test:languages:unit` | PASS 3 test |

5 test API gồm role/phòng/input/version, chọn không FIFO, replay 8 request cùng key,
payload khác, race hai Visit, lần tiếp theo giữ phiếu, unique SQL độc lập, lỗi lưu
event rollback rồi retry, và replay sau thu hồi scope bị từ chối. Browser chọn bệnh
nhân tạo sau, xem ca hiện tại, nút ca khác disabled và reload giữ đúng ca/event.
Migration nâng cấp fixture xung đột bị chặn giữ ID/phiếu H-, sửa fixture rồi Up,
kiểm tra SQL unique và Down có event bị chặn giữ lịch sử.

Log ignored `.local/pb010-{api,browser,migration,core-regression,ticket-regression,
typecheck,lint,build,languages}.log`. Ảnh `artifacts/chromium-{desktop,mobile}-pb010.png`
chỉ chụp khi đặt PB010_CAPTURE=1; không biến screenshot thủ công thành gate CI.
CI có database riêng cho phase Doctor vì PB-008 cố ý giữ một ca InConsultation;
không sửa/xóa lịch sử fixture suite khác để mở phòng. API/browser có process riêng
để không dùng chung auth quota. Sau đó khôi phục kết nối/database của suite trước;
thêm migration test và giữ/khôi phục PB010_SQL_CONNECTION.

SQL thực tế local dùng Docker SQL Server riêng trên loopback. Chưa chạy workflow
GitHub Actions/Windows LocalDB trong phiên này; viewport mobile không phải native
Android. Chưa nghiệm thu TTS/transport gọi khám; thuộc PB-023. Không triển khai
clinical/settlement V2 của các task sau.
