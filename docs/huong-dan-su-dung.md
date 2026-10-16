# Hướng dẫn sử dụng hệ thống

**Dự án:** Multilingual Automatic Narration System — Hospital Visit Guidance  
**Phạm vi:** Hướng dẫn chạy và trải nghiệm bản demo Web/Mobile của đồ án Nhóm 01.

> Đây là hướng dẫn sử dụng môi trường demo với dữ liệu tổng hợp, không phải hướng dẫn cho bệnh viện vận hành thực tế. Không nhập dữ liệu bệnh nhân thật hoặc thông tin y tế nhạy cảm.

## 1. Hệ thống dùng để làm gì?

Hệ thống mô phỏng hành trình thăm khám tại bệnh viện: bệnh nhân gửi yêu cầu đến khám hoặc truy cập bằng mã phiếu, nhân viên tiếp nhận xử lý thông tin, bác sĩ cập nhật nội dung tư vấn đã được duyệt, và bệnh nhân theo dõi hướng dẫn theo từng bước. Web hỗ trợ giao diện cho bệnh nhân và các vai trò nhân viên; ứng dụng Mobile dành cho trải nghiệm bệnh nhân.

## 2. Chuẩn bị và khởi chạy Web

### Yêu cầu

- Windows PowerShell.
- .NET SDK 9.
- Node.js 22.19.
- Python 3.13.

### Khởi động

Mở PowerShell tại thư mục gốc của repository rồi chạy:

```powershell
cd codes
dotnet restore services/api --locked-mode
npm.cmd ci --prefix apps/web
./scripts/start-demo.ps1
```

Đợi script xác nhận các dịch vụ đã sẵn sàng, sau đó mở:

- **Ứng dụng Web:** http://127.0.0.1:5173
- **API health check:** http://127.0.0.1:5047/health

Khi hoàn tất, quay lại PowerShell tại thư mục `codes` và dừng demo bằng:

```powershell
./scripts/stop-demo.ps1
```

Không xóa database để xử lý lỗi migration. Nếu gặp lỗi, hãy lưu thông báo lỗi cần thiết và loại bỏ token, mật khẩu, mã truy cập hoặc thông tin nhạy cảm trước khi chia sẻ.

## 3. Tài khoản demo và chọn vai trò

Trên thanh đầu trang, chọn đúng vai trò trước khi đăng nhập. Danh sách email và mật khẩu demo đang được quản lý tập trung tại [codes/README.md](../codes/README.md), mục **Tài khoản và kịch bản trình bày**.

| Vai trò | Mục đích sử dụng |
| --- | --- |
| Bệnh nhân | Gửi yêu cầu vãng lai, nhập/quét mã phiếu, xem hướng dẫn và lịch sử |
| Tiếp nhận | Xem yêu cầu đến khám, xác minh thông tin và cấp phiếu |
| Bác sĩ | Quản lý lượt khám, cập nhật chỉ định, chẩn đoán và dặn dò |
| Xét nghiệm / hình ảnh | Cập nhật tiến độ và kết quả dịch vụ được giao |
| Thu ngân | Ghi nhận trạng thái thanh toán |
| Quản trị | Cấu hình nội dung và quy trình demo |

Để trình diễn nhiều vai trò cùng lúc, nên dùng cửa sổ hoặc browser profile riêng cho mỗi vai trò để tránh nhầm phiên đăng nhập.

## 4. Kịch bản demo đầy đủ

Nên thực hiện theo thứ tự dưới đây để thấy luồng phối hợp giữa các vai trò.

### Bước 1 — Bệnh nhân gửi yêu cầu đến khám

1. Đăng nhập vai trò **Bệnh nhân**, hoặc chọn tiếp tục với tư cách khách nếu giao diện hiển thị lựa chọn này.
2. Điền thông tin theo biểu mẫu demo và gửi yêu cầu vãng lai.
3. Lưu mã tiếp nhận/QR được hiển thị để dùng ở bước tiếp theo.

Ở giai đoạn này, yêu cầu mới được tạo; lượt khám và hành trình hướng dẫn chưa được kích hoạt.

### Bước 2 — Tiếp nhận xác minh và cấp phiếu

1. Mở phiên riêng và đăng nhập vai trò **Tiếp nhận**.
2. Nhập hoặc quét mã tiếp nhận có dạng `REC_…`.
3. Kiểm tra thông tin yêu cầu; chọn khoa theo kịch bản demo, sau đó thực hiện thao tác xác nhận và cấp phiếu.
4. Ghi lại mã phiếu có dạng `TKT_…` để chuyển sang bước bệnh nhân.

Một số kịch bản tiếp nhận còn cho phép xác minh lịch hẹn mang đến quầy hoặc gửi câu hỏi hướng dẫn đã được duyệt.

### Bước 3 — Bệnh nhân mở hành trình khám

1. Quay lại phiên bệnh nhân.
2. Nhập hoặc quét mã phiếu `TKT_…`.
3. Kiểm tra thông tin và các bước hướng dẫn được hiển thị.
4. Nếu mở lại cùng mã trong quá trình demo, hệ thống hướng tới tiếp tục hành trình hiện có thay vì tạo một hành trình mới.

### Bước 4 — Bác sĩ cập nhật nội dung tư vấn

1. Đăng nhập vai trò **Bác sĩ** trong phiên riêng.
2. Mở đúng lượt khám/hồ sơ demo.
3. Thêm các chỉ định cần thiết theo kịch bản và hoàn tất bước khám ban đầu.
4. Nhập nội dung chẩn đoán, tư vấn hoặc dặn dò theo dữ liệu demo.
5. Lưu nháp, kiểm tra nội dung rồi công bố theo chức năng có sẵn trong giao diện.
6. Quay lại bệnh nhân để xác nhận nội dung đã công bố có thể xem được.

