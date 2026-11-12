# PB-003 Bỏ liên kết Guest với tài khoản trên API, web và mobile

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — đã triển khai local, chờ kiểm chứng thiết bị/review; chưa commit/push |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Tài khoản |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | Không |
| Đối chiếu kế hoạch | P2a / QD-06 |
| Branch gợi ý | `feat/pb-003-remove-guest-link` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Loại lời mời, màn hình và API tạo liên kết mới. Giữ đăng ký/login độc lập và khôi phục Guest.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Identity/IdentityEndpoints.cs; apps/web/src/Auth.tsx, App.tsx, PatientJourney.tsx; apps/mobile/src/Auth.tsx, App.tsx, Journey.tsx; nhãn và test liên quan.

## Tiêu chí chấp nhận

- [x] link-claim/convert không còn tạo claim hoặc thay PatientId/grant; client cũ nhận lỗi chức năng ngừng hoặc endpoint không còn hỗ trợ.
- [x] Account đăng ký mới không nhận dữ liệu Guest; đổi phiên xóa cache nhạy cảm và dừng âm thanh của phiên trước.
- [x] Khôi phục Guest vẫn hoạt động; dữ liệu đã liên kết từ trước không bị tách ngược hoặc mất quyền. Không còn đường UI liên kết tại profile/Journey.

## Kiểm chứng bắt buộc

API chặn cả hai endpoint cũ; browser và mobile kiểm tra đăng ký độc lập/đổi phiên; hồi quy recovery. Cập nhật test conversion cũ thành test hành vi bị loại.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không drop bảng LinkClaim hoặc xóa lịch sử liên kết; không thay cơ chế login.

## Phối hợp và phụ thuộc

Sửa App/Auth ở cả hai nền tảng; merge trước khi các task Journey thay điều hướng.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

### Kết quả local — 12/11/2026

