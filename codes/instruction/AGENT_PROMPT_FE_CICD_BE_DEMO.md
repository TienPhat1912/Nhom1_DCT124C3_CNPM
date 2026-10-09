# Prompt triển khai từ PRD: FE hoàn chỉnh, CI/CD tái lập được, BE tối thiểu cho demo

Bạn là coding agent chịu trách nhiệm hoàn thiện repository của dự án **Multilingual Hospital Visit Narration and Guidance System**. Hãy đọc PRD và code hiện có, sau đó trực tiếp triển khai, chạy, kiểm thử và sửa lỗi đến khi có bản demo xuyên suốt. Không dừng ở việc lập kế hoạch, đề xuất kiến trúc hoặc tạo bộ khung.

## 1. Đầu vào và mục tiêu

Đầu vào gồm:

- `PRD_v3.docx`: bản PRD được cung cấp cùng yêu cầu này; bản đã chỉnh có Version 4.1 bên trong tài liệu. Tìm đúng tệp được người dùng giao, không chọn một PRD cũ hơn chỉ vì tên có số phiên bản lớn hơn.
- Repository hiện tại và các hướng dẫn dự án như `AGENTS.md`, `README`, tài liệu API, cấu hình môi trường, lockfile và pipeline đang có.
- `Hospital_Visit_Guidance_Diagrams (1).drawio`, nếu được cung cấp. PRD đã có các hình tương ứng; thiếu tệp draw.io riêng không phải lý do dừng triển khai.

Mục tiêu là **FE có chất lượng đủ để trình bày và tiếp tục phát triển, CI/CD thực thi được, BE gọn nhưng chạy thật và bảo toàn nghiệp vụ**. Phạm vi là bản demo phục vụ trình bày; không yêu cầu xây HIS hoàn chỉnh hay chứng nhận hệ thống để vận hành bệnh viện.

Thứ tự đối chiếu nội dung: yêu cầu hiện tại của người dùng → bản PRD được giao → hợp đồng và code đã có. Tuân thủ các chỉ dẫn hệ thống và hướng dẫn repository áp dụng. Nếu tài liệu và code khác nhau, ghi rõ khoảng cách; không tự bỏ yêu cầu để khớp code. Nếu PRD có mâu thuẫn ảnh hưởng luồng nghiệp vụ, chỉ ra các mục liên quan và hỏi đúng điểm cần quyết định, đồng thời tiếp tục phần không bị ảnh hưởng.

Yêu cầu phạm vi của người dùng:

1. Hoàn thiện cả **patient web bằng React** và **patient app bằng React Native**, cùng web dành cho tiếp nhận, bác sĩ, nhân viên dịch vụ, thu ngân và quản trị.
2. Làm giao diện, tương tác, trạng thái lỗi, khả năng truy cập, bản địa hóa, tích hợp API và kiểm thử nghiêm túc. Giao diện phải sử dụng được trên luồng thật.
3. Xây CI cho kiểm tra và build; xây CD cho việc triển khai web/API và tạo, phân phối bản mobile trong môi trường demo được cấu hình.
4. BE chỉ xây phần cần để các màn hình và luồng trong PRD hoạt động. Dùng adapter mô phỏng cho tích hợp bệnh viện bên ngoài khi chưa có dịch vụ thật.
5. Không âm thầm bỏ một kênh, vai trò hay chức năng đã có trong PRD. Phân biệt rõ thứ tự triển khai với việc cắt phạm vi.

## 2. Khảo sát trước khi sửa code

Đọc toàn bộ PRD, bao gồm nội dung bảng. Chú ý Chương 2; mục 3.8, 3.10–3.16; Chương 4 và đủ UC-01 đến UC-21 trong Chương 5. Nếu công cụ không đọc được DOCX, dùng công cụ trích xuất có sẵn để đọc cả đoạn văn và bảng. Không tuyên bố đã đọc các phần chưa truy cập được.

Sau đó:

- Kiểm tra Git status, cấu trúc repo, ứng dụng đang có, framework, phiên bản runtime, package manager, DB, API, auth và các workflow. Giữ nguyên thay đổi chưa commit của người dùng.
- Chạy các lệnh kiểm tra hiện có để xác định lỗi nền, trước khi quy lỗi cho phần mới.
- Lập bảng `Requirement/UC → màn hình → API/quy tắc BE → cách xác minh → trạng thái`. Bao phủ từng FR, NFR và điều kiện chấp nhận US liên quan; lấy ID nguyên văn từ PRD, không tự đánh lại mã.
- Ghi nhận phần đã chạy được, phần còn thiếu, phần tích hợp đang mô phỏng và blocker thực tế.
- Chọn kiến trúc nhỏ nhất đáp ứng yêu cầu. Nêu kế hoạch ngắn rồi bắt đầu sửa code trong cùng lượt làm việc.

Các quyết định kỹ thuật còn mở được xử lý bằng mặc định bên dưới và ghi lại trong tài liệu triển khai. Không hỏi lại các lựa chọn nhỏ như tên component, màu sắc hoặc cách chia thư mục. Chỉ cần người dùng quyết định khi thay đổi nghiệp vụ, thiếu đầu vào thiết yếu hoặc cần quyền/tài nguyên bên ngoài chưa được cấp.

## 3. Kiến trúc và giới hạn độ phức tạp

