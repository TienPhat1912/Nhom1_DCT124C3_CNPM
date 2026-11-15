# PB-021 Hoàn thiện Journey bốn trạng thái trên web

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress |
| Người nhận | Codex |
| Reviewer | Chưa phân công |
| Nhóm | Bệnh nhân |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-012](./PB-012-service-return.md), [PB-015](./PB-015-final-settlement.md) |
| Đối chiếu kế hoạch | P3 / QD-03 |
| Branch gợi ý | `feat/pb-021-web-journey` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Hiển thị rõ bước hiện tại, trạng thái khám, nơi cần đến và hành động tiếp theo trên web.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/web/src/PatientJourney.tsx, App.tsx, runtime.tsx; packages/shared/src/types.ts; tests/browser/patient.spec.ts.

## Tiêu chí chấp nhận

- [x] Đang thực hiện dịch vụ chỉ đúng điểm dịch vụ; complete tự chuyển hướng dẫn về phòng cũ và Chờ khám; giữ số phiếu.
- [x] ExamStatus, Visit và Journey không bị gộp thành một trạng thái; Closed/Completed hiển thị lịch sử đúng, không cần bệnh nhân bấm kết thúc.
- [x] Reload/mất mạng giữ dữ liệu đã xem có nhãn cũ; phản hồi đến muộn không ghi đè trạng thái mới. Nghe lại/chỉ đường/hỗ trợ trong tối đa hai thao tác.

## Kiểm chứng bắt buộc

Browser luồng có/không dịch vụ, nhiều vòng, offline/reconnect/out-of-order; typecheck/build.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

TTS tự động thuộc PB-024, không thiết kế lại toàn bộ giao diện.

## Phối hợp và phụ thuộc

PB-024 sửa tiếp Journey/components; hoàn tất task này trước.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Verification (15/11/2026)

| Command (from `codes/`) | Result |
|---|---|
| `npm run typecheck` | PASS: web/mobile/shared/contracts |
| `npm run lint` | PASS |
| `npm run build` | PASS; existing chunk size warning above 500 kB |
| `npm run test:languages:unit` | PASS 3/3, six locale dictionaries |
| `npx playwright test --config playwright.journey.config.ts` | PASS 12/12, desktop and Pixel 7 viewport |
| `tests/final-settlement/run.ps1 -SqlServer '.\SQLEXPRESS'` | PASS: API 6/6 and real SQL/browser 2/2 |
| `git diff --check` | PASS |

Real database fixture: `HospitalAcceptance_1794710868142`; runner stopped API and
restored environment. Full native CI, Android and legacy browser suites were not
run in this task. API-loss tests intercept API traffic; they do not assert that
an uncached app can start without any network access. Screenshots are in ignored
`codes/artifacts/*-pb021-*.png`; mobile completion and service views inspected.

## Local implementation (15/11/2026)

- Branch: `feat/pb-021-web-journey`, base `aa52873` (main after PB-020 PR #35).
- Separate examination, Visit and Journey status; service destination, return to the
  original clinic, unchanged ticket, completed timeline and automatic closure.
- Reuse `/api/visits/{id}`: its localized guidance already includes V2 examination
  status. Add the optional typed field without changing the V2 or legacy API.
- Tab-local snapshots are scoped to session, Visit and language. API loss/reload
  shows saved data as stale; reconnect/focus/poll refreshes it. Reject lower
  aggregate versions and superseded requests, including after language changes.
- Offline reload restores only an unexpired patient shell on transport failure.
  Auth denial, logout and expiry clear snapshots. No bearer token is cached.
  The browser must still have the page assets available; no offline install or
  service worker is introduced. No database migration or mobile change.
- Browser suite: `codes/tests/browser/web-journey.spec.ts`, standalone config
  `codes/playwright.journey.config.ts`; included in native CI. Deterministic API
  responses cover zero/two service rounds, closure, API loss/reload/reconnect,
  stale versions, delayed responses, auth denial, language changes and default
  Visit selection surviving reload.
- Real API/SQL regression: existing final-settlement runner, with patient assertions
  distinguishing Completed examination from Active Visit/Journey before settlement.
- Review, PR and merge are still pending; this task is not Done.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-021, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

