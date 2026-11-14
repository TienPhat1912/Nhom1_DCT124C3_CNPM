# Hợp đồng API và bộ kết nối

Các mục đầu mô tả API legacy đang chạy. Phần [PB-001: hợp đồng PRD v2](#pb-001-hợp-đồng-prd-v2) ghi hợp đồng đích. PB-005 đã có quản trị phân công phòng, PB-006/PB-008 đã có yêu cầu và xác nhận tiếp nhận V2 dưới cờ Workflow:PrdV2Enabled mặc định tắt. Các nhóm V2 còn lại chờ task tương ứng.

PB-010 bổ sung queue theo phòng, lệnh accept consultation và sự kiện gọi bền vững;
xem [endpoint runtime, guard và migration PB-010](../requirements/PB-010-DOCTOR-ACCEPT.md).
GET VisitV2 phục vụ ca đang khám; capability được bật theo từng task triển khai.
Không coi namespace V2 là đã triển khai toàn bộ hợp đồng đích.

PB-011 bổ sung [preview và xác nhận một dịch vụ](../requirements/PB-011-SINGLE-ORDER.md).
ConfirmOrderInputV2 thêm previewId bắt buộc; canConfirmOrder đã được tính cho Doctor
đang khám. PB-012/014/015 bổ sung complete service/examination/settlement tương ứng.

PB-015 bổ sung [quyết toán cuối nguyên tử](../requirements/PB-015-FINAL-SETTLEMENT.md),
workspace Cashier và danh sách Visit đủ điều kiện; Patient thấy Closed/Completed
sau commit. Evaluate không tự đóng lượt khám từ quyết toán sớm trong dữ liệu cũ.

Tài liệu máy đọc: `/openapi/v1.json`, snapshot trong `docs/architecture/openapi.json`. C# request records nằm cạnh endpoint; DTO TypeScript dùng chung trong `packages/shared/src/types.ts`, API client trong `api.ts`. DTO phản hồi hiện được duy trì thủ công; acceptance kiểm tra các luồng sử dụng chúng. Không khẳng định có schema-codegen toàn bộ phản hồi anonymous C#.

PB-016 mở rộng `GET /api/visits/{id}/content` với visitId/examStatus/clinicalRecord,
khuyến nghị có original Việt và metadata dịch. V2 chỉ hiển thị sau xác nhận khám,
kể cả Visit Active; legacy giữ nguồn Published. bookingUrl trả null, web/mobile bỏ
booking handoff. Xem [hợp đồng và gate native PB-016](../requirements/PB-016-PATIENT-RESULTS.md).

## Quy ước

- Web dùng cookie `hospital_session` HttpOnly/SameSite Strict; bật Secure khi HTTPS. Native gửi `X-Client: native` lúc xác thực để nhận token và lưu SecureStore, sau đó gửi `Authorization: Bearer <token>`.
- Ghi `/api` yêu cầu `X-Hospital-Client: 1`; Origin nếu có phải khớp `Web:Origin` hoặc một địa chỉ trong `Web:AdditionalOrigins`. CORS dùng cùng danh sách tường minh, không tự tin cậy Host/Origin do client gửi. Header này là kiểm tra nguồn client/CSRF, không thay thế xác thực.
- Mutation nghiệp vụ yêu cầu `Idempotency-Key` 8–100 ký tự (UUID khuyến nghị). Retry giữ nguyên key và payload; đổi payload dùng key mới. Key cùng scope/payload trả kết quả trước; cùng key/payload khác trả 409. Không lưu credential trong command receipt; các lệnh cấp phiên/claim không cache kết quả.
- `version` là số concurrency của bản ghi; `workRevision` là thế hệ công việc của Visit. 409 → tải lại dữ liệu trước khi quyết định retry. Client không tự tăng trạng thái.
- Lỗi có `{title,status,detail,errors?,traceId}`. 401 phiên hết hạn; 403 phạm vi/quyền; 404 không tìm thấy; 409 xung đột; 410 QR hết hạn/thay thế; 422 dữ liệu/nghiệp vụ; 503/504 provider; 429 giới hạn xác thực. `errors` chứa tên trường và ràng buộc.
- Thời gian lưu UTC; client hiển thị Asia/Ho_Chi_Minh. Poll 5 giây khi đang dùng màn hình; abort/sequence loại phản hồi cũ, refresh khi online/focus, giữ bản đã tải với nhãn cũ khi mất mạng.
- Danh sách Visit và request (`GET /api/requests`) có `offset>=0`, `limit=1..100`, mặc định offset 0 và limit 100; luôn lọc quyền trước phân trang và sắp xếp theo `CreatedAt` giảm dần, rồi `Id` tăng dần. API tiếp tục trả mảng để tương thích với các client hiện có. Web/Android có nút Trang trước/Trang tiếp cho danh sách tiếp nhận; tạo phiếu mới đưa bệnh nhân về trang đầu. Hỗ trợ vẫn hiển thị 100 mục mới nhất, notification 50 mục mới nhất.

## Dashboard quản trị

`GET /api/admin/dashboard?days=7` chỉ cho vai trò Admin; `days` nhận 7 (mặc định) hoặc 30, giá trị khác trả 422. Chưa đăng nhập trả 401, vai trò khác trả 403. Phản hồi dùng DTO `AdminDashboardData`, chỉ chứa số liệu tổng hợp, không chứa danh tính bệnh nhân hoặc nội dung lâm sàng.

- `summary`: lượt khám được tiếp nhận hôm nay, lượt đóng hôm nay, tất cả Visit Active, request Submitted/NeedsInformation và hỗ trợ Open/Acknowledged chưa giải quyết.
- `daily`: đủ từng ngày trong khoảng chọn, gồm hôm nay; ngày không có hoạt động trả 0. Tiếp nhận tính theo CreatedAt, lượt đóng tính theo ClosedAt. Ngày thống kê theo giờ Việt Nam UTC+7, độc lập múi giờ máy chủ.
- `departments`: số lượt Active, bước Waiting/Ready, bước InProgress và hỗ trợ chưa giải quyết theo khoa. Bao gồm khoa đang hoạt động và khoa ngừng hoạt động còn công việc tồn đọng.
- `configuration`: số khoa, nhân viên, dịch vụ đang hoạt động và số dịch vụ thiếu mapping Published.

Khoảng 7/30 ngày chỉ áp dụng cho biểu đồ `daily`; các số liệu tồn đọng luôn phản ánh hiện tại. Frontend cập nhật mỗi 5 giây khi tab hiển thị, có tải lại thủ công, giữ số liệu lần cuối kèm thông báo lỗi khi mất kết nối. Không tạo hoặc sửa dữ liệu khi xem dashboard.

## Nhóm API

| Nhóm | Đường dẫn chính | Quyền |
|---|---|---|
| Entry/config | GET `/api/entry`, `/api/config` | Công khai, không tạo Visit |
| Identity | `/api/auth/register`, `login`, `guest`, `session`, `profile`, `logout`, `recover` | Subject/recovery hợp lệ; register luôn tạo Patient độc lập |
| External/booking | `/api/external/link`, `/api/appointments`, `/api/appointments/prepare`, `/api/requests/{id}/booking` | Chủ hồ sơ hoặc reception đã xác minh |
| Reception | `/api/requests`, `/{id}`, `/{id}/message`, `/{id}/confirm`, `/api/reception/scan`, `/api/reception/resources` | Chủ request/reception theo khoa |
| Ticket | `/api/visits/{id}/ticket`, `/reissue`, `/recovery`, `/api/tickets/redeem` | Chủ hồ sơ/guest grant hoặc reception |
| Journey | `/api/visits`, `/{id}`, `/{id}/orders`, `/orders/{orderId}`, `/steps/{stepId}/progress`, `/queue`, `/settlement`, `/pharmacy`, `/complete-guidance` | Vai trò + khoa/phân công; bệnh nhân chỉ bước hướng dẫn cuối |
| Doctor content | `/api/visits/{id}/drafts`, `/drafts/{draftId}/publish`, `/content`, `/follow-ups`, `/narration` | Bác sĩ phụ trách viết/duyệt nguồn Việt; chủ hồ sơ đọc bản gốc hoặc bản dịch khi truy xuất |
| Support | `/api/visits/{id}/navigation`, `/api/notifications`, `/api/assistance` | Quyền hồ sơ; Reception xử lý hỗ trợ theo khoa; Service không có quyền hỗ trợ |
| Administration | `/api/admin/configuration`, `/departments`, `/locations`, `/services`, `/mappings`, `/templates`, `/routes`, `/staff` | Admin; không tự cấp quyền bác sĩ công bố |
| Clinic assignments | GET `/api/v2/admin/clinics`, `/{id}/assignment`; PUT `/{id}/doctors`, `/{id}/active-doctor` | Admin, version phòng và guard Visit Active |

Xem OpenAPI để lấy verb, parameter và tên trường chính xác. API không chứa endpoint tính phí, thanh toán thật, chẩn đoán tự động hay xác nhận cấp phát thuốc.

PB-003: `POST /api/auth/link-claim` và `POST /api/auth/convert` đã ngừng, luôn trả
410 `guestLinkDisabled` (vẫn áp dụng kiểm tra Origin/client và rate limit chung).
Không nhận/xác thực credential hay sử dụng claim cũ, không tạo phiên, đổi PatientId,
chuyển grant hoặc ghi audit liên kết. Bảng LinkClaim và dữ liệu đã liên kết được giữ nguyên.
Đăng ký/đăng nhập độc lập không nhận lịch sử Guest, kể cả trùng tên/liên hệ;
Guest tiếp tục dùng quyền hiện có hoặc khôi phục bằng mã Reception đã xác minh.

`POST /api/requests/{id}/confirm` nhận `version`, `departmentId`, `locationId`,
`attendeeVerified`, `verificationNote`. API tự chọn bác sĩ Doctor đang hoạt động có quyền
tại khoa, phù hợp phòng khám theo dữ liệu cấu hình (hồ sơ ngoài nguồn nhập xét theo quyền khoa).
Ưu tiên thời điểm tạo hồ sơ, sau đó ID. Client không chọn hoặc ghi đè `doctorId`;
trường này vẫn có trong phản hồi Visit để hiển thị và kiểm soát quyền bác sĩ.
Không có ứng viên phù hợp trả 422 `doctorUnavailable` và giữ hồ sơ chưa xác nhận.
Xác nhận lại hồ sơ đã tiếp nhận trả Visit cũ, không phân công lại.

## Ngôn ngữ khi đọc dữ liệu

`language` trong query hoặc `X-Hospital-Language` chọn `vi`, `en`, `zh`, `ko`, `ja`, `ru`. API giữ nguyên tên người, mã và bản gốc; dịch các trường nội dung bệnh viện sau kiểm tra quyền. Dữ liệu lưu SQL là nguồn Việt, bản dịch chỉ được cache trong RAM. Tên hiển thị dùng `name`/`departmentName`, bản gốc dùng `nameVi`/`departmentNameVi`.

Phản hồi nội dung có ngôn ngữ thực tế, `requestedLanguage`, `fallback`, `translationStatus` và `contentKey`. Narration gửi `language`, `sourceRevision`, `contentKey` để bảo đảm phát đúng bản đang hiển thị. Lỗi dịch trả nội dung Việt với `fallback=true`; bản dịch thay đổi trả `409 sourceChanged` khi phát bản cũ. Endpoint nhập bản dịch riêng `/summaries/{summaryId}/translations` đã được loại bỏ. Chi tiết và migration: [LANGUAGES.md](../guides/LANGUAGES.md).

## State machine

`Visit: Active → Closed` trong luồng legacy chỉ xảy ra khi có lệnh Final/NoPaymentRequired
đủ điều kiện: mọi Consultation/ReturnConsultation/Service/IntermediatePayment được giải
quyết và FinalSettlementRevision bằng WorkRevision. Evaluate không tự đóng từ quyết
toán sớm đã lưu. Chỉ định mới/sửa/hủy tăng WorkRevision. Intermediate không đóng Visit.
NoPaymentRequired cũng phải qua guard chuyên môn. Điều kiện V2 nghiêm ngặt ở mục PB-001/PB-015.

`Journey: PendingActivation → Active → Completed`; khi không có nhà thuốc, đóng Visit có thể chuyển trực tiếp PendingActivation → Completed. Khi còn nhà thuốc, giữ PendingActivation/Active; bệnh nhân chỉ complete khi Visit Closed, Journey Active và còn đúng một bước Pharmacy Ready.

`Step: Waiting → Ready → InProgress → Completed`, có Completed trực tiếp từ Ready bởi actor hợp lệ. Service skip cần lý do; cancellation chỉ cho công việc chưa bắt đầu qua chỉ định. DAG chỉ cho phụ thuộc node trước và liên kết order-to-step được giữ khi sửa/hủy.

## Adapter và thay thế tích hợp thật

Interfaces trong `Integrations/Adapters.cs`: `IIdentityAdapter.Verify`, `IAppointmentAdapter.List/Lookup/BookingUrl`, `IOperationalAdapter.Validate`, `ISettlementAdapter.Validate`, `INarrationAdapter.ResolveProvider`.

Fixture có nguồn `Simulation`; nhân viên nhập sự kiện có nguồn `Staff`; workflow closure ghi `Workflow`. OperationalEvent mang source/eventId/visitId/stepId/status/version/reason; SettlementEvent có source/eventId/visitId/outcome/workRevision. Backend vẫn kiểm tra quyền và điều kiện chuyển trạng thái sau adapter. Không có webhook công khai chưa xác thực.

`Providers:FailureMode=None|Timeout|Unavailable`, `TimeoutSeconds=5` mặc định; acceptance dùng 1 giây. Timeout trả 504, unavailable 503; transaction không commit các chuyển trạng thái bị lỗi. Thay adapter bằng implementation sử dụng credentials từ secret store, xác thực source, map stable external IDs và cùng DTO/error semantics. Cần test contract với bệnh viện trước khi chuyển khỏi Simulation.

Narration trả text/language/sourceRevision/provider đã kiểm tra quyền; Web Speech/Expo Speech đọc đúng text. Manifest không phải file âm thanh được render trên server. Voice availability phụ thuộc thiết bị; không có audio thì vẫn xem văn bản.

## Dữ liệu, lưu giữ và bảo mật vận hành

Lưu thông tin tối thiểu cho tiếp nhận, hướng dẫn, tóm tắt do bác sĩ công bố và tham chiếu tài liệu; không nhập kết quả lâm sàng thô/hồ sơ pháp lý. Audit chứa actor/source/event/time và tham chiếu thay đổi, không log bearer, password hoặc payload QR.

Demo giữ dữ liệu cho tới khi người vận hành chủ động quản lý. Thời hạn truy cập guest 24 giờ không đồng nghĩa xóa hồ sơ. Chính sách triển khai dự kiến: guest không liên kết 90 ngày, guidance tài khoản 365 ngày; cần chủ dữ liệu xác nhận theo bối cảnh thực tế trước production. Chưa có job purge tự động; mọi xóa dữ liệu phải qua quy trình được phê duyệt, giữ toàn vẹn audit và dữ liệu bệnh viện nguồn.

DataProtection keys cần giữ bền vững cùng database để mở lại QR khi in. Compose lưu keys trong volume riêng. Backup cả SQL và key volume; không ghi private key/cookie/token vào artifacts dùng chia sẻ. API local dùng tài khoản SQL sa chỉ cho demo; production phải dùng tài khoản database riêng với quyền tối thiểu.

## PB-001: hợp đồng PRD v2

PB-005 đã triển khai phân công thành viên và bác sĩ đang hoạt động. Version 0
biểu thị Location chưa có ClinicRoom, doctorId=null bỏ lựa chọn khi đủ điều kiện.
API dùng được để chuẩn bị cấu hình trước khi bật V2. Cả bốn trạng thái khám của
Visit Active và Visit legacy liên quan đều khóa thay đổi. Khóa tài khoản bảo mật
có hiệu lực ngay và giữ phân công hiện tại. Chi tiết triển khai và kiểm thử nằm
trong [hướng dẫn phân công phòng PB-005](../requirements/PB-005-CLINIC-ASSIGNMENT.md).

PB-006 đã triển khai riêng nhóm yêu cầu tiếp nhận V2, mặc định tắt. Xem
[phạm vi thực thi, lỗi, migration và kiểm thử PB-006](../requirements/PB-006-REGISTRATION.md).
PB-008 đã triển khai xác nhận tiếp nhận. Các nhóm khám/quyết toán bên dưới là hợp đồng đích cho task tiếp theo.

Nguồn: [kế hoạch mục 4/6/7](../../../prd_v2/PRD-REVISION-PLAN.md), [PRD chính thức](../../../prd_v2/document/prd%20chinh%20thuc.docx), [quyết định](DECISIONS.md#pb-001-đối-chiếu-prd-v2). DTO trong [types.ts](../../packages/shared/src/types.ts) dùng hậu tố V2, riêng `ExamStatus` là kiểu trạng thái khám. Không thay trường bắt buộc hoặc ý nghĩa của DTO legacy.

### Máy trạng thái

`ExamStatus`: Waiting / InConsultation / InService / Completed. Nhãn tương ứng: Chờ khám / Đang khám / Đang thực hiện dịch vụ / Hoàn tất khám. Visit chỉ có Active/Closed; Journey v2 chỉ có Active/Completed. Order có NotCompleted/Completed. Step có Waiting/Ready/InProgress/Completed, không đại diện cho trạng thái khám toàn Visit.

| Lệnh | ExamStatus trước → sau | Visit / Journey sau commit | Thay đổi trong cùng giao dịch |
|---|---|---|---|
| Confirm reception | Chưa có → Waiting | Active / Active | Tạo Visit, Journey, phiếu, snapshot, grant Guest và Consultation Ready |
| Accept consultation | Waiting → InConsultation | Active / Active | Consultation/ReturnConsultation InProgress; tăng consultationCount, ghi một sự kiện gọi |
| Confirm order | InConsultation → InService | Active / Active | Hoàn tất vòng khám hiện tại, tạo đúng một order NotCompleted + Service Ready; nhả ca phòng |
| Complete service | InService → Waiting | Active / Active | Order/Service Completed; ReturnConsultation Ready về phòng/bác sĩ cũ, tự vào hàng chờ |
| Complete examination | InConsultation → Completed | Active / Active | Lưu/công bố kết quả, hoàn tất vòng khám, tạo Settlement Ready; nhả ca phòng |
| Final settlement | Completed → Completed | Closed / Completed | Ghi quyết toán và đóng Visit/Journey, hoàn tất Settlement; bước hiện tại null |

Ràng buộc: một Visit Active/Patient; một request Submitted/Patient; một ca InConsultation/phòng; một order NotCompleted/Visit. Doctor chọn bất kỳ người Waiting đủ điều kiện, không bắt buộc FIFO. Phòng bận vẫn nhận thêm người Waiting. A hoàn tất dịch vụ trở lại hàng chờ không được chiếm ca B đang khám. Bác sĩ phải nhận lại A trước chỉ định tiếp; cùng dịch vụ được chỉ định lại ở vòng sau. Không có nút bệnh nhân xác nhận đã về phòng, kích hoạt Journey hay lệnh chuyển bác sĩ.

Final và NoPaymentRequired đều yêu cầu Visit Active, ExamStatus Completed, kết quả đã xác nhận/công bố, tất cả order Completed, không còn bước chuyên môn chưa giải quyết và workRevision khớp. Lưu finalSettlementRevision=workRevision, outcome, thời điểm đóng và hoàn tất Journey nguyên tử. Thanh toán riêng lẻ không đóng Visit/Journey; không có nhà thuốc sau đóng trong luồng mới. Hoàn tất một vòng Consultation để đi dịch vụ không đồng nghĩa Completed toàn bộ khám.

### Quy ước DTO và quyền

- VisitSummaryV2 có `contractVersion:"prd-v2"`, phòng/bác sĩ cố định, phiếu, ba trạng thái, số lần khám, thời điểm hoàn tất/đóng. VisitV2 thêm steps/orders, latestConsultationCall, currentStepId/currentStep và capabilities. Khi Active có đúng một bước hiện tại khớp ID trong steps; khi Closed cả hai trường hiện tại null. Không suy bước hiện tại bằng phần tử đầu Completed.
- TicketNumberV2 duy nhất theo `(clinicLocationId, issuedOn, sequenceNumber)`; issuedOn là ngày Asia/Ho_Chi_Minh dạng YYYY-MM-DD, sequenceNumber tăng từ 1, number đệm tối thiểu 3 chữ số (001, 999, 1000). Bộ đếm được khóa/cập nhật cùng giao dịch cấp phiếu và có unique constraint; không dùng MAX+1 ngoài khóa. ID/ngày/số/snapshot không đổi khi in lại, qua ngày mới hoặc về từ dịch vụ. Phục hồi phải tra theo phòng/ngày/số, không chỉ 001.
- ExaminationTicketV2 chứa snapshot bệnh nhân, phòng và bác sĩ tại tiếp nhận; đổi profile/danh mục không sửa lịch sử. Chỉ chủ hồ sơ/Guest có grant hoặc Reception đúng phạm vi được đọc/in phiếu. Danh sách Visit và event gọi chỉ chứa TicketNumberV2, không chứa liên hệ bệnh nhân. Dữ liệu legacy thiếu snapshot vẫn đọc bằng DTO cũ, không giả dữ liệu lịch sử.
- ConsultationCallV2.id là event ID bền vững; consultationNumber bắt đầu 1 và tăng mỗi lần tiếp nhận thật. Retry giữ nguyên ID/số lần; lần khám tiếp có ID mới, vẫn cùng phiếu. contentRevision là phiên bản nội dung gọi, không phải Visit.version. Chỉ phát sau commit; PB-023 triển khai vận chuyển/chống phát lặp.
- ClinicAssignmentV2.version thay đổi khi sửa thành viên/bác sĩ hoạt động của phòng. Bác sĩ được chọn phải có tài khoản Doctor dùng được, thuộc phòng và khoa hợp lệ. canChangeDoctor và activeVisitCount do server tính; không suy bác sĩ hoạt động từ roster hoặc cờ Active của tài khoản.
- VisitCapabilitiesV2 do server tính theo người đọc, quyền và trạng thái hiện tại. Doctor phụ trách: accept/order/preview/complete; Service đúng khoa nơi thực hiện: completeService; Cashier đúng khoa Visit: settle; chủ hồ sơ/grant: xem kết quả đã công bố. Admin không có quyền đọc/công bố nội dung lâm sàng. canCompleteExamination là điều kiện tổng quát, confirm vẫn kiểm tra preview. Ẩn nút không thay kiểm tra backend.
- RegistrationRequestV2.departmentId là phạm vi xử lý server định tuyến, preferredDepartmentId chỉ là nguyện vọng. Patient và tên lấy từ phiên/hồ sơ đã xác định. Description giữ nguyên văn; sourceLanguage gắn lúc gửi. Không gộp Account/Guest theo liên hệ. NeedsInformation legacy phải được xử lý khi chuyển đổi, không tạo mới trong v2.

### Bảng lệnh

Tất cả path trong bảng có tiền tố **`/api/v2`**, là hợp đồng cho task triển khai tiếp theo. Giữ xác thực cookie/token, kiểm tra Origin và X-Hospital-Client: 1. Thành công trả snapshot sau SaveChanges/commit, gồm version mới. `key` trong bảng là header Idempotency-Key (8–100 ký tự, khuyến nghị UUID).

| Lệnh / task | HTTP; input → output | Quyền và guard | Version / key |
|---|---|---|---|
| Chọn bác sĩ / PB-005 | PUT `/admin/clinics/{id}/active-doctor`; SetActiveDoctorInputV2 → ClinicAssignmentV2, 200 | Admin; Doctor đúng phòng/khoa, dùng được; không thay phân công khi phòng/bác sĩ còn Visit Active | version phân công phòng; key bắt buộc |
| Thành viên phòng / PB-005 | PUT `/admin/clinics/{id}/doctors`; SetClinicDoctorsInputV2 → AdminClinicAssignment, 200 | Admin; một phòng/bác sĩ, tài khoản/khoa hợp lệ, khóa khi có Visit Active | version phòng, 0 khi chưa cấu hình; key bắt buộc |
| Gửi yêu cầu / PB-006 | POST `/requests`; RegistrationRequestInputV2 → RegistrationRequestV2, 201 | Patient Account/Guest; chưa có request pending hoặc Visit Active | Chưa có version; key bắt buộc, khóa theo Patient |
| Xác nhận tiếp nhận / PB-008 | POST `/requests/{id}/confirm`; ConfirmReceptionInputV2 → ConfirmReceptionResultV2, 200 | Reception đúng phạm vi request/phòng; đã xác minh; phòng/bác sĩ hợp lệ; Patient chưa có Visit Active | version request + clinicAssignmentVersion; key bắt buộc |
| Tiếp nhận và gọi khám / PB-010 | POST `/visits/{id}/consultations/accept`; AcceptConsultationInputV2 → VisitV2, 200 | Doctor đúng Visit/phòng; Waiting; phòng không có ca InConsultation | version Visit; key bắt buộc; khóa cả phòng |
| Xem trước chỉ định / PB-011 | POST `/visits/{id}/orders/preview`; PreviewOrderInputV2 → OrderPreviewV2, 200 | Doctor đang khám; một service/mapping/địa điểm đang dùng; chưa tạo order | version Visit; key bắt buộc, preview 5 phút |
| Xác nhận một chỉ định / PB-011 | POST `/visits/{id}/orders`; ConfirmOrderInputV2 → VisitV2, 200 | Doctor phụ trách; InConsultation; không còn order NotCompleted; preview gắn Visit/doctor/input/config chưa đổi | version Visit + previewId; key bắt buộc |
| Hoàn tất dịch vụ / PB-012 | POST `/visits/{id}/orders/{orderId}/complete`; CompleteServiceInputV2 → VisitV2, 200 | Service đúng khoa order; order thuộc Visit/bước hiện tại; InService và NotCompleted | version Visit + orderVersion; key bắt buộc |
| Danh sách dịch vụ / PB-012 | GET `/service/orders?status=NotCompleted&offset=0`; ServiceOrderWorkItemV2[], 200 | Service; phạm vi khoa của bước đã chốt; status NotCompleted/Completed, mặc định NotCompleted | 100 dòng/trang; snapshot phiếu/order, visitVersion, canComplete; Completed có người và giờ hoàn tất |
| Xem trước / PB-014 | POST `/visits/{id}/examination/preview`; PreviewExaminationInputV2 → ExaminationPreviewV2, 200 | Doctor phụ trách; InConsultation; không còn order chưa xong; danh mục/mẫu đang dùng, ít nhất một chẩn đoán | version Visit + version mỗi lựa chọn/mẫu; không cần key, không thay trạng thái/publish |
| Danh mục lâm sàng / PB-013 | GET `/clinical-catalog/{kind}?search=&offset=0`; ClinicalCatalogPageV2, 200 | Doctor; chỉ mục Active; kind symptoms/signs/diagnoses/templates | 100 mục/trang, lọc trước phân trang; nguồn Việt, có IsDemo |
| Quản trị danh mục / PB-013 | GET/POST `/admin/clinical-catalog/{kind}`; PUT `/admin/clinical-catalog/{kind}/{id}` | Admin; thêm/sửa/ngừng dùng, code ổn định, template nguồn vi | POST version 0; PUT current version; mutation cần key; audit before/after và receipt cùng transaction |
| Hoàn tất khám / PB-014 | POST `/visits/{id}/examination/complete`; CompleteExaminationInputV2 → CompleteExaminationResultV2, 200 | Guard như preview; preview khớp Visit/bác sĩ/lựa chọn/version danh mục/mẫu | version Visit + previewId; key bắt buộc |
| Quyết toán / PB-015 | POST `/visits/{id}/settlement`; FinalSettlementInputV2 → VisitV2, 200 | Cashier đúng khoa; đủ điều kiện quyết toán; chỉ Final hoặc NoPaymentRequired | version Visit + workRevision; key bắt buộc |
| Danh sách quyết toán / PB-015 | GET `/cashier/visits?offset=0`; VisitSummaryV2[], 200 | Cashier; chỉ Visit đủ điều kiện trong khoa được giao, lọc trước phân trang | 100 dòng/trang, thứ tự ExaminationCompletedAt rồi Id |

GET `/api/v2/visits` trả VisitSummaryV2[], GET `/api/v2/visits/{id}` trả VisitV2: lọc quyền theo chủ hồ sơ/grant hoặc vai trò/khoa/phân công trước phân trang. Service chỉ đọc Visit có order được giao; danh sách chờ của Doctor chỉ lấy Waiting đúng phòng/bác sĩ. GET `/api/v2/visits/{id}/ticket` trả ExaminationTicketV2; in lại bằng GET + in client, không cấp số mới. GET `/api/v2/requests/{id}` trả RegistrationRequestV2 cho chủ hồ sơ hoặc Reception đúng phạm vi. GET `/api/v2/admin/clinics/{id}/assignment` trả ClinicAssignmentV2 cho Admin. GET `/api/v2/visits/{id}/clinical-record` trả ClinicalRecordV2 hoặc null trước công bố, chỉ chủ hồ sơ/grant và Doctor phụ trách; Service/Cashier/Admin không đọc được. GET không cần key.

Backend phải dùng danh sách trường input cho phép và từ chối trường lạ bằng 422 validation. Không nhận actorId, authorId/name, patientId, role, permissions/capabilities, source, status/examStatus, số phiếu, timestamps hoặc nội dung công bố từ client. doctorId chỉ có trong lệnh Admin chọn bác sĩ, không trong confirm reception. TypeScript không thay validation JSON tại backend. attendeeVerified/verificationNote là xác nhận của Reception đã xác thực, không tự cấp quyền.

Preview riêng tư gắn Visit/version/bác sĩ/lựa chọn/version catalog/mẫu; chỉnh lựa chọn phải tạo preview mới, hủy không đổi nghiệp vụ. Confirm chỉ nhận previewId và version, server lấy nội dung đã kiểm chứng và kiểm tra lại catalog/mẫu. Không dùng text hoặc tác giả client gửi làm bản công bố. Snapshot ClinicalRecordV2 giữ lựa chọn, mẫu, nội dung Việt, tác giả thực tế và thời điểm xác nhận/công bố.

PB-014 triển khai previewId dạng chuỗi opaque Data Protection token mã hóa/xác thực, hạn 5 phút (không phải GUID). Token không lưu trong database; confirm kiểm tra fingerprint cả nội dung catalog/mẫu. GET clinical-record trả JSON null trước xác nhận; content V2 đọc ClinicalRecord đã công bố. Draft/publish legacy cho Visit V2 trả 410. Xem [bàn giao PB-014](../requirements/PB-014-COMPLETE-EXAMINATION.md).

### Version, idempotency và cạnh tranh

1. Scope receipt = contract version + actor từ session + tên lệnh + ID tài nguyên (create request dùng Patient). Hash gồm payload đã validation và version. Receipt và nghiệp vụ commit nguyên tử; không lưu token/grant secret. Kiểm tra xác thực/quyền hiện hành trước replay để không rò dữ liệu khi quyền đã bị thu hồi.
2. Kiểm tra receipt trước version/guard trạng thái: cùng key/payload trả nguyên status/body đã thành công, không tạo thêm phiếu/order/event/kết quả. Cùng key khác payload trả idempotencyConflict. Response replay có thể cũ, client refresh trước lệnh tiếp; capabilities trong đó không cấp quyền.
3. Key mới + version cũ trả conflict. Visit.version bảo vệ aggregate: thay bước/order/trạng thái/lần gọi/kết quả/quyết toán đều tăng; Journey/order có version riêng khi thay đổi. workRevision khởi tạo 1, tăng khi xác nhận order hoặc hoàn tất khám thay tập công việc; tiếp nhận khám và tiến độ dịch vụ không tăng. Không dùng workRevision thay version.
4. Giao dịch và unique constraints bảo vệ cả thao tác trên các ID khác nhau: hai bệnh nhân vào cùng phòng, hai request cùng Patient, hai cấp số cùng phòng/ngày, hai Admin đổi bác sĩ và confirm reception cạnh tranh đổi phân công. Có thể tái sử dụng application lock SQL hiện tại; guard phải kiểm tra lại trong transaction. Ánh xạ unique violation thành lỗi nghiệp vụ, không lộ SQL.
5. Timeout/mất response: retry cùng key/body. Conflict/guard lỗi: GET lại, người dùng quyết định lại rồi dùng key mới/version mới; không tự retry vô hạn. Thứ tự kiểm tra: auth/scope → validation → receipt → versions → guard. CompleteService sau kiểm tra version nhận orderAlreadyCompleted trước kiểm tra ExamStatus nếu order đã hoàn tất.

### Lỗi nghiệp vụ

Giữ envelope ApiProblem `{title,status,detail,errors?,traceId?}`; **title là mã máy**. ApiProblemV2 thêm existingRequestId/existingVisitId (chỉ nếu được đọc) và currentVersion tùy trường hợp. Không tiết lộ bệnh nhân đang chiếm phòng trong lỗi clinicBusy.

| HTTP | title | Tình huống |
|---|---|---|
| 401 / 403 / 404 | unauthorized / forbidden / notFound | Phiên không hợp lệ / sai quyền,khoa,bác sĩ / tài nguyên không tồn tại |
| 422 | validation | Trường thiếu/lạ, version không nguyên dương, nhiều service, key sai độ dài; errors theo trường |
| 409 | conflict / workRevisionConflict / idempotencyConflict | Entity version cũ / revision công việc khác / key trùng payload khác |
| 409 | pendingRequestExists / activeVisitExists / requestNotPending | Gửi trùng trả ID request/Visit được phép đọc; confirm đã xong bằng key mới trả requestNotPending và existingVisitId nếu được phép |
| 409 | clinicUnavailable / doctorUnavailable / clinicAssignmentChanged | Phòng ngừng dùng / chưa chọn hoặc khóa bác sĩ / cấu hình phòng khác phiên bản đã xem |
| 422 | doctorNotInClinic | Admin chọn sai Doctor/phòng/khoa |
| 409 | clinicHasActiveVisits / clinicBusy | Đổi phân công khi còn Visit Active / nhận ca thứ hai vào phòng |
| 409 | visitNotActive / invalidExamStatus / unfinishedOrderExists | Visit đã đóng / sai trạng thái nguồn / thêm order hoặc hoàn tất khám khi còn order chưa xong |
| 409 | orderAlreadyCompleted / orderImmutable / previewStale | Complete lại bằng key mới / sửa,hủy,bỏ qua chỉ định / preview sai hoặc cũ |
| 409 | examinationNotCompleted / servicesNotCompleted | Quyết toán khi khám chưa xong / còn order hoặc bước chuyên môn chưa giải quyết |
| 503 / 410 | workflowNotEnabled / legacyCommandDisabled | Luồng mới chưa bật / lệnh legacy đã bị ngừng trên dữ liệu v2 |

Nếu nhiều guard sai, lỗi version có ưu tiên: hai complete cùng version/key khác thường nhận conflict; sau GET version mới, complete lại nhận orderAlreadyCompleted. Provider 503/504 và rate limit 429 vẫn dùng envelope ApiProblem, không ép vào union BusinessErrorCodeV2.

### Ví dụ review API/UI

IDs dưới đây là ký hiệu minh họa; triển khai nhận UUID hợp lệ. Mọi mutation có X-Hospital-Client: 1, Content-Type: application/json và Idempotency-Key mới cho từng lệnh; retry giữ nguyên key. Response dưới là **trích trường**, không phải toàn DTO.

| Request | Body | Trích response |
|---|---|---|
| POST requests/r1/confirm | `{"version":3,"clinicLocationId":"room1","clinicAssignmentVersion":2,"attendeeVerified":true,"verificationNote":"Đã đối chiếu trực tiếp"}` | `visit:{contractVersion:prd-v2,version:1,status:Active,journeyStatus:Active,examStatus:Waiting,consultationCount:0}, ticket:{number:001,issuedOn:2026-11-11,sequenceNumber:1,clinicLocationId:room1}` |
| POST visits/v1/consultations/accept | `{"version":1}` | `version:2, examStatus:InConsultation, consultationCount:1, latestConsultationCall:{id:call1,consultationNumber:1}` |
| POST visits/v1/orders/preview | `{"version":2,"serviceId":"service1","note":""}` | `previewId:p1,visitVersion:2,service:{id:service1},destination:{...},expiresAt:<UTC>`; Visit không đổi |
| POST visits/v1/orders | `{"version":2,"serviceId":"service1","note":"","previewId":"p1"}` | `version:3, examStatus:InService, workRevision:2, orders:[{id:o1,version:1,status:NotCompleted}]` |
| POST visits/v1/orders/o1/complete | `{"version":3,"orderVersion":1}` | `version:4, examStatus:Waiting, currentStep:{kind:ReturnConsultation,destination:{id:room1}}, workRevision:2` |
| POST visits/v1/consultations/accept | `{"version":4}` | `version:5, examStatus:InConsultation, consultationCount:2, latestConsultationCall.id:call2` |
| POST visits/v1/examination/preview | `{"version":5,"symptomSelections":[],"signSelections":[],"diagnosisSelections":[{"id":"d1","version":1}],"template":{"id":"t1","version":2}}` | `previewId:p1, visitVersion:5, content:{language:vi,...}`; Visit không đổi |
| POST visits/v1/examination/complete | `{"version":5,"previewId":"p1"}` | `visit:{version:6,examStatus:Completed,status:Active,workRevision:3}, record:{author:{id:doctor1},publishedAt:<server UTC>}` |
| POST visits/v1/settlement | `{"version":6,"workRevision":3,"outcome":"NoPaymentRequired"}` | `version:7,status:Closed,journeyStatus:Completed,examStatus:Completed,finalSettlementRevision:3,currentStep:null,currentStepId:null` |

Có thể khám không dịch vụ: accept → preview → complete → settlement. Phiếu vẫn 001 và ngày cấp cũ kể cả khám tiếp vào ngày hôm sau. Retry accept lần đầu bằng cùng key/body trả call1/version 2; không gọi số lần nữa. Các mẫu TypeScript hợp lệ/không hợp lệ được biên dịch trong `tests/contracts/prd-v2.typecheck.ts`.

```json
{"title":"activeVisitExists","status":409,"detail":"Bệnh nhân đã có lượt khám đang hoạt động.","existingVisitId":"v1","traceId":"trace1"}
```

```json
{"title":"clinicBusy","status":409,"detail":"Phòng đang có bệnh nhân được khám.","traceId":"trace2"}
```

Ca review bắt buộc cho API/UI: hai tab nhận A/B chỉ một thành công; A đi dịch vụ nhả phòng; A về không chiếm ca B; nhận lại tạo call mới giữ phiếu; chưa nhận lại không chỉ định tiếp; stale preview không công bố; cả Final/NoPaymentRequired chặn quyết toán sớm; replay không tạo bản ghi trùng. PB-001 kiểm chứng hợp đồng bằng typecheck, không tuyên bố đã kiểm thử endpoint/race chưa tồn tại.

### DTO bổ trợ và cách triển khai từng phần

PB-017/018/019 dùng DescriptionTranslationV2: original/sourceLanguage/sourceVersion/targetLanguage luôn rõ; Translated có bản dịch, NotRequired cho vi→vi không giả bản dịch, Unavailable giữ bản gốc và fallback=true. Chỉ dịch khi Reception có quyền mở detail; không dịch submit/list. Cache phân biệt loại hồ sơ/ID/version hoặc hash/nguồn/đích, kiểm tra quyền trước cache. Nội dung lịch sử ko/ru vẫn đọc được, input mới dùng LocaleV2. Đường dịch nội dung bệnh viện Việt→ngôn ngữ bệnh nhân giữ hợp đồng riêng.

PB-028/029: POST `/api/v2/presence/heartbeat` không body/version/key, lấy session và giờ server, trả PresenceHeartbeatV2; gọi lại chỉ cập nhật hiện diện, không qua khóa nghiệp vụ. GET `/api/v2/admin/presence` chỉ Admin, trả OnlinePresenceV2 để thêm vào Dashboard đang có. Mặc định heartbeat foreground 15 giây, TTL 60 giây, Dashboard 5 giây. Account tính theo UserAccountId qua nhiều phiên, Guest theo session; loại revoked/expired/logout/quá TTL, total=accounts+guests. Không nhận userId/role client, không suy online từ expiresAt hoặc gộp Guest/Account.

PB-001 chỉ thêm type/tài liệu. Task tiếp theo dùng namespace `/api/v2`, cấu hình server dự kiến `Workflow:PrdV2Enabled=false`; route đã có nhưng chưa bật trả workflowNotEnabled, UI không hiện nửa luồng. Chỉ bật môi trường dùng chung sau PB-030/031 và API/web/mobile đồng bộ; các task trước đó kiểm thử trên database riêng. Discriminator prd-v2 không cho ép response legacy vào DTO mới.

Trước cutover phải xử lý dữ liệu cũ, constraints và chặn đường legacy phá quy tắc v2: progress/queue tổng quát, sửa/hủy/skip order, publish độc lập, quyết toán sớm, pharmacy/complete-guidance trả legacyCommandDisabled hoặc đi qua đúng guard mới. Deep link/redeem cũ chỉ mở hồ sơ sau kiểm tra quyền, không kích hoạt/chuyển trạng thái. Link-claim/convert ngừng theo PB-003, giữ Guest recovery. Không xóa lịch sử, đổi số phiếu cũ hoặc suy Completed từ SummaryVersion/bước khám cũ. OpenAPI cập nhật khi endpoint thật được triển khai.
# PB-008 — Xác nhận tiếp nhận V2 đã triển khai

`GET /api/v2/reception/clinics` và `POST /api/v2/requests/{id}/confirm` dùng
namespace V2 của PB-006, được bảo vệ bởi `Workflow:PrdV2Enabled`. Lệnh confirm nhận
`ConfirmReceptionInputV2` và Idempotency-Key, trả `{request, visit, ticket}`; tạo
Visit/Journey Active cùng phiếu và quyền Guest trong một transaction. Phiếu Captured
ở `GET /api/visits/{id}/ticket` trả snapshot V2 (không có QR), phiếu legacy vẫn giữ
hợp đồng cũ. Chi tiết quyền, retry, lỗi, rollout và kiểm chứng tại
[PB-008-CONFIRM-RECEPTION.md](../requirements/PB-008-CONFIRM-RECEPTION.md).