Ưu tiên stack đang hoạt động trong repo. Không thay framework, ORM, package manager hoặc tổ chức toàn bộ repo chỉ để khớp sở thích cá nhân. Không nâng cấp hàng loạt dependency không liên quan.

Nếu repo chưa có nền tảng phù hợp, dùng mặc định sau và ghi rõ đây là lựa chọn triển khai, không phải yêu cầu bổ sung của PRD:

| Phần | Mặc định |
| --- | --- |
| Web | React + TypeScript; một ứng dụng với route/layout theo vai trò; công cụ build nhẹ như Vite nếu không có lựa chọn sẵn |
| Mobile | React Native + TypeScript; Expo nếu phù hợp với repo và thư viện cần dùng; giữ bare React Native nếu repo đã dùng ổn định |
| Chia sẻ giữa hai FE | API types/client, quy tắc validation phù hợp, tài nguyên ngôn ngữ, định dạng dữ liệu; component DOM và Native tách khi cần |
| BE mới | ASP.NET Core Web API/Minimal APIs, một ứng dụng triển khai, chia module theo nghiệp vụ; nếu BE hiện có dùng stack khác và đáp ứng được thì tiếp tục hoàn thiện nó |
| DB demo mới | SQLite lưu trên ổ đĩa/volume cho một API instance; dùng DB hiện có nếu repo đã cấu hình; không dùng DB in-memory làm nơi lưu chính |
| Cập nhật trạng thái | Polling có kiểm soát nếu chưa có SSE/WebSocket: làm mới sau mutation, khi quay lại ứng dụng và khi kết nối phục hồi |
| Local demo | Docker Compose cho web/API/DB phù hợp, kèm cách chạy trực tiếp phục vụ phát triển |
| Pipeline | Dùng nền tảng CI sẵn có; nếu repo dùng GitHub và chưa có pipeline thì dùng GitHub Actions |

Chọn phiên bản còn được hỗ trợ và tương thích tại thời điểm triển khai; xác minh bằng tài liệu chính thức. Khóa dependency và runtime bằng cơ chế của stack. Không dùng `latest` trôi nổi cho build/release.

Không thêm microservices, Kubernetes, message broker, event sourcing, hệ thống thanh toán thật, chatbot chẩn đoán hay workflow designer tổng quát. Một BE triển khai được, có service nghiệp vụ và transaction rõ ràng là đủ.

Nếu cần tổ chức mới, có thể dùng `apps/web`, `apps/mobile`, `services/api`, `packages/contracts`, `packages/i18n`, `docs`, `scripts` và thư mục workflow. Đây là gợi ý; thích nghi với cấu trúc hiện tại, không di chuyển file hàng loạt không cần thiết.

## 4. Các quy tắc nghiệp vụ không được làm sai

Đối chiếu BR-01 đến BR-25 và mục 3.10. Các điểm dưới đây là ràng buộc cốt lõi, không thay cho việc đọc đầy đủ PRD:

1. Có đúng hai kênh bệnh nhân: app và patient web. Guest là chế độ truy cập, không phải kênh thứ ba.
2. Có ba loại QR khác nhau: QR vào hệ thống của bệnh viện; QR tiếp nhận gắn appointment/request; QR trên phiếu khám gắn Visit đã tồn tại. Phân biệt bằng purpose và kiểm tra ở server.
3. Mở QR bệnh viện, đăng nhập, chọn lịch hẹn hoặc gửi yêu cầu walk-in **không tạo Visit**. Tiếp nhận xác nhận và phát hành phiếu khám mới tạo một Active Visit, một Pending Activation Journey và phiếu khám trong một thao tác nhất quán.
4. Gửi lại xác nhận, in lại phiếu hoặc quét lại QR không tạo bản ghi trùng. Quét QR phiếu khám chỉ kích hoạt/tiếp tục Journey đã có sau khi xác minh quyền.
5. Visit chỉ có Active/Closed. Journey có Pending Activation/Active/Completed. Trạng thái bước gồm Waiting, Ready, In Progress, Completed, Skipped, Cancelled. Không gộp các trạng thái này vào một cờ `completed`.
6. Chỉ đóng Visit khi các công việc khám/dịch vụ bắt buộc đã được giải quyết **và** final settlement áp dụng cho công việc hiện tại đã được xác nhận, hoặc có kết quả no-payment-required hợp lệ. Intermediate payment không đóng Visit.
7. Nếu xác nhận thanh toán cuối đến sớm, giữ sự kiện nhưng chưa đóng Visit. Khi điều kiện lâm sàng thay đổi, đánh giá lại. Thêm/sửa công việc bắt buộc phải đánh giá lại hiệu lực settlement hiện tại.
8. Visit Closed vẫn có thể có Journey chưa hoàn tất để hướng dẫn nhà thuốc. Nếu còn nhà thuốc, việc đóng Visit không tự kích hoạt Pending Activation Journey. Nếu không còn nhà thuốc, Journey hoàn tất tự động khi Visit đóng hợp lệ.
9. Bệnh nhân chỉ được xác nhận bước hướng dẫn nhà thuốc cuối cùng đủ điều kiện sau khi Visit đóng và Journey đã được kích hoạt. Không tự xác nhận khám, xét nghiệm, chẩn đoán hình ảnh hoặc thanh toán. Đây không phải xác nhận phát thuốc chính thức; không thêm nhiệm vụ cho dược sĩ chỉ để kết thúc Journey.
10. Doctor Order phải dùng mapping đã được xác thực, giữ liên kết order–step và dependency. Thiếu mapping phải từ chối trước khi lưu hiệu lực nghiệp vụ. Không tạo route giả. Không reset bước đã hoàn thành khi thay đổi order.
11. Nội dung chẩn đoán, giải thích và dặn dò đến từ bác sĩ có quyền. Draft không được lộ cho bệnh nhân. Published có thể xem ngay, độc lập với thanh toán, trạng thái Journey và khuyến nghị tái khám. Sửa bản đã công bố phải tạo version mới.
12. Bản dịch nội dung y tế phải được phê duyệt và gắn đúng source version. TTS chỉ đọc nội dung được phép; không tự viết lại chẩn đoán hoặc dặn dò bằng AI.
13. Guest được lưu dữ liệu trên server trước khi tạo tài khoản. Chuyển guest sang tài khoản phải xác minh guest và tài khoản đích, giữ nguyên patient/Visit/Journey/content links, chống replay và quay lại đúng ngữ cảnh. Không tin một Visit ID do client cung cấp.
14. Đóng trình duyệt, reload, hết hạn session, đổi ngôn ngữ hoặc đăng ký tài khoản không làm mất hay tự hoàn tất Journey. Hết hạn chỉ làm mất quyền truy cập cho đến khi được khôi phục hợp lệ.
15. Tái khám là một lượt đến mới sau tiếp nhận mới. Khuyến nghị tái khám không phải một appointment đã đặt. Không mở lại Visit cũ để làm lượt khám mới.
16. BE luôn kiểm tra role, patient ownership/guest grant và staff scope. Ẩn nút ở FE không thay cho kiểm tra quyền. Quyền Administrator riêng lẻ không được công bố chẩn đoán thay bác sĩ.

