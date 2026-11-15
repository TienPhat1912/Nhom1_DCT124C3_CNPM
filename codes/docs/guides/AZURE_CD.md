# Triển khai online và tự cập nhật trên Azure, không dùng Docker

Mục tiêu: push/merge vào `main` → CI kiểm thử → đóng gói React + .NET → CD triển khai lên Azure → kiểm tra đúng commit đang chạy. SQL kiểm thử nằm trên GitHub runner Windows, tách khỏi Azure SQL của website. APK được build ở job Android riêng.

Repo đã có cấu hình; CD chỉ chạy sau khi cấu hình quyền GitHub và bật `AZURE_DEPLOY_ENABLED`. Làm các bước dưới bằng subscription Azure for Students đang Active. Giá và khả năng cấp tài nguyên tùy subscription/vùng; chỉ tạo App Service khi màn hình xác nhận ghi **Free F1**, và database khi đã áp dụng free offer.

Web App của nhóm đã được tạo và endpoint HTTPS đã phản hồi HTTP 200 ngày 02/11/2026:

| Cấu hình của nhóm | Giá trị |
|---|---|
| Resource Group | `se-final-proj` |
| Web App / `AZURE_WEBAPP_NAME` | `nhom1-cnpm` |
| Region | `East Asia` (`eastasia`) |
| URL / `Web__Origin` | `https://nhom1-cnpm-arcch9dbc4cjh0bp.eastasia-01.azurewebsites.net` |
| `AllowedHosts` | `nhom1-cnpm-arcch9dbc4cjh0bp.eastasia-01.azurewebsites.net` |
| SQL server do nhóm cung cấp | `nhom1-cnpm-sql.database.windows.net` |

HTTP 200 của Web App chưa xác nhận ứng dụng đã được deploy. Sau khi có database và cấu hình GitHub, cần kiểm tra `/health` cùng commit SHA như bước 5.

## 1. Tạo Web App

