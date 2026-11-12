# Quyết định và giả định

Các mục 1–18 ghi lại baseline đang chạy; riêng mục 5 đã cập nhật hành vi PB-003.
Phần PB-001 bên dưới là hợp đồng đích cho luồng PRD v2, chưa triển khai toàn bộ runtime.

1. Modular monolith ASP.NET Core .NET 10 LTS, EF Core SQL Server; một backend và một database thật. React/TypeScript web, Expo React Native mobile. Không dùng dịch vụ Sites hosting: yêu cầu chỉ chạy cục bộ.
2. SQL Server dùng container riêng cnpm-guidance, cổng 14339; backend 5280, web 5180. Không đụng container đang có. Mật khẩu tạo ngẫu nhiên ngoài source. Database Developer chỉ dùng phát triển/demo.
3. Bệnh viện demo duy nhất. Phân công bác sĩ theo Visit và khoa; nhân viên dịch vụ theo khoa của bước, thu ngân/tiếp nhận theo khoa Visit. Quản trị không có quyền xem nội dung bác sĩ hoặc công bố thay bác sĩ.
4. Guest 24 giờ, tài khoản/nhân viên 8 giờ; cookie HttpOnly/SameSite Strict cho web, token lưu SecureStore native. QR hết hạn sau 24 giờ, không chứa dữ liệu cá nhân và không tự cấp quyền. Phục hồi guest cần tiếp nhận kiểm tra trực tiếp, mã phục hồi một lần 10 phút. Không đưa mã QR/token vào log.
5. PB-003 thay thế hành vi liên kết legacy: không tạo liên kết Guest/tài khoản mới; link-claim/convert trả 410 guestLinkDisabled. Đăng ký tạo Patient riêng, đăng nhập giữ chủ sở hữu hiện tại; không gộp theo tên/liên hệ. Lịch sử đã liên kết trước nâng cấp và bảng LinkClaim được giữ nguyên; Guest còn quyền dùng bình thường, recovery vẫn cần Reception xác minh.
6. Trạng thái cập nhật bằng polling 5 giây, refresh sau mutation/reconnect; phản hồi cũ bị loại theo request sequence. Cache nhạy cảm chỉ trong RAM; xóa khi sign-out/đổi subject/hết hạn. Không có offline mutation queue.
7. Mutation nghiệp vụ dùng Idempotency-Key và kiểm tra version khi cập nhật bản ghi. Giao dịch SQL + application lock bảo vệ thao tác nhiều bảng, unique indexes là hàng rào cuối. Khóa toàn cục cho lệnh ghi trong bản triển khai một bệnh viện; đo tải để xác định giới hạn. Đọc dùng isolation mặc định của SQL Server; bản đọc lỗi thời không được quyền ghi đè vì mutation kiểm tra version và điều kiện hiện hành.
8. WorkRevision tăng khi thêm/sửa/hủy công việc; quyết toán cuối lưu revision tương ứng. Tiến độ không tăng WorkRevision. Quyết toán sớm chỉ đóng khi chuyên môn đủ điều kiện và revision còn khớp.
9. Cấu hình mẫu: họ tên 2–120 ký tự, liên hệ 5–80 ký tự, mô tả/nguyện vọng tối đa 2000. Không tự chọn khoa từ triệu chứng. Các ràng buộc form cung cấp qua API cấu hình.
10. Bản đồ dùng địa điểm và hướng dẫn văn bản có cấu hình; không giả lập GPS. TTS dùng giọng thiết bị qua Web Speech / Expo Speech sau khi backend giải quyết nội dung được phép; không dịch tự động nội dung chuyên môn. Giọng thiếu thì giữ văn bản và báo lỗi.
11. Tích hợp chưa có credentials thật: định danh/lịch hẹn mô phỏng xác định; sự kiện dịch vụ/hàng đợi/quyết toán qua nhân viên được phân quyền và adapter cùng hợp đồng. Không thanh toán thật. Booking handoff chỉ có khi cấu hình URL tin cậy; không suy ra booking từ khuyến nghị.
12. Demo không tự xóa dữ liệu. Chính sách lưu trữ dự kiến 90 ngày guest không liên kết, 365 ngày guidance tài khoản; quản trị vận hành phải xác nhận chính sách và quy trình purge trước triển khai thật. Không coi thời hạn truy cập là xóa hồ sơ. Production bắt buộc HTTPS và cấu hình secret; localhost HTTP chỉ cho demo.
13. API kiểm thử chạy bản Release trên cổng 5281 và database riêng để không ghi đè DLL đang dùng bởi source demo trên Windows. Phép đo hiệu năng là tải ngắn 620 request, không phải kiểm chứng tải liên tục hoặc dung lượng production.
14. Compose giữ DataProtection key ring trong volume `api-keys`; source dùng key ring của tài khoản hệ điều hành. Khi chuyển giữa hai môi trường với database có sẵn, cần chuyển key ring tương thích hoặc dùng database mới. Giữ database/key ring cùng nhau để mã QR còn in lại được; không coi xóa container là cách đặt lại database.
15. Mã khoa CONSULT/CASHIER/PHARMACY là định danh tác nghiệp ổn định. Có thể đổi tên/phòng; điểm thu ngân/nhà thuốc cho bước mới được chọn trong khoa còn hoạt động theo số phòng rồi ID. Snapshot của bước đã tạo không đổi khi sửa địa điểm.
16. APK demo cho phép HTTP đúng ba địa chỉ localhost, 127.0.0.1 và 10.0.2.2 qua Android Network Security Configuration; địa chỉ khác yêu cầu HTTPS tin cậy. Không bật cleartext toàn ứng dụng hoặc bỏ qua kiểm tra chứng thư. Tắt backup và loại quyền storage/overlay/microphone không cần cho quét QR.
17. Build Android Windows dùng bản sao trong đường dẫn ngắn `D:\cnpm-android` và cache Gradle tại `.gradle-cache` trong thư mục đó để tránh giới hạn đường dẫn CMake/Ninja. SUBST không đủ vì Expo autolinking và Gradle giải quyết đường dẫn khác nhau. Script kiểm tra marker sở hữu trước khi cập nhật bản sao, không sao chép cache CMake `.cxx` chứa đường dẫn tuyệt đối; source gốc không bị di chuyển. SDK và giả lập nằm trong `.local` trên ổ D. APK demo chỉ gồm arm64-v8a và x86_64, đóng gói JavaScript, ký bằng debug keystore sinh bởi Expo; chưa phải khóa phát hành cửa hàng.
18. Native ưu tiên ngôn ngữ do deep link hoặc người dùng vừa chọn so với kết quả đọc SecureStore khi khởi động, tránh ghi đè ngôn ngữ do hai tác vụ bất đồng bộ hoàn tất khác thứ tự. API demo mặc định ở `127.0.0.1:5280` qua adb reverse để dùng cùng APK trên giả lập và điện thoại USB.