## 5. BE tối thiểu nhưng phải chạy thật

### 5.1. Phần phải thực thi thực sự

- Auth/session cho bệnh nhân và tài khoản nhân viên được seed; guest session/grant; phân quyền theo đối tượng và phạm vi công việc. Không cấp role Doctor/Admin từ form đăng ký bệnh nhân.
- Registration Request, supplement, nguồn tiếp nhận booked/walk-in, xác nhận tiếp nhận, phiếu khám và QR đúng purpose.
- Visit, Journey, steps, dependencies, order–step links; tính `nextAction` và `allowedActions` theo dữ liệu xác nhận ở server.
- Các thao tác bác sĩ, nhân viên dịch vụ, thu ngân và hoàn tất hướng dẫn nhà thuốc đúng quyền và đúng guard.
- Nội dung Draft/Published, version và bản dịch được duyệt; lịch sử được phân quyền; recommendation tái khám tách biệt.
- Assistance và in-app notifications; queue với thời điểm cập nhật; cấu hình địa điểm, dịch vụ, mapping, template và staff scope cần cho FE quản trị.
- Guest conversion có lưu bền vững, idempotency cho thao tác quan trọng và dữ liệu khôi phục sau restart.

Có thể giản lược cách lưu các entity phụ, nhưng phải giữ quan hệ, ID, trạng thái và tính toàn vẹn của các luồng cần demo. Không mặc định bỏ dữ liệu chỉ vì không cần hiển thị ở màn hình đầu tiên.

### 5.2. Phần có thể mô phỏng có kiểm soát

External identity/appointment source, queue/service/settlement integration, booking handoff và nhà cung cấp TTS/push có thể dùng adapter với fixture xác định trước. Adapter cần cùng cấu trúc đầu vào/đầu ra, timeout và lỗi như hợp đồng đã định; không ghi trực tiếp trạng thái cuối bỏ qua domain service.

Ví dụ: fixture cung cấp appointment đã xác minh; receptionist vẫn phải xác nhận tiếp nhận. Cashier có thể nhập kết quả settlement giả lập trong workspace; BE vẫn kiểm tra quyền và điều kiện đóng Visit. Provider giả lập trả lỗi TTS; FE vẫn hiển thị nội dung đọc được.

Chỉ dùng dữ liệu tổng hợp. Nếu có demo panel, đặt ở khu vực hỗ trợ demo hoặc công cụ quản trị riêng, bảo vệ bằng môi trường/quyền thích hợp và ghi rõ trong runbook. Không để các nút “force complete”, “switch role” hoặc “bypass auth” lẫn vào trải nghiệm bệnh nhân.

### 5.3. API, persistence và tính nhất quán

