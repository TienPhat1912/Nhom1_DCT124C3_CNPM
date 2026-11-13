# PB-009 Đồng bộ tiếp nhận và kích hoạt Journey trên mobile

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/unit/export local đạt; chờ kiểm thử native và review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Mobile |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-003](./PB-003-remove-guest-link.md), [PB-008](./PB-008-confirm-reception.md) |
| Đối chiếu kế hoạch | P2b |
| Branch gợi ý | `feat/pb-009-mobile-reception` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Dùng hợp đồng tiếp nhận mới; mobile theo dõi yêu cầu và vào Journey Active, hiển thị phiếu mới.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: apps/mobile/src/Reception.tsx, Journey.tsx, App.tsx, Auth.tsx; tests/android/.

## Tiêu chí chấp nhận

- [x] Form giống phạm vi web: liên hệ, khoa tùy chọn, mô tả gốc/ngôn ngữ; request/Visit đã có mở lại đúng hồ sơ. Đã kiểm chứng component bằng device stubs; còn gate native bên dưới.
- [x] Bỏ booking/QR kích hoạt/luồng liên kết; vẫn có Entry/deep link và quyền phục hồi phù hợp. Đã kiểm chứng logic, chưa xác nhận thiết bị.
- [ ] Restart, mất mạng và đổi ngôn ngữ không tạo request/Visit mới hoặc mất dữ liệu đã lưu; phiếu giữ số khi in/xem lại.

## Kiểm chứng bắt buộc

Typecheck, kiểm tra native trên giả lập cho submit → confirm từ web → Journey, cold start/deep link và offline/retry.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không thêm tự phát hoặc hoàn thiện toàn bộ trạng thái khám, thuộc PB-022/025.

## Phối hợp và phụ thuộc

App/Journey/Auth mobile dùng chung PB-020/022; tách commit/component nhỏ để review.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai local trên `feat/pb-009-mobile-reception`, tạo từ `origin/main`
`6e06a54` (PB-005 PR #22). Dependency PB-003 đã merge PR #13; PB-008 đã merge
PR #21 `99d2d22`. Card dependency còn trạng thái cũ; đối chiếu lịch sử Git/PR.
Nhánh task được commit/push theo yêu cầu người dùng; upstream là nhánh PB-009,
không phải `origin/main`. Chưa mở PR, còn gate kiểm thử native trước nghiệm thu.

- Thêm ReceptionV2, chỉ bật theo public config, giữ luồng cũ khi V2 tắt.
  Không gửi name/patient/actor/status; chỉ bốn trường hợp đồng V2.
- Draft, request đang xem, pending body/key và selected Visit lưu SecureStore
  theo SessionId; xếp hàng writes; persist trước POST; retry cùng command sau
  remount/restart. Đổi session/logout xóa draft cũ, cập nhật profile cùng session giữ.
- Root App giữ private screen khi đổi locale/tải config; không reset raw mô tả
  hoặc ngôn ngữ nguồn. Guest thiếu profile được dẫn tới màn hình bổ sung tên.
- Poll/focus request tự mở Journey khi server trả VisitId; Entry Visit kiểm tra
  quyền backend, recovery mở Visit gốc sau lưu session. Không tạo grant từ URI.
- VisitTicket phân biệt snapshot V2 và phiếu legacy; V2 chỉ đọc ngày/số/snapshot
  đã cấp, không QR/redeem/cấp lại. In lại vẫn từ Reception web PB-008.
- [Tài liệu hành vi và gate nghiệm thu](../../../codes/docs/requirements/PB-009-MOBILE-RECEPTION.md),
  [unit test component](../../../codes/tests/unit/native-reception.test.mjs),
  [runner native chưa chạy](../../../codes/tests/android/android-reception.mjs).
- Không thay backend, schema, shared DTO hoặc dependencies native. File chung:
  App.tsx, Auth.tsx, Journey.tsx, runtime.tsx; phối hợp PB-020/022.

### Kiểm chứng local ngày 14/11/2026

| Lệnh/kịch bản | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| `npm run test:reception:unit` | PASS — 19 test | `.local/pb009-unit.log`; code component thật, React hooks/SecureStore/API dùng stubs |
| `node --test tests/unit/native-session.test.mjs tests/unit/native-narration.test.mjs` | PASS — 15 test | `.local/pb009-regression.log`; hồi quy session/Guest/audio cancellation |
| `npm run typecheck` | PASS | `.local/pb009-typecheck.log`; web/mobile/shared contracts |
| `npm run lint` | PASS | `.local/pb009-lint.log`; 0 warning |
| `npm run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb009-mobile-export` | PASS | `.local/pb009-export.log`; Hermes bundle Android, không phải APK |
| `node --check tests/android/android-reception.mjs` | PASS | Kiểm tra cú pháp; chưa chạy runner native |

19 test: payload/rawtext/locale, restart retry cùng key sau response mơ hồ,
lỗi storage chặn POST, session thay giữa persist/send, Guest profile/source,
conflict request V2/legacy/Visit, confirm qua poll không redeem, phiếu snapshot,
Entry UUID/quyền, selected Visit cold start, logout xóa draft, config locale giữ
screen, recovery session rồi Visit, phân trang legacy chỉ đọc độc lập. Lỗi fixture
expiry thiếu trường đã được sửa trước lần chạy đạt; không tính test chưa chạy là pass.
CI thêm unit suite mới.

### Còn phải nghiệm thu trước khi hoàn tất

Người dùng xác nhận chưa có Android SDK/giả lập. Không tự cài bộ SDK/AVD.
Chưa chạy APK/native Android, cold/warm link thực tế, SecureStore thực tế hoặc
layout/font/screen reader; chưa có ảnh native mới. Không dùng export/unit hay
Playwright viewport để thay gate bắt buộc của card.

- [ ] Chuẩn bị SDK/AVD riêng, build/cài APK hiện tại theo Android guide.
- [ ] Chạy `android-reception.mjs` trên API/web/SQL fixture riêng: Guest submit →
  confirm qua web → Journey Active, offline/force-stop/retry, snapshot, cold start,
  Visit deep link và verified recovery. Đối chiếu không tạo request/Visit mới.
- [ ] Kiểm tra Account, Entry trước Auth/unauthorized, Unicode dài và sáu locale/font
  lớn trên thiết bị; thêm ảnh và báo cáo cùng APK hash.
- [ ] Chạy CI, review và mở/merge PR. Chỉ đánh Done sau nghiệm thu và merge.

### Nội dung PR đề xuất

**Tiêu đề:** `[PB-009] Đồng bộ tiếp nhận V2 và Journey trên mobile`

Mobile dùng form tiếp nhận bốn trường, mở hồ sơ hiện có và tự vào Journey sau
xác nhận; phiếu hiển thị snapshot/ngày/số đã cấp, không cần QR kích hoạt. Thêm
draft/command lưu theo session để retry sau restart và giữ nguyên văn khi đổi locale;
Entry và recovery vẫn xác thực quyền backend. Giữ legacy khi cờ V2 tắt.

Unit 19/19, hồi quy 15/15, typecheck/lint/export đạt. Thêm runner native nhưng chưa
chạy do chưa có SDK/giả lập; nếu mở PR ở thời điểm này cần để Draft và ghi gate còn
thiếu, chưa công bố nghiệm thu native.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-009, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