Nguồn phiên bản/khả năng tương thích đã kiểm tra ngày 2026-10-16: https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core ; https://docs.expo.dev/versions/latest/ ; https://vite.dev/guide/ ; https://learn.microsoft.com/en-us/ef/core/saving/transactions ; https://learn.microsoft.com/en-us/ef/core/saving/concurrency . Phiên bản thực cài và lockfile là căn cứ tái tạo build.

## PB-001: đối chiếu PRD v2

Đối chiếu ngày 11/11/2026: [kế hoạch mục 7](../../../prd_v2/PRD-REVISION-PLAN.md) và [PRD chính thức viết lại](../../../prd_v2/document/prd%20chinh%20thuc.docx). Giữ thứ tự ưu tiên quyết định người dùng → PRD → sơ đồ → mã legacy. Chi tiết wire contract tại [API.md](API.md#pb-001-hợp-đồng-prd-v2).

| Quyết định giữ nguyên | Áp dụng / nguồn đối chiếu |
|---|---|
| QD-01: một ca Đang khám/phòng | Khóa phòng khi nhận khám; chỉ định hoặc hoàn tất khám nhả ca; vẫn nhận người chờ. FR-VISIT-04, BR-21 |
| QD-02: không đổi bác sĩ | Giữ phòng/bác sĩ Visit; khóa đổi bác sĩ hoạt động và phân công liên quan khi còn bất kỳ Visit Active. FR-VISIT-09, FR-ADM-07, BR-20 |
| QD-03: dịch vụ xong về phòng cũ | InService → Waiting, vào hàng chờ ngay; không tự nhận khám, không cần check-in. FR-VISIT-03/05/10, BR-21 |
| QD-04: một dịch vụ một lần | Một service mỗi lệnh, một order NotCompleted/Visit; không sửa/hủy/skip; khám lại trước chỉ định tiếp. FR-VISIT-11/12, BR-22 |
| QD-05: phiếu theo phòng/ngày | Số từ 001 theo ngày Việt Nam; in lại/khám tiếp giữ số và snapshot; gọi kèm phòng. FR-RCP-04/05, FR-VISIT-02 |
| QD-06: bỏ liên kết Guest, giữ khôi phục | Không link/convert/gộp ngầm; giữ quyền sở hữu/lịch sử cũ, phục hồi Guest sau xác minh. Phạm vi 1.7 và luồng khôi phục Guest |

Hai điểm sau vốn là **diễn giải cần đối chiếu bản PRD viết lại**, không phải mở lại quyết định:

- Khóa đổi bác sĩ khi còn Visit Active, kể cả Waiting, InService và Completed đang chờ quyết toán: PRD viết lại xác nhận rõ ở FR-VISIT-09, FR-ADM-07, BR-20. Không chỉ khóa lúc InConsultation. Thay thành viên/phòng bác sĩ phải kiểm tra cả phòng nguồn, phòng đích và Visit liên quan để không lách khóa. Khóa tài khoản vì bảo mật vẫn có hiệu lực, không tự bàn giao Visit.
- Nhãn InService là “Đang thực hiện dịch vụ”: FR-VISIT-03/05 và BR-21 hiện dùng đúng nhãn này. “Đang lấy mẫu” chỉ là hướng dẫn cho dịch vụ phù hợp, không là nhãn chung. Những bản tài liệu viết lại sau tiếp tục đối chiếu theo tên nghiệp vụ, không đổi mã wire hoặc sáu quyết định vì sơ đồ cũ.

Quyết định kỹ thuật:

1. Tách ExamStatus khỏi Visit/Journey/Step; Journey Active ngay khi tiếp nhận. Confirm chẩn đoán lưu/công bố và hoàn tất khám nguyên tử; kết quả xem được trước quyết toán. Final/NoPaymentRequired đều chờ chuyên môn xong và đóng Visit/Journey cùng giao dịch (BR-11/12/13). Thay giả định quyết toán sớm/nhà thuốc của mục 8 cho v2.
2. Actor/tác giả/quyền/timestamp do server xác định. Lệnh hẹp, version aggregate, idempotency theo actor/lệnh/tài nguyên; quyền kiểm tra trước replay, sự kiện chỉ phát sau commit. Capability chỉ giúp UI.
3. DTO V2 thêm riêng, giữ DTO legacy và Locale cũ; namespace API riêng, discriminator prd-v2 và flag dự kiến mặc định tắt. Chỉ bật sau PB-030/031; chặn mutation legacy phá quy tắc trên dữ liệu v2. Không triển khai endpoint/flag/migration trong PB-001.
4. Phiếu/phòng/bác sĩ/catalog/mẫu lưu snapshot khi xác nhận; lần gọi có event ID và số vòng khám riêng. Dữ liệu cũ thiếu nguồn cần đối chiếu PB-002/030, không tự dựng lại lịch sử.
5. Preview gắn Visit/version/bác sĩ/lựa chọn/version catalog/mẫu. Confirm chỉ gửi previewId/version, server kiểm tra lại và công bố nội dung Việt đã kiểm chứng; không tin text/author client.
6. Dịch chỉ khi mở detail có quyền, giữ nguyên văn và ngôn ngữ nguồn. Presence lấy danh tính/thời gian server, Account tính một qua nhiều phiên, Guest theo phiên hợp lệ, không dùng khóa nghiệp vụ. Các mặc định 15/60/5 giây cần đo ở task triển khai, không phải bằng chứng hiệu năng.

Không sửa kế hoạch chính hoặc tuyên bố các endpoint/guard đích đã tồn tại. Review API/UI và merge vẫn phải ghi nhận thực tế theo backlog.
