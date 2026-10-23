# An Tâm — Hệ thống hướng dẫn khám bệnh

Dự án môn Công nghệ phần mềm: hướng dẫn bệnh nhân từ tiếp nhận, khám, thực hiện dịch vụ đến quyết toán và nhận thuốc. Web có giao diện bệnh nhân và nhân viên theo vai trò; ứng dụng Android dành cho bệnh nhân. Hệ thống hỗ trợ tiếng Việt/Anh, QR, theo dõi hành trình và yêu cầu hỗ trợ.

**Chạy demo: clone → tạo cấu hình → Docker Compose → mở web.** Không cần cài Node.js, .NET hoặc SQL Server trực tiếp khi chạy toàn bộ bằng Docker. Database được tạo và nạp dữ liệu mẫu tự động; các tích hợp với hệ thống bệnh viện bên ngoài đang dùng mô phỏng.

## 1. Yêu cầu máy

| Cách chạy                         | Công cụ cần cài                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Demo web/API/database bằng Docker | Git; Docker Desktop ở chế độ **Linux containers** trên Windows, hoặc Docker Engine + Compose v2 trở lên trên Linux |
| Phát triển từ mã nguồn            | Các công cụ trên + **Node.js 22.19.0**, **npm 10.9.3**, **.NET SDK 10.0.400**                                      |
| Build Android (tùy chọn)          | Node/npm + JDK 17, Android SDK 36; xem [hướng dẫn Android](docs/guides/ANDROID.md)                                 |

Luồng demo chính dành cho máy x64; cấu hình Windows/Linux dùng SQL Server container. Máy ARM/Apple Silicon chưa được kiểm chứng trong dự án. Nên dành khoảng 8 GB RAM và 15 GB đĩa trống cho demo; build Android cần thêm dung lượng SDK/cache. Lần đầu cần Internet để tải image và thư viện.

Kiểm tra Docker đã sẵn sàng:

```text
git --version
docker --version
docker compose version
docker info
```

Trên Windows, mở Docker Desktop và chờ engine chạy xong trước khi tiếp tục. Chạy các lệnh bên dưới từ thư mục gốc repository.

## 2. Clone và chạy demo

```bash
git clone https://github.com/TienPhat1912/se-final-project.git
cd se-final-project
```

**Windows — PowerShell:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/setup/bootstrap.ps1 -ConfigOnly
docker compose up -d --build --wait --wait-timeout 180
```

**Linux — Bash** (script cũng chạy được trong Git Bash/macOS; hỗ trợ container còn phụ thuộc kiến trúc máy):

```bash
bash scripts/setup/bootstrap.sh --config-only
docker compose up -d --build --wait --wait-timeout 180
```

Bootstrap tạo `.env` từ [.env.example](.env.example), sinh mật khẩu riêng và ghi thông tin đăng nhập vào `.local/demo-access.txt`. Chạy lại sẽ giữ nguyên `.env` hiện có. Không cần copy `.env` của thành viên khác. Nếu tự copy template, phải thay cả hai giá trị `REPLACE_WITH_...` trước khi chạy.

Khi container đã chạy, mở:

| Địa chỉ mặc định                      | Mục đích                                        |
| ------------------------------------- | ----------------------------------------------- |
| http://localhost:5180                 | Giao diện hệ thống                              |
| http://localhost:5180/entry           | Điểm vào công khai, QR bệnh viện                |
| http://127.0.0.1:5280/health          | Kiểm tra API kết nối được SQL; trả `status: ok` |
| http://localhost:5180/openapi/v1.json | Đặc tả API đang chạy                            |

API có thể cần thêm vài giây để chạy migration và seed trong lần đầu. Kiểm tra bằng `docker compose ps` và `docker compose logs --tail=100 api`. SQL và API chỉ mở trực tiếp trên localhost; web chuyển tiếp `/api/` đến backend.

### Tài khoản demo

Mở file `.local/demo-access.txt` để lấy mật khẩu. Các tài khoản dưới đây dùng chung **mật khẩu demo được sinh trên máy của bạn**:

| Email                    | Vai trò                                        |
| ------------------------ | ---------------------------------------------- |
| `patient@demo.local`     | Bệnh nhân                                      |
| `reception@demo.local`   | Tiếp nhận, cấp phiếu và hỗ trợ                 |
| `doctor@demo.local`      | Bác sĩ khoa khám                               |
| `service@demo.local`     | Xét nghiệm, chẩn đoán hình ảnh                 |
| `cashier@demo.local`     | Quyết toán mô phỏng                            |
| `admin@demo.local`       | Dashboard, cấu hình, nhân viên và quyền        |
| `otherdoctor@demo.local` | Bác sĩ khoa khác để kiểm tra giới hạn truy cập |

Có thể chọn **Tiếp tục với tư cách khách** mà không đăng nhập. Đăng ký công khai chỉ tạo tài khoản bệnh nhân. Xem [kịch bản demo theo vai trò](docs/guides/DEMO.md) để trình diễn đầy đủ quy trình.

### Dừng, chạy lại và cập nhật

```bash
docker compose stop
docker compose up -d --wait --wait-timeout 180

