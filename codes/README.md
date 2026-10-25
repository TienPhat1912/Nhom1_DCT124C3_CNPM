# Chạy và cập nhật An Tâm

Đây là thư mục mã nguồn ứng dụng: React web, React Native/Expo Android và ASP.NET Core API kết nối SQL Server. Bản demo dùng các tích hợp mô phỏng.

**Mọi lệnh bên dưới chạy từ `codes/`, trừ khối lệnh Git có ghi rõ chạy từ gốc repository.** Nếu vừa mở repository trong IDE, chạy `cd codes` trước. Hướng dẫn bắt đầu nhanh ở [README gốc](../README.md).

## 1. Yêu cầu máy

| Nhu cầu | Công cụ |
|---|---|
| Build và chạy web/API/database | Git; Docker Desktop ở chế độ Linux containers, hoặc Docker Engine + Compose v2 trở lên |
| Chạy source hoặc kiểm thử bằng npm/.NET trên máy | Các công cụ trên + Node.js 22.19.0, npm 10.9.3, .NET SDK 10.0.400 |
| Build APK Android | JDK 17, Android SDK/native tools theo [ANDROID.md](docs/guides/ANDROID.md) |

Phiên bản được khóa trong [`.nvmrc`](.nvmrc), [`package.json`](package.json), [`package-lock.json`](package-lock.json), [`global.json`](global.json) và [`packages.lock.json`](backend/Hospital.Api/packages.lock.json). Dockerfile cài công cụ build trong container; chạy demo Docker không cần cài Node/.NET/SQL trực tiếp.

Luồng Docker đã kiểm tra trên máy x64; chưa kiểm chứng máy ARM/Apple Silicon. Nên có khoảng 8 GB RAM và 15 GB trống cho demo; Android cần thêm dung lượng SDK/cache. Lần build đầu cần Internet.

Script `bootstrap.sh` cần Bash và OpenSSL để sinh mật khẩu; kiểm tra bằng `openssl version`. Luồng PowerShell trên Windows không cần OpenSSL cho cấu hình HTTP mặc định.

Mở Docker Desktop, chờ engine chạy rồi kiểm tra:

```text
git --version
docker --version
docker compose version
docker info
```

## 2. Sau khi pull bản sửa mới

**Tại gốc repository** — thư mục có `.github/` và `codes/`:

```bash
git status
git switch main
git pull --ff-only origin main
cd codes
```

Lưu/commit công việc riêng trước khi pull. Nếu `--ff-only` báo không thể cập nhật, xử lý nhánh local đã tách trước khi tiếp tục; không bỏ qua xung đột rồi commit các dấu `<<<<<<<`/`=======`/`>>>>>>>` vào mã nguồn.

**Windows — PowerShell, tại `codes/`:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/setup/bootstrap.ps1 -ConfigOnly
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
Invoke-RestMethod http://127.0.0.1:5280/health
```

**Linux — Bash, tại `codes/`:**

```bash
bash scripts/setup/bootstrap.sh --config-only
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
curl -fsS http://127.0.0.1:5280/health
```

Lệnh bootstrap sinh `.env` khi chưa có và giữ nguyên cấu hình nếu đã có. `--build` cập nhật image web/API từ source vừa pull; API tự áp dụng migration. Database mới được seed tự động, database đã có người dùng được giữ lại. Thay cổng trong lệnh kiểm tra nếu đã đổi `API_PORT`.

Nếu đang chạy source bằng script dev, dừng trước để tránh chiếm cổng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/dev/stop-dev.ps1
```

Nếu đang chạy chế độ LAN, dùng [Start-LAN.cmd](Start-LAN.cmd) sau khi pull thay cho lệnh Compose phía trên; script tự build và giữ cấu hình truy cập LAN. Sau cập nhật, tải lại trang bằng `Ctrl+Shift+R`.

**Giữ nguyên `.env`, volume `sql-data` và `api-keys` khi cập nhật.** Đổi thư mục clone trên cùng máy thì chuyển `.env` từ bản cũ của chính mình sang `codes/.env` trước khi bootstrap, để mật khẩu khớp volume đang dùng. Mỗi máy dùng cấu hình riêng; không lấy mật khẩu của thành viên khác.

## 3. Clone lần đầu

Từ thư mục muốn chứa repository:

```bash
git clone https://github.com/TienPhat1912/Nhom1_DCT124C3_CNPM.git
cd Nhom1_DCT124C3_CNPM/codes
```

Tiếp tục bằng khối lệnh PowerShell hoặc Bash ở mục 2. Không cần nhận `.env`, `.local/`, database dump, `node_modules/` hoặc bản build từ người khác.

Bootstrap sử dụng [`.env.example`](.env.example), tạo mật khẩu SQL và mật khẩu demo khác nhau, rồi ghi tài khoản vào `.local/demo-access.txt`. File này được tạo lại khi chạy bootstrap với `.env` hiện có. Cấu hình và mật khẩu sinh ra chỉ nằm trên máy của bạn.

## 4. Đăng nhập và kiểm tra

