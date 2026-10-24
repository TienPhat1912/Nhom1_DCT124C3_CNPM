# Chia sẻ QR nhanh qua Internet

Hướng dẫn dùng Cloudflare Quick Tunnel để điện thoại ở mạng khác quét QR mở web demo mà không cần cài Tailscale.

> Tunnel tạo URL công khai tạm thời. Chỉ dùng dữ liệu demo, không dùng dữ liệu bệnh nhân thật hoặc chia sẻ mật khẩu. Ai có URL đều có thể mở web khi tunnel đang chạy.

## Điều kiện

- Docker Desktop đang chạy, các container SQL, API và web của dự án đã khởi động.
- Cài `cloudflared` trên Windows. Kiểm tra trong PowerShell:

```powershell
cloudflared --version
```

Nếu PowerShell chưa nhận lệnh sau khi cài MSI, đóng rồi mở lại PowerShell. Nếu vẫn chưa nhận, thêm thư mục cài vào PATH của cửa sổ hiện tại:

```powershell
$env:Path += ';C:\Program Files (x86)\cloudflared'
```

Vite và web Docker cùng dùng cổng `5180`; chỉ chạy một trong hai. Với các bước bên dưới, dùng web Docker và dừng Vite bằng `Ctrl+C` nếu đang chạy.

## Chạy tunnel

### PowerShell thứ nhất

Chạy tunnel tới web local và để cửa sổ này mở:

```powershell
cloudflared tunnel --url http://127.0.0.1:5180
```

Chờ đến khi có dòng `Registered tunnel connection`. Sao chép URL HTTPS có dạng `https://<ten-ngau-nhien>.trycloudflare.com`.

### PowerShell thứ hai

Chạy tại thư mục dự án `codes`:

```powershell
Set-Location D:\Nhom1_DCT124C3_CNPM\codes
$env:PUBLIC_ORIGIN = 'https://<ten-ngau-nhien>.trycloudflare.com'
docker compose -f compose.yaml -f compose.lan.yaml -f compose.public.yaml up -d --force-recreate api
```

Thay URL mẫu bằng đúng URL mà `cloudflared` vừa in ra. Không thêm dấu `/` ở cuối. Chờ lệnh hoàn tất; có thể kiểm tra API bằng:

```powershell
docker compose ps
```

## Mở QR trên điện thoại

Mở URL tunnel kèm `/entry` trên laptop, ví dụ:

```text
https://<ten-ngau-nhien>.trycloudflare.com/entry
```

Quét QR trên trang bằng điện thoại. Điện thoại có thể dùng mạng khác; không cần cài hoặc đăng nhập Tailscale. QR sẽ chứa URL của trang đang mở, nên hãy tạo/in QR từ chính địa chỉ tunnel.

## Dừng và chạy lại

- Nhấn `Ctrl+C` trong PowerShell đang chạy `cloudflared` để dừng tunnel.
- Khi tạo Quick Tunnel lần sau, URL có thể đổi. Cập nhật lại `PUBLIC_ORIGIN`, chạy lại lệnh Compose ở PowerShell thứ hai, rồi tạo/in QR mới.
- Giữ PowerShell thứ nhất mở trong suốt thời gian chia sẻ. Tắt laptop hoặc mất kết nối Internet sẽ làm dịch vụ ngừng truy cập.
- Không mở cổng SQL hoặc API trực tiếp ra Internet; chỉ tunnel cổng web `5180`.

## Xử lý lỗi không kết nối được origin

Nếu log `cloudflared` có `Unable to reach the origin service` hoặc `connectex: No connection could be made`, tunnel đã kết nối Cloudflare nhưng web local không chạy tại `127.0.0.1:5180`. Trong PowerShell thứ hai, kiểm tra:

```powershell
docker compose -f compose.yaml -f compose.lan.yaml ps
curl.exe -I http://127.0.0.1:5180/
```

Nếu web đang dừng, dừng Vite bằng `Ctrl+C` nếu nó đang giữ cổng 5180, rồi bật lại web Docker:

```powershell
docker compose -f compose.yaml -f compose.lan.yaml up -d web
```

Đợi web hiện `healthy`, sau đó thử lại URL tunnel. Giữ PowerShell thứ nhất chạy `cloudflared`; không cần tạo tunnel mới nếu URL cũ vẫn còn hiệu lực.

Xem thêm [hướng dẫn truy cập LAN](./LAN.md).