# Sau khi nhận mã nguồn mới (xử lý/commit thay đổi riêng trước khi pull):
git pull
docker compose up -d --build --wait --wait-timeout 180
```

`docker compose down` gỡ container/network nhưng vẫn giữ volume. **Không thêm `-v` nếu cần giữ dữ liệu**: volume chứa database và khóa bảo vệ QR. Không cần khởi tạo lại `.env` khi cập nhật source.

## 3. Cấu hình hệ thống

File cấu hình gốc là `.env`, không được commit. Bootstrap hỗ trợ giá trị dạng `KEY=value`, không có dấu nháy hay khoảng trắng quanh `=`.

| Biến            | Mặc định / cách đặt | Tác dụng                                               |
| --------------- | ------------------- | ------------------------------------------------------ |
| `SQL_PASSWORD`  | Bootstrap tự sinh   | Mật khẩu SQL Server; khác mật khẩu tài khoản demo      |
| `DEMO_PASSWORD` | Bootstrap tự sinh   | Mật khẩu dùng khi seed các tài khoản demo              |
| `SQL_PORT`      | `14339`             | Cổng SQL trên máy chủ, ánh xạ tới 1433 trong container |
| `API_PORT`      | `5280`              | Cổng API trên máy chủ                                  |
| `WEB_PORT`      | `5180`              | Cổng mở giao diện web                                  |
| `DATABASE_NAME` | `HospitalGuidance`  | Tên database, gồm chữ/số/`_`, bắt đầu bằng chữ         |
| `LAN_IP`        | Không đặt           | IPv4 máy chủ khi dùng cấu hình LAN                     |

Nếu cổng bị trùng, đổi cổng tương ứng trong `.env`, rồi chạy lại `docker compose up -d --build --wait --wait-timeout 180`. Script phát triển và Vite cũng đọc `API_PORT`/`WEB_PORT` từ file này. Ví dụ đổi `WEB_PORT=5188` thì mở `http://localhost:5188`.

Nếu tự đặt mật khẩu, dùng 8–128 ký tự gồm chữ, số hoặc `! @ % _ + = . -`; mật khẩu SQL cần đủ độ phức tạp (nên có chữ hoa, chữ thường, số, ký tự đặc biệt). Dùng mật khẩu bootstrap sinh giúp tránh lỗi cú pháp giữa Compose, shell và connection string.

**Đổi mật khẩu trong `.env` không đổi mật khẩu đã lưu trong database/volume.** Giữ lại file cấu hình của bộ dữ liệu đang dùng. Muốn có bộ demo mới mà giữ hồ sơ cũ, đổi `DATABASE_NAME` sang tên khác, giữ `SQL_PASSWORD` rồi chạy:

```bash
docker compose up -d --force-recreate api
```

Database mới được migrate/seed tự động; có thể quay lại tên database cũ. Khi chuyển giữa chạy source và Docker, nên dùng database riêng vì hai môi trường có key ring QR khác nhau; xem [quyết định thiết kế](docs/architecture/DECISIONS.md).

## 4. Chạy từ mã nguồn để phát triển

Phiên bản Node nằm trong [.nvmrc](.nvmrc), SDK .NET nằm trong [global.json](global.json). Dùng `npm ci` và NuGet locked restore để cài đúng lockfile.