Bản dịch tiếng Anh chỉ được dùng khi trạng thái của bản dịch đã được đánh dấu duyệt trong luồng demo. Không coi nội dung chưa công bố là hướng dẫn cuối cùng.

### Bước 5 — Cập nhật dịch vụ và thanh toán

1. Đăng nhập vai trò **Xét nghiệm / hình ảnh** để xử lý chỉ định được giao trong kịch bản.
2. Cập nhật kết quả/tiến độ theo chức năng hiển thị.
3. Quay lại vai trò **Bác sĩ** để hoàn tất bước tái khám nếu kịch bản có yêu cầu.
4. Đăng nhập vai trò **Thu ngân** và ghi nhận trạng thái thanh toán cuối theo dữ liệu demo.
5. Xác nhận trạng thái lượt khám và hành trình đã được cập nhật phù hợp.

Trong quy trình mô phỏng, thanh toán giữa chừng không đồng nghĩa lượt khám đã đóng.

### Bước 6 — Bệnh nhân hoàn tất hướng dẫn và xem lại lịch sử

1. Quay lại bệnh nhân và làm theo các bước hướng dẫn còn lại.
2. Nếu hành trình hiển thị bước hướng dẫn đến nhà thuốc, hãy xác nhận hoàn tất phần hướng dẫn khi đã xem xong.
3. Mở lịch sử hoặc phần thông tin lượt khám để kiểm tra dữ liệu đã lưu.
4. Chỉ thực hiện liên kết hồ sơ khách với tài khoản khi kịch bản demo yêu cầu và đã chọn đúng tài khoản.

**Lưu ý:** Nút hoàn tất hướng dẫn nhà thuốc chỉ ghi nhận người dùng đã hoàn thành hướng dẫn trong bản demo; không xác nhận nhà thuốc thực tế đã cấp phát thuốc.

## 5. Sử dụng ứng dụng Mobile

Ứng dụng Mobile dùng React Native/Expo. Trước tiên, API demo cần chạy theo mục 2.

Trong PowerShell, tại thư mục gốc repository:

```powershell
cd codes
npm.cmd ci --prefix apps/mobile
npm.cmd run typecheck --prefix apps/mobile
npm.cmd run bundle --prefix apps/mobile
cd apps/mobile
$env:EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:5047'
npm.cmd start
```

`10.0.2.2` là địa chỉ thường dùng để Android Emulator truy cập dịch vụ trên máy chủ. Thiết bị thật cần cấu hình API URL có thể truy cập qua mạng và firewall phù hợp; không tự mở dịch vụ ra mạng nếu chưa được cho phép.

Ứng dụng có luồng nhập mã dự phòng cho camera, hỗ trợ tiếp tục hành trình bằng mã phiếu và có thể mở deep link theo dạng `hospitalguide://ticket/TKT_…` khi app đã được cài và liên kết được cấu hình. Khả năng camera, giọng đọc và liên kết app cần được kiểm tra trên emulator/thiết bị thực tế; không xem chúng là đã nghiệm thu chỉ vì web demo chạy được.

## 6. Xử lý một số tình huống thường gặp

| Tình huống | Cách kiểm tra |
| --- | --- |
| Web không mở được | Xem PowerShell có báo demo sẵn sàng không; kiểm tra API health check và cổng 5173. |
| API không phản hồi | Kiểm tra tiến trình demo và lỗi trong terminal; dừng demo đúng cách rồi khởi động lại. |
| Không thấy dữ liệu của vai trò khác | Xác nhận đang đăng nhập đúng vai trò, đúng tài khoản và đúng mã yêu cầu/phiếu. |
| Mã tiếp nhận hoặc mã phiếu không hợp lệ | Dùng lại mã được tạo trong phiên demo hiện tại; kiểm tra không nhập thiếu ký tự. |
| Nội dung bác sĩ chưa xuất hiện ở bệnh nhân | Kiểm tra nội dung đã được công bố, không chỉ lưu nháp, và bệnh nhân đang xem đúng lượt khám. |
| Ứng dụng Mobile không gọi được API | Kiểm tra API đang chạy, biến `EXPO_PUBLIC_API_BASE_URL` và loại thiết bị đang dùng. Thiết bị thật không dùng địa chỉ emulator `10.0.2.2`. |

Nếu cần báo lỗi, ghi lại các bước tái hiện, vai trò đang dùng và thông báo lỗi đã loại bỏ thông tin nhạy cảm; tạo Issue theo mẫu trên GitHub.

## 7. Giới hạn cần biết

- Đây là ứng dụng đồ án/demo sử dụng dữ liệu tổng hợp; chưa phải hệ thống vận hành bệnh viện thực tế.
- Các tích hợp HIS, lịch hẹn ngoài, hàng đợi, dịch vụ và thanh toán thật hiện được mô phỏng/adapt theo phạm vi demo.
- Lời hướng dẫn bằng giọng đọc phụ thuộc khả năng của thiết bị; nội dung đa ngôn ngữ tuân theo trạng thái duyệt trong ứng dụng.
- Không nhập dữ liệu bệnh nhân thật, mật khẩu thật hoặc bí mật môi trường. Không chia sẻ log, ảnh màn hình hay mã QR trước khi kiểm tra thông tin nhạy cảm.

## 8. Tài liệu liên quan

- [Hướng dẫn sử dụng GitHub cho nhóm](huong-dan-github.md)
- [Hướng dẫn setup và kịch bản demo kỹ thuật](../codes/README.md)
- [Trang chủ dự án](../README.md)
- [Mục lục tài liệu](README.md)
- [Kế hoạch và TODO của nhóm](team-planning/README.md)