- Branch thực tế: `feat/pb-003-remove-guest-link`, tạo từ `origin/main` sau fetch;
  base `adaeaa3` (PR #12). Workspace ban đầu sạch. Theo yêu cầu người dùng:
  **chưa stage, commit, push hoặc mở PR; không thông báo ra kênh nhóm**.
- API giữ hai đường dẫn cũ để trả 410 `guestLinkDisabled`, bỏ hoàn toàn logic tạo
  claim/convert. Claim cũ còn hạn cũng không dùng được; không xác thực credential,
  tạo phiên hay thay PatientId/grant. Giữ bảng LinkClaim, recovery và lịch sử cũ;
  không có migration hoặc thay đổi cơ chế đăng nhập.
- Web/mobile bỏ LinkAccount, lời mời tại profile/Journey, route/modal và các nhãn
  liên quan trong sáu ngôn ngữ. Auth đăng ký/login vốn dùng endpoint độc lập nên
  được giữ và kiểm chứng lại. Đổi phiên remount màn hình riêng tư, dừng âm thanh,
  bỏ lựa chọn/continuation của người trước; giữ deep link Entry ở lần đăng nhập đầu.
- Thay test conversion cũ bằng test chặn liên kết, đăng ký độc lập và recovery;
  thêm fixture quyền sở hữu đã liên kết trước nâng cấp. Unit mobile chạy component
  thật với dịch vụ thiết bị giả lập; test mới được thêm vào CI. Cập nhật API/OpenAPI,
  quyết định kỹ thuật và hướng dẫn kiểm thử Android.

| Kiểm chứng từ `codes/` | Kết quả / bằng chứng local |
|---|---|
| `npm.cmd run typecheck` | PASS — web/mobile/contracts; `.local/pb003-typecheck.log` |
| `npm.cmd run lint` | PASS — không cảnh báo; `.local/pb003-lint.log` |
| `npm.cmd run build` | PASS — production Vite; `.local/pb003-build.log` |
| `dotnet build -c Release --no-restore` | PASS — 0 warning, 0 error; `.local/pb003-dotnet-build.log` |
| `node --test --test-concurrency=1 tests/api/api.test.mjs` | PASS 23/23; `.local/pb003-api-tests.log` |
| `npx.cmd playwright test tests/browser/patient.spec.ts tests/browser/web-client.spec.ts` | PASS 18/18 — desktop/Pixel 7 viewport; `.local/pb003-browser-tests.log` |
| `npm.cmd run test:session:unit` | PASS 5/5; `.local/pb003-test-session-unit.log` |
| `npm.cmd run test:narration:unit` | PASS 10/10; `.local/pb003-test-narration-unit.log` |
| `npm.cmd run test:languages:unit` | PASS 3/3; `.local/pb003-test-languages-unit.log` |
| `npm.cmd run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb003-mobile-android` | PASS — 938 modules, bundle Hermes; `.local/pb003-mobile-export.log` |
| `git diff --check` (repo root) | PASS |

Build cuối đã chạy lại sau thay đổi metadata OpenAPI/session. Probe bản API build
cuối kiểm tra cả hai endpoint trả 410, không đổi cookie và snapshot OpenAPI khớp
endpoint thật: PASS, `.local/pb003-final-probe.log`. API/web kiểm thử và container
SQL riêng đã dừng sau kiểm chứng; giữ database/artifact/log để đối chiếu.

API/browser dùng container riêng `cnpm-pb003-sql` (SQL 14349), API 5293, web 5193;
database cuối `HospitalAcceptance_1794492490124`. Không ghi dữ liệu vào database
demo/online. Bộ API đầy đủ cần database mới: một lần chạy lại trên fixture đã dùng
bị lỗi mapping/booking; lần chạy cuối trên database mới đã đạt 23/23. Fixture lịch sử
đã bổ sung `QUOTED_IDENTIFIER ON` để cập nhật bảng có filtered index.

Node 22.19.0/npm 10.9.3 lấy từ `.local/tools/node-v22.19.0-win-x64` qua PATH của
tiến trình; .NET SDK 10.0.402. Sandbox chặn Node child processes (`EPERM`), nên
build/unit/browser được chạy với quyền công cụ phù hợp. Cảnh báo màu terminal của
Node không phải lỗi test; PowerShell dùng exit code thực tế để ghi kết quả.

Ảnh đã xem lại: `artifacts/chromium-desktop-pb003-independent-profile.png`,
`artifacts/chromium-mobile-pb003-independent-profile.png` và
`artifacts/chromium-mobile-journey.png`. Browser đã kiểm tra đổi tài khoản không
còn phiếu/dữ liệu cũ và phản hồi narration đến muộn không phát âm thanh.
Artifact/log/cấu hình test nằm trong thư mục Git bỏ qua, không đưa vào PR.

**Chưa kiểm chứng:** APK native và luồng trên giả lập/thiết bị, SecureStore sau
restart thật, giọng đọc thiết bị và font scaling native. Máy hiện không có Android
SDK/ADB theo cấu hình dự án. `tests/android/android-account.mjs` đã chuyển sang
kịch bản đăng ký độc lập/Guest recovery nhưng chưa chạy. Bundle export và unit
giả lập không thay thế các bước này. Chưa có reviewer hoặc bằng chứng CI remote;
task giữ In progress, chưa đạt quy ước Done.

### Nội dung chuẩn bị cho PR

Tiêu đề: **[PB-003] Bỏ liên kết Guest, giữ đăng ký độc lập và khôi phục**.
Trước thay đổi Guest có thể chuyển/gộp quyền vào tài khoản qua API và UI; sau thay
đổi hai API trả 410, tài khoản mới có Patient riêng và Guest khôi phục bằng quy
trình đã xác minh. Phụ thuộc: Không. File chung cần lưu ý khi merge: web/mobile
App, Records/Journey, `i18n.ts`/translations, API/OpenAPI và workflow kiểm thử.
Không có migration hoặc cờ bật tính năng mới. Điền reviewer và link PR khi người
dùng cho phép commit/push; hoàn tất kiểm chứng Android trước khi xác nhận Done.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-003, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