- Thiết kế API theo thao tác nghiệp vụ; dùng DTO rõ ràng, validation ở server và tài liệu OpenAPI hoặc hợp đồng tương đương. Không chỉ cung cấp CRUD cho phép client tự đặt mọi status.
- Read model của Journey tối thiểu có ID ổn định, Visit status, Journey status, step hiện tại, next action, destination, wait/proceed, queue timestamp, allowed actions và version cần thiết. Content trả author, publishedAt, sourceVersion, actualLanguage và fallback state.
- Chuẩn hóa lỗi validation, unauthenticated, denied, expired code, conflict, invalid transition và unavailable provider. FE phải phân biệt được nguyên nhân và hành động phục hồi; không trả HTTP 200 cho thất bại nghiệp vụ.
- Reception confirmation, order updates, settlement events và account linking dùng transaction phù hợp. Có unique constraint và cơ chế idempotency/concurrency đủ để hai request đồng thời không tạo hai Visit, ticket hoặc bộ step trùng.
- Ghi event ID/source/actor/time, reason và version khi cần. Không log mật khẩu, token, mã QR có thể redeem hoặc nội dung lâm sàng không cần thiết.
- Có migration, seed tái lập được và dữ liệu vẫn tồn tại sau restart. Reset demo phải là thao tác rõ ràng, giới hạn môi trường; không reset DB mỗi lần ứng dụng khởi động.
- Tách liveness/readiness nếu cần để CD biết API sống và DB truy cập được. Định dạng lỗi phải nhất quán ở lỗi bất ngờ, không trả stack trace cho client.

### 5.4. Session và dữ liệu nhạy cảm

Dùng cơ chế auth của framework/thư viện được duy trì; không tự viết thuật toán mật mã. Web ưu tiên cookie HttpOnly với Secure khi chạy HTTPS, SameSite và chống CSRF phù hợp; nếu dùng cơ chế khác, giải thích lựa chọn. Mobile dùng storage an toàn của nền tảng cho credential dài hạn. Không lưu bí mật trong frontend bundle hoặc dùng localStorage làm nơi cất mật khẩu/refresh token.

Guest grant và QR token cần đủ ngẫu nhiên, có purpose/expiry và kiểm tra claimant. Token không được thay thế bằng ID tuần tự hoặc chuỗi encode Visit ID. Sau account linking thành công phải chuyển/thu hồi quyền guest theo chính sách và làm mới session an toàn. Ghi chính sách expiry/retention của demo, thời hạn cấu hình và cách recovery.

## 6. FE phải hoàn thiện theo nhóm màn hình

Bao phủ các nhóm trong mục 3.12. Có thể gộp page/tab/modal hợp lý, nhưng mỗi thao tác phải có route, dữ liệu và kết quả thực sự.

| Mã | Các màn hình và tương tác phải dùng được |
| --- | --- |
| FE-P01 | Chọn VI/EN trước auth; Sign in/Register/Continue as guest rõ ràng; tái sử dụng session; profile với các trường được phép sửa |
| FE-P02 | Liên kết/lấy appointment qua adapter, chọn lịch; walk-in form; hiển thị reception QR; trạng thái xử lý; nhận câu hỏi và bổ sung vào cùng request |
| FE-P03 | Mở/quét/nhập mã phiếu khám; kiểm tra access; màn hình invalid/expired/wrong purpose; hướng dẫn đăng nhập hoặc staff recovery; giữ return target |
| FE-P04 | Một màn hình rõ Visit status và Journey status; bước hiện tại; việc cần làm tiếp; địa điểm; chờ/di chuyển; queue và thời điểm cập nhật; hoàn tất nhà thuốc khi đủ điều kiện |
| FE-P05 | Đọc/nghe/phát lại/dừng; chỉ đường hoặc khoa/tầng/phòng khi thiếu route; chọn điểm bắt đầu khi cần; yêu cầu hỗ trợ và theo dõi trạng thái; in-app notifications |
| FE-P06 | Lịch sử và chi tiết Visit được phép truy cập; chẩn đoán/giải thích, dặn dò và follow-up tách biệt; hiển thị author/version/time/language; guest linking và quay lại đúng ngữ cảnh |
| FE-R01 | Quét QR hoặc tra mã; xác minh nguồn/attendee; xem request; gửi câu hỏi theo template; chọn khoa/dịch vụ; xác nhận; phiếu khám in được và in lại cùng ticket; recovery có kiểm tra |
| FE-D01 | Danh sách Visit được giao; chi tiết; thêm/sửa/hủy order hợp lệ; consultation progress; Draft, xem trước, Publish, correction version; follow-up riêng |
| FE-S01 | Danh sách dịch vụ theo scope; bắt đầu/hoàn tất công việc; queue events; tiếp nhận, xử lý và giải quyết assistance có quyền |
| FE-C01 | Chọn Visit; xem điều kiện còn thiếu; intermediate/final/no-payment-required; gửi một thao tác rõ ràng; hiển thị kết quả server có đóng Visit hay chưa và lý do |
| FE-A01 | Quản lý địa điểm, dịch vụ, mapping/dependency, template/VI-EN/publication và staff scope; có validation và chống phá tham chiếu lịch sử; không tự có quyền Publish clinical content |

Đối với patient app, triển khai các chức năng tương ứng FE-P01–P06 bằng Native UI. Không coi việc chạy patient web trên viewport nhỏ hoặc nhúng toàn bộ web trong WebView là hoàn thành React Native.

### 6.1. Thiết kế giao diện

