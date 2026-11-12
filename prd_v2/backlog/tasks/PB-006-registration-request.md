# PB-006 Tối giản yêu cầu tiếp nhận trên API và web bệnh nhân

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/test local; chờ PB-004 merge và review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Tiếp nhận |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-003](./PB-003-remove-guest-link.md), [PB-004](./PB-004-core-schema.md) |
| Đối chiếu kế hoạch | P2b |
| Branch gợi ý | `feat/pb-006-registration-request` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Form liên hệ, khoa mong muốn tùy chọn và một mô tả; lưu nguyên văn/ngôn ngữ nguồn. Chặn request chờ hoặc Visit Active theo Patient, mở lại hồ sơ hiện có.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Reception/ReceptionEndpoints.cs; Infrastructure/HospitalDb.cs; apps/web/src/PatientReception.tsx; packages/shared/src/types.ts.

## Tiêu chí chấp nhận

- [x] Gửi đồng thời cùng Patient không tạo nhiều yêu cầu chờ; lỗi/trả lời có requestId hoặc visitId để tiếp tục.
- [x] Không trim/ghi đè bản gốc mô tả; ngôn ngữ nguồn gắn với lần nhập. Khoa mong muốn không quyết định quyền của Reception.
- [x] Web không dùng booking hoặc trường Requests/đối thoại bổ sung trong luồng mới; lịch sử cũ vẫn đọc được theo quyền.

## Kiểm chứng bắt buộc

API race với Account và Guest riêng; test mô tả giữ nguyên; browser gửi mới/trùng/đang có Visit; index cần thiết được test bằng migration fixture.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không dịch mô tả tại submit hoặc tự chọn chuyên khoa; mobile thuộc PB-009.

## Phối hợp và phụ thuộc

ReceptionEndpoints.cs sẽ được PB-008/018 sửa tiếp; merge theo phụ thuộc, tránh sửa cùng block.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

### Kết quả triển khai local — 12/11/2026

