# Script vận hành và phát triển

Chạy các lệnh dưới đây từ thư mục gốc. Hai file `Start-LAN.cmd` và `Stop-LAN.cmd` ở gốc là lối vào cho người dùng; PowerShell được nhóm theo nhiệm vụ.

| Thư mục | Script | Công việc |
|---|---|---|
| `lan/` | [start-lan.ps1](lan/start-lan.ps1) | Nhận IP, mở Docker, cập nhật LAN, chạy web/API/SQL |
| `lan/` | [stop-lan.ps1](lan/stop-lan.ps1) | Dừng container của dự án, giữ dữ liệu |
| `lan/` | [enable-lan-firewall.ps1](lan/enable-lan-firewall.ps1) | Cấu hình firewall; cần Administrator |
| `lan/` | [lan-common.ps1](lan/lan-common.ps1) | Hàm dùng chung, được script khác nạp |
| `setup/` | [bootstrap.ps1](setup/bootstrap.ps1) | Tạo `.env` nếu chưa có; khởi động SQL. `-ConfigOnly` chỉ chuẩn bị cấu hình |
| `setup/` | [bootstrap.sh](setup/bootstrap.sh) | Tương đương cho Bash; `--config-only` không khởi động SQL |
| `setup/` | [env.ps1](setup/env.ps1) | Đọc và kiểm tra cấu hình dùng chung cho script PowerShell |
| `setup/` | [enable-https.ps1](setup/enable-https.ps1) | Tạo chứng thư demo và chạy HTTPS localhost |
| `dev/` | [start-dev.ps1](dev/start-dev.ps1), [stop-dev.ps1](dev/stop-dev.ps1) | Chạy/dừng tiến trình web và API từ mã nguồn |
| `dev/` | [run-api.ps1](dev/run-api.ps1) | Chạy API ở terminal, hỗ trợ `-MigrateOnly` |
| `build/` | [build-android.ps1](build/build-android.ps1) | Build APK Android |
| `test/` | [test-api.ps1](test/test-api.ps1) | API acceptance trên database riêng; `-Performance` để đo tải |
| `test/` | [ci-native.ps1](test/ci-native.ps1) | CI Windows: SQL LocalDB, API và browser trên bản publish, không Docker |
| `test/` | [ci-integration.sh](test/ci-integration.sh) | Luồng kiểm thử Linux cũ dùng Docker SQL, có thể chạy thủ công |
| `deploy/` | [publish-azure.ps1](deploy/publish-azure.ps1) | Đóng gói React + API thành ZIP cho App Service Windows |
| `deploy/` | [smoke.mjs](deploy/smoke.mjs) | Kiểm tra bản online đúng commit, SQL health, web và route API |
| `docs/` | [generate-traceability.py](docs/generate-traceability.py) | Sinh tài liệu trong `docs/requirements/` và sơ đồ trong `docs/diagrams/` |

Ví dụ:

```powershell
.\scripts\lan\start-lan.ps1 -CheckOnly
.\scripts\test\test-api.ps1
python scripts/docs/generate-traceability.py
```

Các script PowerShell tự xác định thư mục gốc từ vị trí file. Khi thêm script trong một nhóm, lưu dữ liệu phát sinh vào `.local/` hoặc `artifacts/`; không ghi mật khẩu vào log.
