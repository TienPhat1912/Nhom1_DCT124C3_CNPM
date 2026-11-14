# PB-016 Xem kết quả và khuyến nghị trên web và mobile

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — API/browser/component/export local đạt; chờ native và review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Bệnh nhân |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-009](./PB-009-mobile-reception.md), [PB-014](./PB-014-complete-examination.md) |
| Đối chiếu kế hoạch | P3b |
| Branch gợi ý | `feat/pb-016-patient-results` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Đồng bộ hiển thị kết quả cấu trúc đã xác nhận, lịch sử và khuyến nghị tái khám theo quyền.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Content/ContentEndpoints.cs; apps/web/src/PatientRecords.tsx; apps/mobile/src/Records.tsx; tests/browser/, tests/android/.

## Tiêu chí chấp nhận

- [x] Kết quả xem được khi ExamStatus Completed dù Visit Active; trước đó không lộ nội dung nháp qua API/UI/narration (API/browser/component native).
- [x] Account chỉ xem lịch sử của Account; Guest chỉ các Visit được grant. Không có lời mời liên kết hoặc booking handoff (API/browser/component native).
- [x] Khuyến nghị tái khám gắn đúng Visit và dữ liệu Việt gốc; bản dịch/fallback có nhãn phù hợp; lịch sử legacy vẫn đọc đúng (API/browser/component native).

Gate native trên giả lập/thiết bị thật bên dưới còn mở; không suy native PASS từ
component stubs hoặc browser mobile viewport.

## Kiểm chứng bắt buộc

API ownership/grant/unpublished; browser và native kết quả trước quyết toán, đổi ngôn ngữ, lịch sử legacy.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không tạo lịch hẹn hoặc Visit tái khám tự động.

## Phối hợp và phụ thuộc

PatientRecords/Records cũng chứa hỗ trợ; phối hợp PB-019 hoặc tách component hỗ trợ.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai trên `feat/pb-016-patient-results`; nhánh đã đồng bộ `origin/main`
`ccca5c7`, bao gồm PB-015 PR #29. Giữ cả hai phase test/CI PB-015 và PB-016,
mỗi phase dùng database fixture riêng.
Dependency PB-009 đã merge PR #23 (`f97b348`), PB-014 đã merge PR #28 (`aa1eb1e`);
task card dependency còn ghi trạng thái local cũ.

- [Hợp đồng và gate nghiệm thu](../../../codes/docs/requirements/PB-016-PATIENT-RESULTS.md).
- ContentReader/API clinical-record/narration bảo vệ trạng thái chưa xác nhận;
  Content mở rộng visitId/examStatus/clinicalRecord và followUps.original.
  Bộ lọc dịch giữ nguyên snapshot cấu trúc Việt; chỉ dịch summary/khuyến nghị hiển thị.
- Web/mobile hiển thị ba nhóm snapshot, tác giả/thời điểm, bản gốc và nhãn dịch/fallback;
  bỏ booking handoff. Lỗi quyền sau refresh ẩn dữ liệu cũ; context audio gắn phiên,
  Visit/revision/ngôn ngữ/contentKey. History/ownership/grant giữ theo đường đọc hiện có.
- Không migration, không package mới. CI native có phase API/browser/component PB-016.
- [API tests](../../../codes/tests/api/patient-results.test.mjs),
  [browser tests](../../../codes/tests/browser/patient-results.spec.ts),
  [native component tests](../../../codes/tests/unit/native-results.test.mjs),
  [runner](../../../codes/tests/patient-results/run.ps1),
  [Android acceptance](../../../codes/tests/android/android-results.mjs).

### Kiểm chứng local ngày 14/11/2026

Các lệnh từ `codes/`, SQL `.\SQLEXPRESS` Windows authentication, database fixture
mới riêng mỗi suite. Không ghi database demo/online; giữ fixture, dừng process và
khôi phục env khi runner kết thúc.

| Lệnh/kịch bản | Kết quả |
|---|---|
| `tests/patient-results/run.ps1 -SqlServer '.\SQLEXPRESS' -Regression -Capture` | PASS; API PB-016 4/4, browser desktop/Pixel 7 viewport 4/4, component native 4/4 |
| Lượt chốt runner `-Capture` sau khi khôi phục catalog fixture | PASS; API 4/4, browser 4/4, component native 4/4; fixture `HospitalAcceptance_1794655589217` |
| Hồi quy API PB-014/013/012/011/010/008 | PASS 4/4, 7/7, 6/6, 6/6, 5/5, 7/7 |
| API legacy với V2 tắt | PASS 23/23; giữ nguồn published/history/narration |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS; cảnh báo build chunk lớn hơn 500 kB |
| Native session/narration/reception unit; languages unit | PASS; session 5/5, reception 19/19, languages 3/3; narration không lỗi |
| `npm run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb016-mobile` | PASS, Android Hermes bundle 942 modules |
| Release backend build; `dotnet-ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build` | PASS, build 0 warning/error, model không thay đổi |
| `git diff --check`, parser PowerShell, JavaScript syntax | PASS |
| `scripts/build/build-android.ps1` | Chưa qua gate môi trường: thiếu Android SDK platform 36 |

Sau khi đồng bộ PB-015 từ `origin/main` (`ccca5c7`), đã chạy lại hai runner trên
bản gộp: PB-015 API 6/6, browser 2/2; PB-016 API 4/4, browser 4/4, component native
4/4; typecheck/lint và parser CI đều PASS. Fixture tương ứng
`HospitalAcceptance_1794656381121` và `HospitalAcceptance_1794656441371`.

Fixture regression cuối bắt đầu `HospitalAcceptance_1794655413164`; PB-014/013/012:
`HospitalAcceptance_1794655453394`, `HospitalAcceptance_1794655460708` và database
riêng do runner ghi cho từng suite. Ảnh synthetic
`codes/artifacts/chromium-{desktop,mobile}-pb016-results.png`; đã xem ảnh mobile,
không quan sát thấy lỗi bố cục. Ảnh/log/bundle và credential không đưa vào Git.

Không có SDK platform 36/ADB/AVD tại cấu hình local đang dùng, nên **chưa build/cài
APK mới hoặc chạy Android thật**; script native mới chỉ được kiểm tra cú pháp.
Chưa chạy toàn bộ GitHub CI/default browser hoặc migration upgrade regression.
Không đánh Done trước khi hoàn tất gate native, reviewer và merge.

- [ ] Build và cài APK hiện tại, chạy runner với `-Native` trên AVD `cnpm_api36`;
  kiểm chứng kết quả trước quyết toán, đổi ngôn ngữ, lịch sử legacy và lưu báo cáo/ảnh.
- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-016, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