Trong [Azure Portal](https://portal.azure.com/), chọn **Create a resource → Web App**:

| Trường | Giá trị |
|---|---|
| Subscription | Azure for Students |
| Resource Group | Tạo `rg-antam` hoặc tên nhóm của bạn |
| Name | Tên duy nhất, ví dụ `antam-tennhom` |
| Publish | **Code** |
| Runtime stack | **.NET 10** |
| Operating System | **Windows** |
| Region | Vùng được subscription cho phép, ưu tiên gần Việt Nam |
| Pricing plan | **Free F1** |

Tắt Application Insights trong lần thiết lập miễn phí này. Chưa bật workflow tự sinh trong tab Deployment: repo đã có pipeline phối hợp CI và CD. Review + create → kiểm tra F1 → Create.

Sau khi tạo, lấy **Name** và **Default domain** trong Overview. Dùng đúng hostname Azure hiển thị, kể cả hậu tố ngẫu nhiên nếu có. Ví dụ URL trong hướng dẫn là `https://<default-domain>`.

F1 có quota CPU, không có Always On hoặc deployment slots; có thể cold start và gián đoạn ngắn khi cập nhật. Đây là môi trường đồ án, không phải gói bảo đảm uptime cho bệnh viện.

## 2. Tạo Azure SQL theo free offer

Mở [Azure SQL hub](https://aka.ms/azuresqlhub) → **Create a database → Start free**. Chọn subscription và Resource Group ở bước 1, đặt database `HospitalGuidance`, tạo logical SQL server nếu chưa có. Chọn vùng có free offer, ưu tiên cùng vùng với Web App.

- Xác nhận free allowance đang được áp dụng và chi phí ước tính bằng 0.
- Chọn **Auto-pause the database until next month** khi hết hạn mức. Không chọn tiếp tục tính phí vượt hạn mức.
- Để dùng cấu hình SQL authentication bên dưới, tạo SQL administrator và mật khẩu riêng trên Azure. Không lưu mật khẩu vào Git.
- Dùng database mới cho đồ án. `Demo__Enabled=true` sẽ seed tài khoản mẫu khi database chưa có user.

Kết nối từ Web App: lấy **Outbound IP addresses / Additional outbound IP addresses** trong Properties của Web App. Trong logical SQL server → Networking, bật public endpoint với selected networks và thêm các IP outbound cần thiết thành firewall rules. Khi đổi vùng/tier, kiểm tra lại các địa chỉ này. Không mở toàn bộ Internet cho SQL. Không cần cho GitHub runner kết nối production database: kiểm thử CI dùng LocalDB; migration của bản online chạy trong Web App.

## 3. Đặt cấu hình Web App

Trong Web App → **Settings → Environment variables → App settings**, thêm các giá trị sau (thay placeholder):

| Name | Value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `Web__Origin` | `https://nhom1-cnpm-arcch9dbc4cjh0bp.eastasia-01.azurewebsites.net` (không có dấu `/` cuối) |
| `Web__SecureCookies` | `true` |
| `AllowedHosts` | `nhom1-cnpm-arcch9dbc4cjh0bp.eastasia-01.azurewebsites.net` |
| `ConnectionStrings__Hospital` | `Server=tcp:nhom1-cnpm-sql.database.windows.net,1433;Initial Catalog=HospitalGuidance;User ID=<sql-user>;Password=<sql-password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=60;` |
| `Demo__Enabled` | `true` cho đồ án dùng dữ liệu giả |
| `Demo__Password` | Mật khẩu demo riêng, ít nhất 12 ký tự |
| `Providers__Mode` | `Simulation` |
| `Translation__Provider` | `Dictionary` |
| `WEBSITE_RUN_FROM_PACKAGE` | `1` |

Save/Apply các thay đổi, bật **HTTPS Only** trong cấu hình Web App. Dùng connection string do Azure cung cấp, điền database và thông tin xác thực tương ứng. `HospitalGuidance` là tên đề xuất trong hướng dẫn; kiểm tra đúng tên database đã tạo và thay nếu khác. `.env` trên máy phát triển không được tự nạp khi lên Azure.

React được copy vào `wwwroot` của API; `/api/*` và giao diện dùng cùng origin. IIS/App Service Windows xử lý HTTPS forwarding cho ASP.NET Core, không cần Nginx hoặc tắt kiểm tra trusted proxy. Không đặt `ASPNETCORE_URLS` trên App Service Windows.

ASP.NET Core tự lưu khóa Data Protection trong `%HOME%\ASP.NET\DataProtection-Keys` trên App Service; giữ nguyên `SetApplicationName("HospitalGuidance")`. Khóa nằm ngoài package ZIP nên còn nguyên khi deploy. Không xóa key ring. Nếu chuyển database/QR từ máy khác, cần chuyển cả key ring tương ứng; tạo database online mới sẽ dùng khóa mới. Mặc định App Service không mã hóa các key này ở mức ứng dụng; môi trường thực tế cần đánh giá thêm bảo vệ khóa và dữ liệu.

## 4. Cho GitHub quyền deploy bằng OIDC

Không cần tạo client secret hay đưa mật khẩu SQL vào GitHub.

1. Azure Portal → **Microsoft Entra ID → App registrations → New registration**. Đặt tên `antam-github-deploy`, chọn single tenant và Register.
2. Ghi lại **Application (client) ID** và **Directory (tenant) ID** trong Overview.
3. Trong app registration → **Certificates & secrets → Federated credentials → Add credential**:
   - Scenario: **GitHub Actions deploying Azure resources**.
   - Organization/Owner: `TienPhat1912`; Organization ID: `185695189`.
   - Repository: `Nhom1_DCT124C3_CNPM`; Repository ID: `1360275056`.
   - Entity type: **Environment**.
   - Environment: **`production`**.
   - Audience mặc định: `api://AzureADTokenExchange`.
   - Subject của repository này phải là `repo:TienPhat1912@185695189/Nhom1_DCT124C3_CNPM@1360275056:environment:production`.
   - Trong GitHub → Settings → Actions → OIDC, giữ **Use default template**. **Use immutable subject claim** đã tự động bật cho repository này; kiểm tra tiền tố Subject khớp tên và ID ở trên.
4. Web App → **Access control (IAM) → Add role assignment** → role **Website Contributor** → chọn service principal của app registration vừa tạo. Giới hạn quyền ở Web App này.
5. Lấy **Subscription ID** từ subscription Azure for Students.

Trong GitHub repository:

- **Settings → Environments → New environment**: tạo `production`, giới hạn deployment branch là `main`. Không bật required reviewers nếu muốn tự động hoàn toàn.
- Trong environment `production`, thêm secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` với ba ID tương ứng.
- **Settings → Secrets and variables → Actions → Variables**: thêm repository variable `AZURE_WEBAPP_NAME` bằng tên Web App (không phải URL).
- Sau khi cấu hình Azure và OIDC xong, thêm **repository variable** `AZURE_DEPLOY_ENABLED` bằng **`true`**. Biến bật/tắt này phải ở cấp repository vì nó được đọc trước khi job vào environment.

Nếu app registration hoặc role assignment bị từ chối quyền, ghi lại thông báo lỗi để xử lý quyền của subscription; không cần đổi sang subscription trả phí chỉ để cấu hình CD.

## 5. Commit/push và xem lần deploy đầu

Kiểm tra diff và commit những file phục vụ Azure. Push/merge commit đó vào `main`. Workflow nằm ở [check.yml](../../../.github/workflows/check.yml) tính từ repo gốc; đường dẫn thực tế là `.github/workflows/check.yml`.

Job `application` chạy trên `windows-2022`:

1. Restore dependency đã khóa, lint/typecheck và kiểm thử unit/translation.
2. `publish-azure.ps1` build React, publish API, thêm `release.json` chứa commit SHA và đóng gói `azure-release.zip`.
3. `ci-native.ps1` tạo instance LocalDB riêng, khởi động tối đa ba lần và kiểm tra SQL bằng `sqlcmd SELECT 1` trước khi seed; sau đó chạy SQL/API/migration/performance/Playwright/provider tests trực tiếp trên bản publish. Nếu engine không khởi động, dừng ngay tại bước hạ tầng, lưu `artifacts/localdb-startup.log` và `artifacts/localdb-engine-*.log` trước khi dọn instance; workflow upload các log kể cả khi thất bại. Không coi thông báo/exit code của riêng SqlLocalDB là bằng chứng SQL đã sẵn sàng.
4. Chỉ upload artifact deploy khi các bước trên thành công. Artifact được giữ 14 ngày.

Job `deploy` chỉ chạy trên `main` khi CI thành công và `AZURE_DEPLOY_ENABLED=true`. Job dùng OIDC, tải đúng artifact cùng run, triển khai ZIP rồi kiểm tra `/health`, commit SHA, web asset, `/entry`, route API và catalog. Không rebuild tại server. Deployment chạy tuần tự; commit cũ đã bị thay thế ở `main` được bỏ qua trước khi deploy. Job Android độc lập với web/API.

Trong **Actions**, chờ `application` và `deploy` xanh, rồi mở URL của Web App. `/health` cần trả:

```json
{"status":"ok","database":"SqlServer","version":"<full-commit-sha>"}
```

Đăng nhập lần đầu bằng `admin@demo.local` và `Demo__Password` bạn đã đặt. Nếu database đã có user, đổi `Demo__Password` không đổi mật khẩu cũ. Kiểm tra thêm đăng nhập trên trình duyệt và quét QR trên điện thoại qua HTTPS.

Để xác minh CD, sửa một nội dung giao diện nhỏ, commit/push vào `main`, đợi pipeline xanh rồi tải lại website. Browser đang mở không tự thay toàn bộ ứng dụng nếu chưa tải lại. Android cần tải/cài APK mới theo quy trình riêng.

## 6. Migration, lỗi triển khai và rollback

- Bản này giữ cơ chế hiện có: API chạy migration và catalog sync khi khởi động. CI kiểm thử migration trên database riêng trước khi deploy. Demo seed chỉ chạy khi bật demo và database chưa có user.
- F1 có thể cold start; smoke check chờ readiness và phải thấy đúng SHA. Nếu health không đạt, job CD báo đỏ; không báo thành công chỉ vì ZIP đã upload.
- CI lỗi thì không deploy. CD lỗi sau khi thay package có thể ảnh hưởng bản online; **chưa có automatic rollback hoặc zero-downtime deployment** trên gói này.
- Giữ artifact và commit SHA của bản đã chạy tốt. Muốn rollback, tải `azure-web-<sha>` từ run thành công trước đó, giải nén artifact để có `azure-release.zip`, rồi dùng Azure Cloud Shell với đúng subscription:

```bash
az webapp deploy --resource-group <resource-group> --name <web-app-name> --src-path azure-release.zip --type zip
```

- Sau rollback, kiểm tra `/health.version` đúng SHA cũ và thử đăng nhập. Việc rollback package không rollback database. Chỉ redeploy bản cũ khi tương thích schema hiện tại; với migration phá vỡ tương thích, cần bản sửa tiến hoặc kế hoạch phục hồi database đã kiểm chứng.
- Trước thay đổi schema quan trọng, kiểm tra khả năng point-in-time restore/backup của database và ưu tiên migration tương thích cả bản cũ lẫn mới.
- Có thể tạm tắt CD bằng repository variable `AZURE_DEPLOY_ENABLED=false`; CI vẫn chạy.

## Kiểm tra package trên máy Windows

Từ `codes/`, sau khi `npm ci`:

```powershell
dotnet restore --locked-mode
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/publish-azure.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test/ci-native.ps1
```

Lệnh kiểm thử cần SQL Server LocalDB và `sqlcmd`. Có thể dùng SQL Express cục bộ với `-SqlServer '.\SQLEXPRESS' -ApiPort 5391`; script tạo database `HospitalAcceptance_<timestamp>` mới và không đụng database đang dùng. Với instance SQL có sẵn, các database kiểm thử được giữ lại để kiểm tra; LocalDB riêng trên runner được dừng/xóa khi xong. LocalDB trên runner nằm trong Visual Studio image; script tự tìm tool nếu chưa nằm trong PATH.

## Tài liệu chính thức

- [Azure App Service và GitHub Actions/OIDC](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)
- [App Service .NET](https://learn.microsoft.com/en-us/azure/app-service/quickstart-dotnetcore)
- [Azure SQL free offer](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer?view=azuresql)
- [Data Protection trên Azure](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/default-settings?view=aspnetcore-10.0)