- Xây một design system gọn: typography, màu, spacing, radius, elevation, form controls, button, badge, alert, dialog, table/list và empty/loading/error states.
- Giao diện phù hợp bối cảnh bệnh viện: dễ đọc, ít nhiễu, thứ tự hành động rõ. Mỗi trạng thái có nhãn chữ; không chỉ dựa vào màu. Dùng ngôn ngữ dành cho người sử dụng, không lộ ID kỹ thuật, tên enum, JSON hay chú thích triển khai nếu không cần cho công việc.
- Tách layout bệnh nhân và layout nhân viên; navigation thể hiện vai trò. Không thêm dashboard trang trí, thống kê hoặc tính năng marketing ngoài phạm vi.
- Responsive patient web và workspace nội bộ; bảng có phương án trên màn hình nhỏ. Kiểm tra ít nhất một viewport điện thoại, một tablet và một desktop, ghi kích thước thực tế.
- Có label, focus rõ, thao tác bàn phím, quản lý focus của dialog, tên truy cập cho icon button, thông báo validation phù hợp. Kiểm tra phóng to chữ và độ tương phản.
- Từ Journey, Listen, Navigate, Request Assistance đều phải đạt được trong tối đa hai tương tác.
- Bản in phiếu khám có layout riêng: thông tin đủ dùng, mã phiếu và QR rõ, không in navigation/sidebar. Không encode thông tin cá nhân/lâm sàng trong QR.

### 6.2. Form, state và tích hợp API

- Xác định trường, requiredness, giới hạn và lỗi cho từng form trước khi code. Trường chưa được PRD chốt có thể dùng cấu hình demo tối thiểu và phải ghi lại; không tự bắt nhập nhiều thông tin nhạy cảm.
- Tách server state với UI state. Dùng giải pháp đang có; nếu thêm thư viện thì chọn một cách nhất quán cho request/cache và form validation. Không rải `fetch`, token logic và xử lý lỗi lặp lại trong mọi component.
- Mỗi màn hình chính có loading, empty, ready, error/retry. Màn hình có quyền có thêm denied và expired. Mất mạng hiển thị dữ liệu xác nhận gần nhất cùng thời gian/stale indicator nếu policy cho phép.
- Chỉ báo thành công sau response xác nhận của server. Chặn double submit ở UI và dựa vào idempotency ở BE. Không optimistic-complete cho khám, thanh toán, đóng Visit hoặc công bố nội dung.
- Refresh sau mutation/reconnect/resume; xử lý conflict bằng tải lại bản hiện tại. Hủy/bỏ qua response cũ khi đổi Visit, tài khoản, ngôn ngữ hoặc content version. Không để dữ liệu bệnh nhân trước xuất hiện trong session sau.
- Route guard phục vụ UX, không thay authorization. Return target qua login/linking phải được kiểm tra để tránh điều hướng đến URL tùy ý; phân biệt nguồn QR.
- Giữ bản nháp nhập liệu phù hợp khi lỗi mạng; xóa cache nhạy cảm khi logout/đổi ngữ cảnh theo policy. Không xây offline mutation queue cho thao tác lâm sàng hoặc settlement.

### 6.3. Đa ngôn ngữ, TTS, QR và mobile

- Tách UI translations khỏi approved operational/clinical content. VI và EN phải bao phủ toàn bộ kịch bản nghiệm thu chính; không chỉ dịch menu.
- Fallback đúng PRD: ngôn ngữ được chọn đã phê duyệt → English đã phê duyệt → nguồn Vietnamese nếu có; nếu không, hiển thị nguồn gốc được phép với nhãn ngôn ngữ và trợ giúp. Không dùng bản dịch tự sinh chưa được duyệt làm nội dung y tế hiện hành.
- TTS có Play/Stop/Replay riêng cho chẩn đoán/giải thích và dặn dò. Gắn playback/cache với content ID + source version + language. Đổi nội dung/version/ngôn ngữ phải dừng bản đang phát cũ.
- Có thể dùng TTS của nền tảng qua adapter nếu phù hợp. Kiểm tra voice/language thực sự hỗ trợ; khi thiếu voice hoặc provider lỗi vẫn đọc được text và có hành động retry. Không ghi nhận phát âm thành công khi chưa chạy được.
- QR phải scan được khi môi trường có camera; xử lý permission denied/unavailable. Cung cấp tra/nhập mã thay thế phục vụ người dùng và demo, đi qua cùng kiểm tra backend, không dùng đường tắt bỏ xác minh.
- Deep link giữ purpose và target; có web fallback. Nếu chưa có domain/association/signing cần thiết, hoàn thiện cấu hình và kiểm thử phần làm được, ghi rõ phần liên kết app nào chưa được xác minh.
- Mobile xử lý safe area, bàn phím, nút Back, app background/resume, session restoration và text scaling. API base URL cấu hình theo môi trường; không dùng `localhost` của điện thoại để trỏ vào API chạy trên máy tính.

## 7. Seed và demo tái lập được

Cung cấp seed idempotent với dữ liệu tổng hợp: bệnh nhân có appointment, walk-in guest, một bệnh nhân khác để kiểm tra truy cập trái phép; receptionist, doctor, service staff, cashier, admin có scope; khoa/phòng/dịch vụ, mapping hợp lệ, template VI/EN, dữ liệu có và không có nhà thuốc.

Có cách bắt đầu demo từ trạng thái sạch và cách tiếp tục dữ liệu đang có. Tài khoản demo phải được tạo theo cơ chế môi trường riêng, không biến mật khẩu mặc định công khai thành cấu hình production. Không đưa secret triển khai vào tài liệu.

Viết runbook từng bước, vai trò dùng ở mỗi bước, trạng thái mong đợi và cách quan sát kết quả. Luồng demo chính phải chạy trên API thật với DB lưu bền vững; mock ở component test hoặc adapter nguồn ngoài không được che việc API nội bộ chưa triển khai.