| Địa chỉ mặc định | Chức năng |
|---|---|
| http://localhost:5180 | Giao diện bệnh nhân và nhân viên |
| http://localhost:5180/entry | Điểm vào công khai, QR |
| http://127.0.0.1:5280/health | Kết nối API → SQL, cần trả `status: ok` |
| http://localhost:5180/openapi/v1.json | Đặc tả API qua web proxy |

Mật khẩu nằm trong **`.local/demo-access.txt` của máy đang chạy demo**. Các tài khoản mẫu dùng chung mật khẩu demo đó:

| Email | Vai trò |
|---|---|
| `patient@demo.local` | Bệnh nhân |
| `reception@demo.local` | Tiếp nhận |
| `doctor@demo.local` | Bác sĩ |
| `service@demo.local` | Xét nghiệm/chẩn đoán hình ảnh |
| `cashier@demo.local` | Thu ngân |
| `admin@demo.local` | Quản trị |
| `otherdoctor@demo.local` | Bác sĩ khoa khác để kiểm tra phân quyền |

Có thể chọn **Tiếp tục với tư cách khách**. Máy có Node/npm có thể kiểm tra SQL health, web/proxy, OpenAPI và đăng nhập cả 7 vai trò:

```powershell
npm ci
npm run test:demo
```

Kết quả ghi vào `artifacts/demo-smoke.json`. Nếu không dùng Node, kiểm tra `/health`, mở web và đăng nhập thủ công. Khi có lỗi:

```bash
docker compose ps
docker compose logs --tail=100 api web sql
```

## 5. Cấu hình hệ thống

File local là **`codes/.env`**. Định dạng `KEY=value`, không có dấu nháy hoặc khoảng trắng quanh `=`. Mẫu chia sẻ qua Git là `.env.example`.

| Biến | Mặc định / cách tạo | Ý nghĩa |
|---|---|---|
| `SQL_PASSWORD` | Bootstrap sinh | Mật khẩu SQL Server |
| `DEMO_PASSWORD` | Bootstrap sinh | Mật khẩu tài khoản mẫu khi seed database mới |
| `SQL_PORT` | `14339` | Cổng SQL trên localhost |
| `API_PORT` | `5280` | Cổng API trên localhost |
| `WEB_PORT` | `5180` | Cổng web |
| `DATABASE_NAME` | `HospitalGuidance` | Database ứng dụng |
| `LAN_IP` | Script LAN tự nhận | IPv4 máy chạy Docker khi bật truy cập LAN |

Nếu đổi cổng, chạy lại Compose và dùng URL tương ứng. `npm run test:demo` đọc cổng từ `.env`; browser tests dùng `WEB_URL` và `API_URL` khi cần ghi đè.

**Đổi mật khẩu trong `.env` không đổi mật khẩu đã có trong SQL/database.** Giữ lại file của bộ demo đang dùng. Các Compose file dùng chung tên project `cnpm-guidance`; chỉ chạy một bản của project này trên mỗi máy.

### Wi-Fi/LAN trên Windows

Chạy từ `codes/`:

```powershell
.\Start-LAN.cmd
```

Script chọn card mạng vật lý, cập nhật IP riêng của máy, build/chạy Compose, kiểm tra web/API và cấu hình firewall nếu cần. Link được ghi ở `.local/lan-access.txt`; thiết bị khác phải cùng mạng. Không dùng IP hoặc file `lan-access.txt` từ máy của thành viên khác. Khi đổi Wi-Fi, chạy lại script. Chi tiết: [LAN.md](docs/guides/LAN.md).

### Dừng và chạy lại

```bash
docker compose stop
docker compose up -d --wait --wait-timeout 180
```

Với LAN, dừng bằng `Stop-LAN.cmd` và bật lại bằng `Start-LAN.cmd`. `docker compose down` giữ volume, nhưng **không thêm `-v` nếu cần giữ database và khóa QR**.

HTTPS localhost và APK Android là tùy chọn: xem [script](scripts/README.md) và [ANDROID.md](docs/guides/ANDROID.md). Bản APK phải được build hoặc tải từ artifact CI đã chạy thành công.

## 6. Chạy source để phát triển

Cài đúng Node/npm/.NET ở mục 1. Sau mỗi lần pull thay đổi dependency, chạy lại `npm ci` và `dotnet restore --locked-mode`.

Nếu chuyển từ bản Docker đang dùng sang chạy source, chuẩn bị `.env` trước bằng bootstrap `-ConfigOnly`, rồi đặt `DATABASE_NAME` thành tên database phát triển riêng trước khi chạy các lệnh dưới. Hai môi trường dùng key ring QR khác nhau.

Windows PowerShell, tại `codes/`:

```powershell
npm ci
dotnet restore --locked-mode
dotnet tool restore --tool-manifest ./dotnet-tools.json
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/setup/bootstrap.ps1
docker compose stop api web
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/dev/start-dev.ps1
```

SQL tiếp tục dùng Docker; API và Vite chạy trên máy. Script in URL khi đã sẵn sàng và ghi log trong `.local/`. Dừng bằng `scripts/dev/stop-dev.ps1` như mục 2.

## 7. Kiểm tra trước khi gửi thay đổi

