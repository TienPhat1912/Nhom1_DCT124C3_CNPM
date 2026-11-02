# Hợp đồng API và bộ kết nối

Tài liệu máy đọc: `/openapi/v1.json`, snapshot trong `docs/architecture/openapi.json`. C# request records nằm cạnh endpoint; DTO TypeScript dùng chung trong `packages/shared/src/types.ts`, API client trong `api.ts`. DTO phản hồi hiện được duy trì thủ công; acceptance kiểm tra các luồng sử dụng chúng. Không khẳng định có schema-codegen toàn bộ phản hồi anonymous C#.

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
| Identity | `/api/auth/register`, `login`, `guest`, `session`, `profile`, `logout`, `link-claim`, `convert`, `recover` | Subject/claim hợp lệ; public register luôn Patient |
| External/booking | `/api/external/link`, `/api/appointments`, `/api/appointments/prepare`, `/api/requests/{id}/booking` | Chủ hồ sơ hoặc reception đã xác minh |
| Reception | `/api/requests`, `/{id}`, `/{id}/message`, `/{id}/confirm`, `/api/reception/scan`, `/api/reception/resources` | Chủ request/reception theo khoa |
| Ticket | `/api/visits/{id}/ticket`, `/reissue`, `/recovery`, `/api/tickets/redeem` | Chủ hồ sơ/guest grant hoặc reception |
| Journey | `/api/visits`, `/{id}`, `/{id}/orders`, `/orders/{orderId}`, `/steps/{stepId}/progress`, `/queue`, `/settlement`, `/pharmacy`, `/complete-guidance` | Vai trò + khoa/phân công; bệnh nhân chỉ bước hướng dẫn cuối |
| Doctor content | `/api/visits/{id}/drafts`, `/drafts/{draftId}/publish`, `/content`, `/follow-ups`, `/narration` | Bác sĩ phụ trách viết/duyệt nguồn Việt; chủ hồ sơ đọc bản gốc hoặc bản dịch khi truy xuất |
| Support | `/api/visits/{id}/navigation`, `/api/notifications`, `/api/assistance` | Quyền hồ sơ; Reception/Service xử lý hỗ trợ theo khoa |
| Administration | `/api/admin/configuration`, `/departments`, `/locations`, `/services`, `/mappings`, `/templates`, `/routes`, `/staff` | Admin; không tự cấp quyền bác sĩ công bố |

Xem OpenAPI để lấy verb, parameter và tên trường chính xác. API không chứa endpoint tính phí, thanh toán thật, chẩn đoán tự động hay xác nhận cấp phát thuốc.

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

`Visit: Active → Closed`. Guard: mọi Consultation/ReturnConsultation/Service/IntermediatePayment được giải quyết và FinalSettlementRevision bằng WorkRevision. Chỉ định mới/sửa/hủy tăng WorkRevision. Quyết toán Intermediate không là Final. NoPaymentRequired cũng phải qua guard chuyên môn.

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