Đã fetch toàn bộ remote, fast-forward nhánh task lên origin/main tại `7831c94`
(PB-002 đã merge qua PR #14), rồi fast-forward lên branch
`origin/AnhBao_PB004_core_schema` tại `7739780` theo yêu cầu tiếp tục của người dùng.
PB-003 đã merge qua PR #13. Kiểm tra remote cuối vẫn chưa có PB-004 trên main:
**PB-006 có thể review local nhưng phải chờ PB-004 merge trước khi merge PR này**.
Không tự merge PR của thành viên khác trên GitHub.

Branch làm việc: `feat/pb-006-registration-request`. Giữ lại và hoàn tất phần
chuẩn bị trước đây. Chưa stage, commit, push, mở PR hoặc gửi thông báo ra kênh nhóm;
chưa có reviewer nên không chuyển In review/Done.

#### Thay đổi

- Thêm POST/GET/list `/api/v2/requests`, input bốn trường theo PB-001, trả 201
  DTO V2; kiểm tra trường JSON lạ/giả mạo tại backend. Patient/tên lấy từ phiên/hồ sơ.
- Giữ nguyên mô tả và ngôn ngữ lúc gửi, không dịch list/submit/detail trong task này.
  Khoa xử lý CONSULT do server chọn, độc lập với khoa nguyện vọng.
- Khóa giao dịch và receipt theo phiên/lệnh/Patient; chặn request pending hoặc
  Visit Active cả legacy và V2. Lỗi 409 chỉ trả ID hồ sơ trong quyền đọc của phiên.
  Account nhiều phiên và Guest riêng có kiểm chứng; Guest khác phiên cùng Patient
  không được nhận ID mà chưa có quyền.
- Migration `20261112153806_RegistrationUniquenessV2` và EF snapshot: unique
  pending/active cho tập V2; precheck dừng khi xung đột, không xóa/sửa dữ liệu cũ.
  Guard giao dịch xử lý kiểm tra chéo request–Visit. Chi tiết phạm vi constraint,
  legacy/cutover và rollback nằm trong hướng dẫn bên dưới.
- Web có form liên hệ, khoa tùy chọn, mô tả/ngôn ngữ; mở hồ sơ hiện có khi trùng;
  lịch sử legacy đọc riêng, không có form bổ sung. Guest thiếu tên được dẫn tới
  profile. Bổ sung nhãn sáu ngôn ngữ, bảo toàn nội dung/ngôn ngữ nguồn khi đổi UI locale.
- Mặc định `Workflow:PrdV2Enabled=false`: web tiếp tục luồng legacy; API V2 trả
  503 khi tắt. Legacy không tạo thêm request/booking vượt hồ sơ V2 đang mở;
  legacy supplement/message/booking/confirm không sửa request V2. Xác nhận V2,
  số phiếu, Journey mới và mobile vẫn thuộc PB-008/009, không bật nửa luồng trên
  môi trường dùng chung. `canConfirm=false` cho đến PB-008.
- Thêm test API/browser/migration và cấu hình CI riêng cho V2; cập nhật API/OpenAPI.
  Helper SQL fixture bật QUOTED_IDENTIFIER để UPDATE hoạt động với filtered index.

[Hướng dẫn triển khai, contract, migration, cutover và kiểm thử](../../../codes/docs/requirements/PB-006-REGISTRATION.md).

#### Kiểm chứng thực chạy từ codes/

| Lệnh/kịch bản | Kết quả |
|---|---|
| `npm.cmd run typecheck` | PASS — web/mobile/contracts; .local/pb006-typecheck.log |
| `npm.cmd run lint` | PASS — .local/pb006-lint.log |
| `npm.cmd run build` | PASS — .local/pb006-build.log |
| `dotnet build tests/registration/Registration.Tests.csproj -c Release --no-restore` | PASS — backend + migration runner, 0 warning/error |
| `node --test --test-concurrency=1 tests/api/api.test.mjs` | PASS 23/23 — flag tắt, database mới; .local/pb006-legacy-api.log |
| `node --test --test-name-pattern=disabled tests/api/registration-v2.test.mjs` | PASS 1/1 — .local/pb006-disabled.log |
| `node --test --test-skip-pattern=disabled tests/api/registration-v2.test.mjs` | PASS 7/7 — .local/pb006-api-tests.log |
| `npx.cmd playwright test --config playwright.registration.config.ts` | PASS 8/8 — desktop/Pixel 7 viewport; .local/pb006-browser-tests.log |
| `dotnet run --project tests/registration/Registration.Tests.csproj -c Release --no-build --no-restore` | PASS 9 kiểm chứng — .local/pb006-migration-tests.log |
| `npm.cmd run test:languages:unit` | PASS 3/3 — .local/pb006-languages.log |
| Parse cú pháp scripts/test/ci-native.ps1; kiểm tra ref schema OpenAPI | PASS |
| `git diff --check` từ repo root | PASS |

API/web kiểm thử dùng SQL container riêng `cnpm-pb003-sql`, cổng SQL 14349,
API bật/tắt 5296/5297, web 5196; database cuối
`HospitalAcceptance_1794498568332`. Fixture migration riêng được giữ trong
`HospitalAcceptance_1794498332387`. Không chạy migration hay ghi dữ liệu lên
SQL demo/online. Log, thông tin truy cập và artifact chỉ nằm trong .local/artifacts
được Git bỏ qua. Node 22.19.0/npm 10.9.3 local, .NET SDK 10.0.402, SQL Server thật.

Migration kiểm tra nâng cấp schema PB-004 có nhiều request legacy, giữ ID/nội dung,
unique thật ở DB, downgrade không mất dữ liệu, và dừng nâng cấp fixture V2 xung đột.
API race cùng/khác key, nhiều phiên Account, quyền Guest/Reception và ID trong lỗi
đã kiểm tra. Browser kiểm tra retry, mở request/Visit cũ, nguồn không đổi khi chuyển
ngôn ngữ, đọc lịch sử và Guest hoàn thiện profile. Đã xem ảnh desktop/mobile
`artifacts/chromium-desktop-pb006-reception.png` và
`artifacts/chromium-mobile-pb006-reception.png`.

Một lần regression gặp fixture SQL chưa bật QUOTED_IDENTIFIER sau khi thêm index;
đã sửa helper và chạy lại 23/23. Một ca browser dựa vào thông báo profile thoáng qua
bị fail khi form refresh; đổi sang kiểm tra PUT và dữ liệu lưu thật, lượt cuối 8/8.
Không ghi các lần lỗi đó là PASS. Chưa chạy toàn bộ workflow CI remote hoặc rehearsal
trên backup dữ liệu thật; không tuyên bố sẵn sàng phát hành. Mobile không thuộc PB-006.

#### Nội dung chuẩn bị PR

Tiêu đề: **[PB-006] Tối giản tiếp nhận V2 và mở lại hồ sơ hiện có**.
Trước thay đổi chỉ Guest bị chặn theo phiên, form dùng booking/Requests/bổ sung;
sau thay đổi API V2 chặn trùng theo Patient, giữ mô tả gốc/ngôn ngữ và web mở đúng
request/Visit hiện có. PR phụ thuộc PB-004; giữ Draft nếu PB-004 chưa merge.
File chung cần phối hợp: HospitalDb/snapshot/migration, ReceptionEndpoints, App,
PatientReception, shared types/i18n và ci-native.ps1. Migration chỉ tạo index,
không bật workflow. Bổ sung link PR/reviewer sau khi người dùng cho phép push.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-006, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

