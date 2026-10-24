# Truy cập từ các thiết bị trong LAN

Bấm đúp **[Start-LAN.cmd](../../Start-LAN.cmd)** tại thư mục dự án. File tự mở Docker Desktop nếu cần, chọn IPv4 riêng trên Wi-Fi/Ethernet đang kết nối, cập nhật `LAN_IP`, build/chạy hệ thống, kiểm tra web/API và mở trình duyệt bằng link LAN. File **[Stop-LAN.cmd](../../Stop-LAN.cmd)** dừng các container của dự án `cnpm-guidance`, giữ nguyên database và khóa QR. Hai file dùng được từ thư mục bất kỳ; có thể dùng **Send to → Desktop (create shortcut)** để đặt lối tắt ngoài Desktop.

Link hiện tại được in trong cửa sổ khởi động và lưu tại `.local/lan-access.txt`. Khi đổi Wi-Fi hoặc IP, bấm lại Start-LAN; link/QR mới sẽ dùng IP vừa nhận. Đây là tự nhận IP mỗi lần chạy, không phải một tên miền cố định hoặc theo dõi đổi mạng liên tục. Mở admin bằng link LAN để lấy QR tương ứng.

Lần đầu Windows có thể yêu cầu **Yes** trong hộp thoại Administrator để tạo firewall rule. Rule chỉ mở cổng web từ `LocalSubnet` trên đúng card mạng đã chọn; địa chỉ IP của card được phép thay đổi nên đổi IP trên cùng card không cần tạo lại rule. Đổi card mạng hoặc cổng web có thể cần quyền Administrator lần nữa. Nếu từ chối, dự án vẫn chạy local nhưng bộ khởi động báo chưa hoàn tất cấu hình LAN.

Nếu có nhiều mạng, script ưu tiên card vật lý có gateway, sau đó theo metric; không tự chọn VMware/VPN. Có thể chọn cụ thể hoặc chỉ kiểm tra IP mà không khởi động:

```powershell
.\scripts\lan\start-lan.ps1 -InterfaceAlias 'Wi-Fi'
.\scripts\lan\start-lan.ps1 -CheckOnly
.\scripts\lan\stop-lan.ps1
```

Máy cần cài Docker Desktop (Linux containers). Lần build đầu cần tải image/gói phụ thuộc. Dừng dự án không đóng Docker Desktop hoặc các dự án khác. Cách chạy Compose thủ công vẫn được hỗ trợ: thêm `LAN_IP=<IPv4 của máy chạy Docker>` vào `.env`, sau đó chạy:

```powershell
docker compose -f compose.yaml -f compose.lan.yaml up -d --build api web
```

Máy chủ vẫn truy cập `http://localhost:5180`; các thiết bị cùng mạng mở `http://<LAN_IP>:5180`. Hai địa chỉ đều được backend cho phép. SQL/API trực tiếp vẫn chỉ mở trên loopback; web chuyển tiếp các request API trong mạng Docker. Khi in QR cho thiết bị khác, mở giao diện quản trị qua địa chỉ LAN trước để QR chứa đúng IP.

Mở PowerShell **Run as administrator** tại thư mục dự án rồi chạy (thay IP bằng IP thực tế):

```powershell
.\scripts\lan\enable-lan-firewall.ps1 -IpAddress 192.168.31.7
```

Lệnh firewall thủ công trên chỉ cho phép TCP 5180 từ LocalSubnet đến đúng địa chỉ và giao diện mạng đó; dùng được khi Windows đánh dấu Wi-Fi là Public hoặc Private. Nếu đổi cổng web, truyền thêm `-Port`. Với cách thủ công, khi đổi mạng/IP cần cập nhật `LAN_IP`, chạy lại Compose và script firewall; dùng Start-LAN để tự thực hiện các bước này. Các thiết bị phải ở cùng LAN và router không bật chế độ cô lập thiết bị/mạng khách. Muốn trở lại chỉ localhost: `docker compose -f compose.yaml up -d --force-recreate api web`.

## Chia sẻ nhanh qua Internet bằng HTTPS tunnel

Nếu người quét QR không thể cài Tailscale, có thể tạo URL HTTPS công khai tạm thời bằng Cloudflare Quick Tunnel. Cài `cloudflared` trên Windows trước; giữ Docker web/API/SQL đang chạy và không chạy Vite cùng lúc trên cổng 5180.

Mở PowerShell thứ nhất để tạo tunnel:

```powershell
cloudflared tunnel --url http://127.0.0.1:5180
```

Giữ cửa sổ này mở. Sao chép URL `https://...trycloudflare.com` được in ra. Trong PowerShell thứ hai, tại thư mục gốc dự án:

```powershell
$env:PUBLIC_ORIGIN = 'https://<ten-ngau-nhien>.trycloudflare.com'
docker compose -f compose.yaml -f compose.lan.yaml -f compose.public.yaml up -d --force-recreate api
```

Thay giá trị bằng URL thực tế của tunnel. Mở chính URL đó trên laptop, vào `/entry` để QR được tạo với địa chỉ public; sau đó điện thoại ở bất kỳ mạng nào cũng quét được mà không cần Tailscale. Tunnel dừng khi đóng cửa sổ `cloudflared`; URL Quick Tunnel có thể đổi khi tạo lại, vì vậy hãy tạo/in QR mới sau mỗi lần đổi URL. Không dùng dữ liệu bệnh nhân thật hoặc chia sẻ mật khẩu demo: người có URL có thể truy cập ứng dụng demo công khai trong lúc tunnel chạy. Chỉ công khai web qua tunnel; không mở trực tiếp cổng SQL/API ra Internet.

Nếu cần truy cập riêng tư thay vì chia sẻ QR công khai, dùng Tailscale: tất cả thiết bị phải cài Tailscale và đăng nhập cùng tailnet.

Nếu mở được giao diện nhưng đăng nhập/đăng ký quay mãi sau khi cập nhật, thử tab ẩn danh hoặc tải lại bằng `Ctrl+Shift+R` trên máy tính. Tab cũ có thể vẫn chạy JavaScript trước bản sửa HTTP LAN; trên điện thoại có thể xóa dữ liệu trang của địa chỉ LAN rồi mở lại. Web hiện gửi `Cache-Control: no-cache` để trình duyệt kiểm tra lại bản giao diện khi tải trang; một tab đang mở vẫn cần tải lại. Bản hiện tại hiển thị lỗi kết nối và cho thử lại sau khoảng 12 giây nếu request không phản hồi.

Đây là truy cập bản web qua HTTP cho demo. Dùng camera bên trong trang web cần HTTPS; có thể dùng camera điện thoại để đọc QR công khai hoặc dán mã thủ công. APK hiện tại có URL localhost và giới hạn HTTP riêng, cần cấu hình/build tương ứng để dùng qua LAN.


Các lệnh được chạy từ thư mục gốc dự án. [Quay lại README](../../README.md).