Sau khi cài dependency bằng các lệnh restore ở mục 6:

```powershell
npm run typecheck
npm run lint
npm run build
dotnet build -c Release --no-restore
node --experimental-strip-types --test tests/unit/hospital-map.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File ./tests/setup/bootstrap.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ./tests/lan/startup.ps1
```

Kiểm thử bootstrap PowerShell/Bash trên Windows cần Git Bash. Các kiểm thử tích hợp:

```powershell
# Cần SQL đang chạy; script tạo database acceptance riêng trên cổng API 5281.
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/test/test-api.ps1

# Cần web/API đang chạy; các test này tạo dữ liệu thử trong database đang kết nối.
npx playwright install chromium
npm run test:e2e
```

Nếu đã đổi cổng, đặt `WEB_URL`/`API_URL` trước browser tests. Báo cáo sinh trong `artifacts/`. Chi tiết: [tests/README.md](tests/README.md).

Workflow duy nhất được GitHub chạy nằm tại [`.github/workflows/check.yml` ở gốc repository](../.github/workflows/check.yml). Các lệnh CI chạy trong `codes/`; không tạo thêm workflow bên trong `codes/.github/`. CI tự sinh cấu hình, không cần mật khẩu demo của máy thành viên.

## 8. File public và file local

| Đưa lên Git để thành viên build lại | Sinh riêng trên từng máy, không commit |
|---|---|
| `apps/`, `packages/`, `backend/`, ảnh bản đồ và migrations | `node_modules/`, `bin/`, `obj/`, `dist/`, `.expo/` |
| `package.json`, `package-lock.json`, `packages.lock.json`, `global.json`, `dotnet-tools.json` | SDK, Gradle cache, native project Android/iOS sinh bởi Expo |
| `Dockerfile`, `compose*.yaml`, cấu hình nginx, `.dockerignore` | Docker volume, file database/backup, chứng thư và khóa riêng |
| `.env.example`, `apps/mobile/.env.example` | `.env`, `.env.*` thực tế, `.local/demo-access.txt`, `.local/lan-access.txt` |
| `scripts/`, `tests/`, README và workflow ở gốc | `artifacts/`, ảnh/báo cáo test, APK/AAB, log |

[`.gitignore` ở gốc](../.gitignore) và [`.gitignore` của ứng dụng](.gitignore) bỏ qua file local nhưng giữ mẫu `.env.example` và `.env.*.example`. Các file build/cấu hình cần thiết được chia sẻ cùng source. Không dùng `git add -f` để đưa mật khẩu hoặc thư mục `.local/` lên Git.

Người phụ trách cần commit/push cả bản sửa merge và hướng dẫn này trước khi thành viên pull. Ví dụ, **tại gốc repository**, sau khi đã kiểm tra thay đổi:

```bash
git diff --check
git add .gitignore README.md .github codes
git diff --cached --stat
git diff --cached --name-only
git commit -m "Fix merge conflicts and document team setup"
git push origin main
```

Đọc danh sách staging trước khi commit để chắc chắn chỉ gửi thay đổi dự định. `.gitignore` không tự loại file đã được Git theo dõi; nếu từng commit file local, cần gỡ khỏi index trước khi chia sẻ.

## 9. Lỗi khởi động thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Không tìm thấy Compose file, `package.json` hoặc script | Vào `codes/` trước khi chạy lệnh ứng dụng |
| Docker báo không kết nối engine/named pipe | Mở Docker Desktop, chọn Linux containers và kiểm tra `docker info` |
| Thiếu `.env` / `SQL_PASSWORD` / `DEMO_PASSWORD` | Chạy bootstrap `-ConfigOnly` hoặc `--config-only` |
| SQL không healthy sau khi đổi thư mục/mật khẩu | Dùng `.env` khớp volume hiện có; xem `docker compose logs --tail=100 sql api` |
| Cổng bị chiếm | Dừng phiên source cũ hoặc đổi các biến cổng trong `.env` rồi chạy lại Compose |
| Web báo 502 | Kiểm tra API/SQL, chờ migration hoàn tất và xem log |
| Giao diện vẫn là bản cũ | Build lại với `--build`, rồi `Ctrl+Shift+R` hoặc mở tab ẩn danh |
| Sai mật khẩu demo | Dùng `.local/demo-access.txt` trên máy chạy demo và `.env` đã seed database đó |
| Điện thoại không vào được web | Chạy lại `Start-LAN.cmd`, dùng link mới của máy chủ và cùng Wi-Fi |

Tài liệu bổ sung: [chỉ mục](docs/README.md), [cấu hình Android](docs/guides/ANDROID.md), [cấu hình bản đồ](docs/guides/HOSPITAL_MAP.md), [API](docs/architecture/API.md).

## Nội dung đa ngôn ngữ

Web và Android hỗ trợ Việt, Anh, Trung giản thể, Hàn, Nhật, Nga. Nội dung bệnh viện lưu bằng tiếng Việt; xem [cấu hình dịch và chuyển đổi database](docs/guides/LANGUAGES.md) để bật dịch tự động cho nội dung mới.