## 8. CI: chất lượng code và build có bằng chứng

Triển khai workflow chạy khi mở/cập nhật PR và khi cập nhật nhánh tích hợp thực tế của repo. Không đoán rằng nhánh đó luôn tên `main` hoặc `dev`.

Các gate tương ứng stack:

1. Cài đúng runtime và dependency từ lockfile ở chế độ frozen/locked. Cache theo runtime/OS/lockfile; không cache secret.
2. Format check/lint/type check web và mobile. Không tắt rule hoặc phủ `any`/ignore hàng loạt để đạt xanh.
3. Test FE cho component có logic, form, access recovery, state handling và các tương tác quan trọng; tránh chỉ có snapshot hoặc test phản chiếu implementation.
4. Test BE cho state guards, ownership/scope, idempotency, concurrency và API. Test tích hợp dùng DB quan hệ thật phù hợp với demo, không chỉ repository mock.
5. Build production web và BE. Kiểm tra contract/client không lệch nếu có sinh mã.
6. Chạy browser E2E trên FE + API + DB/seed trong CI, tách session theo vai trò; test không phụ thuộc provider bên ngoài hoặc camera vật lý.
7. Build/kiểm tra Docker image và smoke test dịch vụ khởi động. Upload artifact và báo cáo/trace khi lỗi, có thời hạn lưu giữ.
8. Với mobile: PR chạy checks/tests và bundle validation phù hợp; workflow build native trên runner có SDK chạy ở trigger riêng đã ghi rõ. Có ít nhất artifact Android cài được cho mục tiêu demo mặc định, hoặc ghi rõ blocker SDK/credential khi chưa build được. Bundle JS hay Expo Go không được báo là APK/AAB đã build.

Không cần ép chỉ số coverage cao bằng test rỗng. Ưu tiên kiểm tra hành vi người dùng và các guard quan trọng. Không dùng `continue-on-error`, bỏ assertion, bỏ nhóm test hoặc `echo success` để che lỗi. Nếu lỗi thuộc môi trường, báo đúng blocked thay vì pass.

Workflow cần permissions tối thiểu, timeout và concurrency hợp lý. PR từ nguồn chưa tin cậy không được truy cập deployment secrets; không checkout rồi chạy code PR bằng workflow đặc quyền. Pin action/image/runtime theo cơ chế version phù hợp và kiểm tra tài liệu chính thức hiện tại. Required checks và branch protection được cấu hình khi có quyền; nếu chưa có, ghi hướng dẫn chính xác và trạng thái chưa cấu hình.

## 9. CD: triển khai demo thực sự, không chỉ một tệp YAML

### 9.1. Mặc định về môi trường

Nếu repo có hosting/deployment được cấp quyền, dùng môi trường đó. Nếu chưa có, chuẩn bị đường triển khai **Docker Compose lên một máy demo/VPS** qua cấu hình môi trường, cùng workflow thủ công nhận cấu hình cần thiết. Web và API ưu tiên cùng origin thông qua reverse proxy để cấu hình session đơn giản; DB có volume lưu bền vững. Không tự tạo dịch vụ tính phí, đăng app store, mua domain hay chọn tài khoản bên ngoài chưa được cấp.

Local demo phải chạy được dù chưa có credential deploy. Đồng thời phải bàn giao đủ script/workflow/runbook cho CD; đừng gọi phần này là đã deploy khi chưa có một lần chạy thành công trên môi trường đích.

### 9.2. Quy trình release bắt buộc

- Tách PR CI khỏi deploy. Deploy chỉ từ commit/artifact đã qua gate, qua trigger và environment được cấu hình. Tôn trọng cơ chế approval đã có; không tự thêm hoặc vượt qua quyền ngoài phạm vi.
- Build artifact/image một lần, gắn commit SHA và phát hành đúng artifact đó. Không build lại từ một branch có thể đã thay đổi ngay trong bước deploy.
- Trước deploy kiểm tra biến môi trường bắt buộc, kết nối và cấu hình. Thiếu secret/host phải dừng job bằng lỗi rõ ràng trước khi thay đổi môi trường; không có đường “skip deploy” nhưng báo thành công.
- Có chiến lược migration tương thích, backup phù hợp trước thay đổi dữ liệu, rồi khởi động phiên bản mới và health/readiness check. Seed demo không được xóa dữ liệu tự động mỗi release.
- Smoke test tối thiểu truy cập web, API, auth phù hợp và một hành vi đọc dữ liệu được phép. Dùng dữ liệu tổng hợp và ngữ cảnh test; không reset DB người dùng sau deploy.
- Có rollback/redeploy về artifact đã biết chạy được. Nêu giới hạn rollback khi schema đã thay đổi; không rollback code mù quáng lên schema không tương thích.
- Ghi deployment URL thực tế nếu có, commit SHA, artifact/image reference, thời điểm, kết quả health/smoke và cách rollback.

Secrets đặt trong cơ chế bảo mật của CI/environment. FE chỉ nhận public config như API URL; không nhúng signing key, provider key, DB credential hoặc secret phiên làm việc. Nếu dùng SSH, kiểm tra host key, không vô hiệu hóa xác minh chỉ để pipeline chạy được. Nếu provider hỗ trợ OIDC và cấu hình hiện tại phù hợp, ưu tiên credential ngắn hạn.

