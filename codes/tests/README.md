# Kiểm thử

| Thư mục | Phạm vi | Cách chạy từ thư mục gốc |
|---|---|---|
| `api/` | Nghiệp vụ, quyền truy cập, provider, hiệu năng, smoke/TLS | `.\scripts\test\test-api.ps1` |
| `browser/` | Web trên Chromium desktop và viewport điện thoại | `npx playwright test` |
| `android/` | Kiểm chứng APK và luồng native trên giả lập | Theo [hướng dẫn Android](../docs/guides/ANDROID.md) |
| `lan/` | Chọn card mạng, thay IP và bảo toàn `.env` | `.\tests\lan\startup.ps1` |
| `setup/` | Clone mới, đường dẫn có khoảng trắng, sinh/giữ cấu hình PowerShell và Bash | `.\tests\setup\bootstrap.ps1` (cần Git Bash trên Windows) |

API acceptance cần SQL chạy trước; script dùng database riêng `HospitalAcceptance_<timestamp>`. Browser cần web/API đã chạy; `WEB_URL` chọn localhost hoặc IP LAN. Các kiểm thử có tạo dữ liệu dùng thông tin tổng hợp. LAN tests không mở Docker hoặc thay firewall.

```powershell
# Chỉ kiểm tra dashboard
npx playwright test tests/browser/admin.spec.ts

# Kiểm tra API kèm đo hiệu năng
.\scripts\test\test-api.ps1 -Performance

# Kiểm chứng APK đã build
node tests/android/verify-android.mjs
```

Báo cáo chạy mới ở `artifacts/`, báo cáo Android ở `artifacts/android/`. Các thư mục này tự tạo khi chạy và không được commit. Báo cáo/ảnh cũ ở `archive/docs/` trên máy đã dọn; xem [chỉ mục lưu trữ](../archive/README.md). Bản clone mới cần chạy lại kiểm thử, không có sẵn APK hoặc kết quả cũ.

`npm run test:demo` kiểm tra demo Docker đã bật: SQL health, 7 tài khoản/vai trò, API được bảo vệ, web/proxy và OpenAPI. Script đọc cổng từ `.env`; có thể ghi đè bằng `API_URL`/`WEB_URL`.

Browser tests dùng `WEB_URL`/`API_URL` khi đổi cổng; mặc định lần lượt là `http://localhost:5180` và `http://127.0.0.1:5280`. Ví dụ PowerShell: `$env:WEB_URL='http://localhost:5188'; $env:API_URL='http://127.0.0.1:5288'` trước `npm run test:e2e`. API acceptance cần cổng 5281 trống, tự tạo database `HospitalAcceptance_<timestamp>` và giữ database này sau kiểm thử.