Trên Windows PowerShell:

```powershell
npm ci
dotnet restore --locked-mode
dotnet tool restore
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/setup/bootstrap.ps1

# Tránh trùng cổng nếu trước đó đã chạy toàn bộ Compose:
docker compose stop api web
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/dev/start-dev.ps1
```

SQL tiếp tục chạy bằng Docker; script build/chạy API và Vite, đợi API phản hồi rồi in địa chỉ. Log nằm trong `.local/api.*.log` và `.local/web.*.log`. Dừng các tiến trình do script tạo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/dev/stop-dev.ps1
```

Để chạy trong hai terminal và xem log trực tiếp, sau các bước cài dependency/SQL ở trên: terminal 1 chạy `./scripts/dev/run-api.ps1`; terminal 2 chạy `npm run dev`. Dùng `Ctrl+C` để dừng. Script PowerShell dev dành cho Windows; Linux có thể dùng demo Docker hoặc chạy API với các biến môi trường tương ứng trong `compose.yaml`.

API tự áp dụng migration khi khởi động. Chỉ migrate/seed: `./scripts/dev/run-api.ps1 -MigrateOnly`. Thêm migration sau khi sửa model: `dotnet ef migrations add TenMigration --project backend/Hospital.Api`. Commit file migration và lockfile nếu có thay đổi dependency.

## 5. Chạy demo qua LAN, HTTPS và Android

- **LAN trên Windows:** bấm `Start-LAN.cmd`; script tự nhận IP, chuẩn bị cấu hình và chạy Docker. Lần đầu có thể cần quyền Administrator để mở firewall. Các thiết bị cùng mạng mở link trong `.local/lan-access.txt`. Dừng bằng `Stop-LAN.cmd`. Xem [hướng dẫn LAN](docs/guides/LAN.md).
- **HTTPS localhost:** sau bootstrap, cài OpenSSL vào PATH rồi chạy `./scripts/setup/enable-https.ps1`; mở `https://localhost:8443` với chứng thư tự ký. Trở về HTTP bằng `docker compose up -d --force-recreate api web`.
- **Android:** tùy chọn, không bắt buộc cho demo web. Xem [cấu hình, build và cài Android](docs/guides/ANDROID.md). APK và SDK không được commit; mỗi thành viên tự build hoặc tải APK từ artifact của GitHub Actions đã chạy thành công.

## 6. Kiểm tra trước khi gửi code

```powershell
npm run typecheck
npm run lint
npm run build
dotnet build -c Release --no-restore
powershell -NoProfile -ExecutionPolicy Bypass -File ./tests/setup/bootstrap.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ./tests/lan/startup.ps1

# Cần demo Docker đang chạy; kiểm tra health, web, proxy và 7 vai trò:
npm run test:demo

# Cần SQL đang chạy; API acceptance dùng database riêng và cổng 5281:
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/test/test-api.ps1

# Cần web/API đang chạy; tạo dữ liệu demo mới trong database hiện tại:
npx playwright install chromium
npm run test:e2e
```

Khi đổi cổng, smoke test tự đọc `.env`. Với browser tests, đặt `WEB_URL` và `API_URL` trỏ tới địa chỉ mới trong môi trường terminal. Các báo cáo/ảnh/bundle mới nằm trong `artifacts/` và không được Git theo dõi. Xem [hướng dẫn kiểm thử](tests/README.md).

Workflow [check.yml](.github/workflows/check.yml) chạy khi push/pull request: kiểm tra bootstrap, typecheck/lint/build, tích hợp SQL/API/browser, bundle mobile và build Docker; job Android tạo APK artifact. CI tự sinh mật khẩu, không cần đưa `.env` của máy cá nhân lên GitHub. Kết quả CI chỉ được xác nhận sau khi workflow thực sự chạy trên repository.

## 7. Cấu trúc repository