### 9.3. Phân phối mobile

Mặc định Android là nền tảng native cần demo đầu tiên khi chưa có quyết định khác; ghi rõ lựa chọn này. Tạo workflow build APK/internal distribution hoặc artifact tương đương của toolchain hiện có. Quản lý signing credential qua secret, không commit key.

Nếu dùng Expo/EAS, cấu hình đúng project/build profile và trigger được cấp quyền; không giả định Expo token hoặc signing credential đã có. Nếu không dùng dịch vụ cloud, hỗ trợ build bằng toolchain native tương thích. Thiếu tài nguyên cloud không được khiến web/API và toàn bộ local demo bị bỏ dở.

iOS cần được ghi rõ trong ma trận hỗ trợ và trạng thái xác minh. Không tuyên bố đã build/test iOS khi thiếu runner macOS, signing hoặc thiết bị cần thiết. Không tự phát hành lên cửa hàng ứng dụng.

## 10. Kiểm thử nghiệm thu từ nghiệp vụ

Tự động hóa các luồng web chính bằng browser E2E và các guard ở API/integration test. Với native, dùng công cụ E2E đang có nếu chạy được; nếu không, thực hiện smoke checklist trên emulator/thiết bị sẵn có và ghi phần chưa xác minh. Mỗi test dùng dữ liệu cô lập để có thể chạy lại.

| Kịch bản | Điều kiện phải quan sát được |
| --- | --- |
| Booked reception | Chọn appointment tạo reception context/QR; chưa có Visit. Reception xác nhận mới có một Visit/Journey/ticket; ticket scan kích hoạt đúng Journey |
| Guest walk-in | Vào từ QR bệnh viện, chọn ngôn ngữ và Guest, gửi form; staff yêu cầu bổ sung; bổ sung giữ request ID; xác nhận rồi kích hoạt được |
| Retry/concurrency | Gửi cùng xác nhận hai lần, kể cả đồng thời; chỉ một Visit, ticket và Journey. In lại/quét lại giữ ID và progress |
| Đúng mục đích QR | Reception QR không kích hoạt Journey; ticket QR không tạo lượt khám mới; expired/wrong-purpose/wrong-owner có thông báo và không lộ dữ liệu |
| Order và dịch vụ | Order sinh đúng step/dependency; dịch vụ được người có scope cập nhật; return consultation chỉ ready khi đủ điều kiện; missing mapping bị từ chối trước commit |
| Settlement | Intermediate không đóng Visit; final đến sớm chưa đóng; sau khi công việc được giải quyết thì chỉ đóng nếu settlement còn áp dụng cho công việc hiện tại |
| Closed Visit còn nhà thuốc | Journey vẫn truy cập được; patient chỉ hoàn tất bước nhà thuốc hợp lệ. Journey Pending Activation phải giữ pending đến authorized scan |
| Không có nhà thuốc | Visit đóng hợp lệ làm Journey hoàn tất tự động, kể cả chưa từng kích hoạt; quét sau đó mở completed record |
| Nội dung bác sĩ | Draft bị chặn cả API và UI bệnh nhân; Publish thấy ngay khi Visit còn Active; chẩn đoán và dặn dò vẫn xem được nếu không có follow-up |
| Correction và audio | Publish version mới giữ lịch sử audit; patient dùng bản hiện hành; audio cũ bị dừng/vô hiệu hóa; thiếu TTS vẫn đọc được nội dung |
| Guest conversion | Thành công giữ patient/Visit/Journey IDs và return target; cancel/failure giữ dữ liệu và valid guest access; retry không tạo account/Visit trùng; claim replay bị xử lý an toàn |
| Phân quyền | Bệnh nhân A không đọc/sửa của B; staff ngoài scope bị chặn; patient không hoàn tất khám/thanh toán; admin riêng lẻ không Publish clinical content |
| Mất mạng và session | Loading/error/retry đúng; không báo thành công giả; expired session có recovery; reload, app restart và API restart giữ tiến trình xác nhận |
| Ngôn ngữ và truy cập | VI/EN trên các bước chính, fallback được ghi nhãn; đổi ngôn ngữ không đổi ID; keyboard/text scaling dùng được; ba công cụ từ Journey trong hai tương tác |
| Hỗ trợ, cấu hình và tái khám | Assistance cập nhật đúng quyền; cấu hình thiếu dependency bị chặn; recommendation không biến thành booking; lượt đến sau có Visit/Journey mới |
| Build và release | Clean checkout cài/build/test được; artifacts truy được commit; local Compose hoạt động; CD/native build được ghi đúng passed, failed hay blocked |

Với NFR-PERF-01, cung cấp cách seed 10.000 Journey steps và chạy workload 20 người dùng đồng thời trên các request do ứng dụng sở hữu. Đo p95 và đối chiếu ngưỡng 2 giây, ghi cấu hình máy, dataset, workload và cách tính. Đo provider latency riêng. Chỉ báo đạt nếu đã chạy đo; nếu môi trường không cho phép thì bàn giao script và ghi chưa xác minh.

## 11. Cách tổ chức công việc và tiêu chí hoàn tất

Thực hiện theo các phần có thể chạy và kiểm tra độc lập:

1. Khảo sát → bảng khoảng cách → quyết định kiến trúc và hợp đồng tối thiểu.
2. Nền tảng chung: DB/migration/seed/auth/permissions, API client, design system, i18n và CI cơ bản.
3. Luồng đầu tiên chạy xuyên suốt: patient guest → request → reception → ticket → Journey.
4. Bác sĩ/dịch vụ/settlement/nhà thuốc; nội dung Published; history và guest conversion.
5. Hoàn thiện các nhóm FE còn lại, native patient flows, lỗi/fallback/accessibility.
6. CI đầy đủ, native build, local deployment, CD và bằng chứng nghiệm thu.

Đây là thứ tự triển khai, không phải sáu lần dừng để xin người dùng xác nhận. Sau mỗi phần, chạy kiểm tra có ý nghĩa, sửa lỗi rồi tiếp tục. Nếu context gần hết, lưu checkpoint ngắn về file đã sửa, lệnh đã chạy, kết quả và bước tiếp theo; không đánh dấu task hoàn thành chỉ vì hết lượt.

Tiêu chí hoàn tất:

- Các nhóm FE trong PRD có code, tương tác và trạng thái cần thiết; mọi nút chính hoạt động hoặc thể hiện unavailable có nguyên nhân đúng với điều kiện tích hợp trong PRD.
- Web, Native và BE dùng cùng hợp đồng; nghiệp vụ quan trọng được xác nhận ở server, dữ liệu tồn tại qua restart.
- Có local demo tái lập từ clean checkout, seed rõ ràng và runbook chuyển vai trò theo luồng.
- CI đã được thực thi nếu có runner/quyền; nếu chỉ chạy các lệnh tương đương tại local phải gọi đúng là local verification, không gọi là GitHub CI đã pass.
- CD có đường triển khai hoàn chỉnh; trạng thái “đã deploy” chỉ dùng khi có môi trường đích, lần chạy thành công và smoke evidence. Tương tự với APK và iOS build.
- Ma trận traceability ghi trung thực `Implemented + verified`, `Implemented + unverified`, `Simulated external adapter`, `Blocked` hoặc `Not implemented`. Không gộp tất cả thành “Done”.
- Blocker bên ngoài không ngăn bàn giao phần chạy được. Hoàn tất mọi phần không bị chặn, ghi đúng đầu vào còn thiếu và một hành động cụ thể để tiếp tục.

Không sửa PRD để hợp thức hóa phần code thiếu. Không đổi luồng, tự bỏ mobile, thay server state bằng localStorage, cho button chỉ hiện toast thành công, hoặc chỉ giao UI tĩnh rồi gọi là hoàn thiện.

## 12. Bàn giao trong repository và báo cáo cuối

Ưu tiên cập nhật tài liệu hiện có, tránh nhiều tài liệu lặp nhau. Tối thiểu cần có các nội dung sau, tên file có thể thích nghi với repo:

- `README.md`: prerequisites, biến môi trường, lệnh cài/chạy/build/test, web/API/mobile URL configuration và cách seed.
- `.env.example` hoặc mẫu config tương ứng, chỉ có tên biến và giá trị mẫu không bí mật.
- Workflow CI/CD/native build và Docker/deployment scripts cần thiết; mọi lệnh được tài liệu tham chiếu phải thực sự tồn tại.
- `docs/implementation-matrix.md`: requirement/UC/FE mapping, đường dẫn code, API, cách kiểm tra, trạng thái và giới hạn.
- `docs/demo-runbook.md`: thao tác theo vai trò, expected state, dữ liệu tổng hợp, adapter mô phỏng, reset an toàn và lỗi phục hồi.
- `docs/delivery.md` hoặc mục tương đương: environment, trigger, secrets cần cấu hình, artifact retention, migration/backup, smoke test, rollback và ma trận trình duyệt/nền tảng native.
- Báo cáo kiểm tra ngắn có lệnh thực tế, kết quả, screenshot/trace có ích và các blocker còn lại. Không đưa dữ liệu nhạy cảm vào bằng chứng.

Khi kết thúc, trả lời theo các ý:

1. Đã hoàn thiện những gì ở FE, BE và CI/CD.
2. Cách chạy demo bằng các lệnh đã xác minh; vị trí hướng dẫn truy cập các vai trò.
3. Những luồng và kiểm thử đã thực sự chạy, kết quả và bằng chứng.
4. URL/artifact đã tạo thực sự; phần chỉ mới cấu hình phải ghi rõ.
5. Tích hợp đang mô phỏng, giới hạn còn lại và blocker cần người dùng cung cấp gì.

Đừng yêu cầu người dùng tự viết nốt phần code đã nằm trong phạm vi này. Hãy bắt đầu bằng việc đọc PRD và khảo sát repository, rồi thực hiện đến kết quả chạy được.

## Tài liệu chính thức để xác minh quyết định kỹ thuật

Các liên kết dưới đây phục vụ lựa chọn triển khai, không thay thế yêu cầu nghiệp vụ trong PRD. Kiểm tra phiên bản và khả năng truy cập thực tế tại thời điểm làm việc:

- [GitHub Actions: secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Actions: kiểm soát deployment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [Expo: EAS Build](https://docs.expo.dev/build/)
- [Expo: build ứng dụng local](https://docs.expo.dev/guides/local-app-overview/)
- [Microsoft Learn: persistence với Minimal API, EF Core và SQLite](https://learn.microsoft.com/training/modules/persist-data-ef-core)
