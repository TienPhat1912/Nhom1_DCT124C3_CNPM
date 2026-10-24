## Thông tin học phần

**Topic:** Multilingual Automatic Narration System — Cross-Platform Frontend Development with React.js and React Native with CI/CD Integration.

Sai Gon University, Ho Chi Minh City, VietNam · Software Engineering 2026–2027 · DCT124C3 · Group 01. Giảng viên: **Nguyễn Quốc Huy**.

| Thành viên          | MSSV       |
| ------------------- | ---------- |
| Lê Nguyễn Anh Bảo   | 3124411026 |
| Trần Tiến Phát      | 3124411222 |
| Nguyễn Khải Hoàn Ca | 3124411044 |

# An Tâm — Hệ thống hướng dẫn khám bệnh

Ứng dụng web và Android hướng dẫn bệnh nhân trong quá trình khám bệnh, hỗ trợ tiếng Việt/Anh, QR, bản đồ và giao diện nhân viên theo vai trò.

**Mã nguồn chạy nằm trong `codes/`.** Các lệnh Docker, npm và .NET phải chạy tại thư mục này. Workflow GitHub Actions nằm ở [`.github/workflows/check.yml`](.github/workflows/check.yml).

## 1. Chuẩn bị máy

- Cài Git và Docker Desktop, bật **Linux containers** và chờ Docker khởi động xong.
- Cần Internet cho lần build đầu để tải image và thư viện.
- Chạy web/API/SQL bằng Docker không cần cài Node.js, .NET hoặc SQL Server trên máy.
- Nếu dùng Bash trên Linux, cần có OpenSSL để script sinh mật khẩu (`openssl version` để kiểm tra).

## 2. Nhận mã nguồn

Nếu đã clone dự án, mở terminal tại **gốc repository**, nơi có thư mục `codes/`. Lưu hoặc commit công việc đang làm trước khi pull:

```bash
git status
git switch main
git pull --ff-only origin main
cd codes
```

`--ff-only` dừng khi nhánh local và remote đã tách nhau để bạn xử lý trước khi cập nhật. Nếu remote chưa có commit sửa lỗi mới, cần chờ người phụ trách commit/push; pull chỉ tải những thay đổi đã được đẩy lên GitHub.

Nếu chưa clone:

```bash
git clone https://github.com/TienPhat1912/Nhom1_DCT124C3_CNPM.git
cd Nhom1_DCT124C3_CNPM/codes
```

## 3. Tạo cấu hình và build lại

Chạy từ **`codes/`** sau bước 2. Mở Docker Desktop trước khi chạy.

**Windows — PowerShell:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/setup/bootstrap.ps1 -ConfigOnly
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

**Linux — Bash:**

```bash
bash scripts/setup/bootstrap.sh --config-only
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

Bootstrap tạo `codes/.env` từ mẫu được public trong Git và sinh `codes/.local/demo-access.txt`. Nếu `.env` đã có, script giữ nguyên cấu hình và mật khẩu. Compose build web/API từ mã nguồn vừa pull; API tự chạy migration và tạo dữ liệu demo trên database mới.

**Sau mỗi lần pull code mới, chạy lại bước 3.** Giữ `.env` của máy mình và các Docker volume hiện có. Nếu đang dùng bản chạy source, dừng nó bằng `scripts/dev/stop-dev.ps1` trước để giải phóng cổng.

## 4. Mở ứng dụng và kiểm thử

| Địa chỉ mặc định             | Chức năng                            |
| ---------------------------- | ------------------------------------ |
| http://localhost:5180        | Web bệnh nhân và nhân viên           |
| http://localhost:5180/entry  | Điểm vào công khai và QR             |
| http://127.0.0.1:5280/health | API/SQL, kết quả cần có `status: ok` |

Mở **`codes/.local/demo-access.txt` trên máy của mình** để lấy mật khẩu. Dùng `patient@demo.local` cho bệnh nhân, `admin@demo.local` cho quản trị; [danh sách đầy đủ và cách kiểm tra](codes/README.md#4-đăng-nhập-và-kiểm-tra).

Nếu trình duyệt đang mở bản cũ, tải lại bằng `Ctrl+Shift+R`. Khi có lỗi khởi động, chạy trong `codes/`:

```bash
docker compose logs --tail=100 api web sql
```

## 5. Chạy qua Wi-Fi/LAN và dừng dự án

Trên Windows, sau khi pull, có thể chạy **`codes/Start-LAN.cmd`** để tự tạo/giữ cấu hình, nhận IP của máy, build lại và bật truy cập LAN. Nếu đã dùng chế độ LAN thì dùng cách này cho các lần cập nhật tiếp theo. Link của chính máy đó được ghi trong `codes/.local/lan-access.txt`; lần đầu có thể cần quyền Administrator để cấu hình firewall. Xem [hướng dẫn LAN](codes/docs/guides/LAN.md).

Dừng bằng `codes/Stop-LAN.cmd`, hoặc chạy `docker compose stop` từ `codes/`. Không dùng `docker compose down -v` khi muốn giữ database và khóa QR.

## 6. File nào được chia sẻ qua Git?

Repository chứa mã nguồn, ảnh bản đồ, migration, lockfile, Dockerfile, Compose, `.env.example`, script và kiểm thử. Thành viên tự build lại từ các file này.

`.env`, `.local/`, mật khẩu, SDK, `node_modules/`, APK và kết quả build được bỏ qua bởi `.gitignore`. Không cần gửi các file đó cho nhau; thông tin đăng nhập được sinh riêng trên từng máy.

Hướng dẫn cấu hình chi tiết, chạy source và kiểm thử: **[codes/README.md](codes/README.md)**. Hướng dẫn Android: [ANDROID.md](codes/docs/guides/ANDROID.md).