```text
apps/web/                   React + TypeScript + Vite, giao diện bệnh nhân/nhân viên
apps/mobile/                React Native + Expo, ứng dụng bệnh nhân
backend/Hospital.Api/       ASP.NET Core 10, nghiệp vụ, EF Core migrations
packages/shared/            API client, kiểu dữ liệu, bản dịch dùng chung
scripts/setup/              Sinh cấu hình và HTTPS
scripts/dev/                Chạy/dừng source
scripts/lan/                Khởi động LAN và firewall
scripts/build/              Build Android
scripts/test/               Chạy acceptance/CI
scripts/docs/               Sinh tài liệu truy vết
tests/                      api/, browser/, android/, lan/, setup/
docs/                       Hướng dẫn, kiến trúc, yêu cầu, sơ đồ
archive/                    File cũ không cần chạy demo; chỉ commit chỉ mục
<<<<<<< HEAD
../.github/workflows/       Kiểm tra tự động khi push/pull request (gốc repository)
=======
.github/workflows/          Kiểm tra tự động khi push/pull request
>>>>>>> AnhBao
compose*.yaml               Docker demo, tùy chọn LAN/HTTPS
.env.example                Mẫu cấu hình an toàn để chia sẻ
```

Mã nguồn, migrations, lockfile, test, script và tài liệu sử dụng được giữ trong repository. File không cần cho bản clone mới đã gom vào [archive/](archive/README.md), kèm [danh mục di chuyển](archive/MANIFEST.md). `.env`, `.local/`, `node_modules/`, `bin/`, `obj/`, `dist/` và `artifacts/` là dữ liệu riêng/phát sinh, được `.gitignore` bỏ qua.

## 8. Đưa lên GitHub và làm việc nhóm

Repository dùng remote `https://github.com/TienPhat1912/se-final-project.git`. Sau khi kiểm tra các thay đổi:

```bash
git status
git diff --check
git add .
git diff --cached --stat
git commit -m "Prepare reproducible demo and reorganize project"
git push -u origin HEAD
```

Kiểm tra danh sách staging trước khi commit: không có `.env`, mật khẩu, APK, SDK hay thư mục lưu trữ cục bộ. Không dùng `git add -f` cho các file này. Nếu GitHub từ chối quyền push, đăng nhập bằng tài khoản được cấp quyền repository hoặc tạo fork/nhánh và gửi pull request. Thành viên khác chỉ cần làm theo mục 1–3, không cần nhận file cấu hình riêng từ người tạo dự án.

## 9. Lỗi thường gặp

| Hiện tượng                              | Cách xử lý                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Không kết nối được Docker / named pipe  | Mở Docker Desktop, chờ engine; chọn Linux containers; kiểm tra `docker info`                                        |
| PowerShell chặn chạy script             | Dùng lệnh `powershell -NoProfile -ExecutionPolicy Bypass -File ...` như hướng dẫn; chỉ áp dụng cho tiến trình đó    |
| Thiếu `SQL_PASSWORD` / `DEMO_PASSWORD`  | Chạy bootstrap; nếu đã copy template, thay giá trị `REPLACE_WITH_...`                                               |
| Cổng đang được sử dụng                  | Dừng phiên source/Compose cũ hoặc đổi cổng trong `.env`                                                             |
| SQL unhealthy / API thoát khi khởi động | Xem `docker compose logs --tail=100 sql api`; kiểm tra Docker đủ RAM, mật khẩu SQL đủ mạnh và khớp volume đang dùng |
| Web mở được nhưng API báo 502           | Đợi migration/seed, kiểm tra `/health` và log API; API cần kết nối được SQL                                         |
| Đăng nhập demo sai mật khẩu             | Dùng `.local/demo-access.txt`; nếu tự đổi `.env` sau khi seed thì mật khẩu trong database vẫn là mật khẩu cũ        |
| Không tìm thấy SDK .NET phù hợp         | Cài SDK 10.0.400 theo `global.json`, hoặc dùng toàn bộ Docker                                                       |
| Thiếu APK/ảnh/báo cáo trong bản clone   | Đây là file phát sinh được ignore; build/chạy test để tạo lại hoặc tải artifact CI                                  |

Tài liệu chi tiết: [chỉ mục tài liệu](docs/README.md), [script](scripts/README.md), [API](docs/architecture/API.md), [truy vết yêu cầu](docs/requirements/TRACEABILITY.md). Đây là bản demo học tập với dữ liệu tổng hợp, chưa phải hệ thống triển khai trong bệnh viện thật.
