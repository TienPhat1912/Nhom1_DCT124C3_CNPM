# PB-027 — Bốn ngôn ngữ chính và dữ liệu locale cũ

Branch `feat/pb-027-four-languages`, base `origin/main` tại `eb868b1`.
PB-016/018/019/020/026/029 đã merge. Không có migration, không đổi dữ liệu SQL.

## Hành vi và tương thích

- Trước đây picker có sáu ngôn ngữ trong khi `/api/entry` chỉ trả vi/en. Nay
  Entry, `/api/config.languages`, picker đăng nhập/hồ sơ và native đều công bố
  đúng thứ tự **vi/en/zh/ja**. Form nguồn tự khai V2 cũng dùng bốn mã này.
- Entry có picker; URL, link app và web fallback mang cùng lựa chọn. Đổi lựa
  chọn rồi reload giữ đúng ngôn ngữ. Deep link native tiếp nhận cùng bốn mã.
- `languages` là bốn lựa chọn UI; `supportedLanguages` và `isLocale` vẫn hiểu
  sáu mã. `displayLocale` dùng tiếng Việt cho ko/ru hoặc mã lạ, trong khi
  `normalizeLocale` tiếp tục giữ ko/ru hợp lệ cho nội dung/dữ liệu lịch sử.
  Backend `Languages.Primary` công bố bốn mã; `Languages.Supported/Normalize`
  tiếp tục nhận ko/ru cho client cũ và bản gốc lịch sử. Không đổi nhãn nguồn
  tiếng Hàn/Nga thành tiếng Việt hoặc xóa dictionary/giọng đọc cũ.
- Khi khôi phục tùy chọn ko/ru, picker hiển thị tiếng Việt và thông báo rõ.
  Việc khôi phục không ghi đè tùy chọn đó. Người dùng có thể chọn một trong bốn
  ngôn ngữ chính; đổi UI không gọi lệnh sửa hồ sơ/Visit hoặc dọn lịch sử.
- Speech dùng ngôn ngữ văn bản API trả về: vi-VN/en-US/zh-CN/ja-JP cho luồng
  chính, vẫn có ko-KR/ru-RU khi đọc nội dung tương thích. Dịch lỗi giữ bản gốc
  và đọc đúng ngôn ngữ bản gốc; thiếu giọng báo lỗi, không giả đọc giọng khác.
- Sửa validation `accountExists` ở đủ sáu dictionary: hướng dẫn đăng nhập bằng
  tài khoản đã có, bỏ lời mời liên kết. Booking legacy vẫn nằm sau cờ workflow;
  luồng V2 không hiển thị booking/liên kết Guest. Không xóa dữ liệu hay API cũ
  ngoài phạm vi PB-027.

## Kiểm chứng trên máy ngày 15/11/2026

| Lệnh/kịch bản từ `codes/` | Kết quả |
|---|---|
| `npm run typecheck` | Pass web, native và contracts |
| `npm run lint` | Pass |
| `scripts/deploy/publish-azure.ps1` | Pass Vite/web và .NET Release publish |
| `npm run test:languages:unit` | 15/15: dictionary đầy đủ, quét nhãn literal, fallback, route labels, native picker và restart sáu locale |
| `node --experimental-strip-types --test tests/unit/native-*.test.mjs` | 94/94, gồm bốn ca narration thực thi hook native với giọng giả |
| `npm run test:translation` | Pass provider giả: sáu locale, cache, quyền, nguồn gốc, display/narration binding, scoped source/target và lỗi provider |
| `npx playwright test --config playwright.languages.config.ts` | 20/20 desktop/Pixel 7 web: bốn locale V2, picker, Entry/link/reload, legacy ko/ru và giữ lịch sử |
| `node --test tests/api/languages-v2.test.mjs` với API/SQL fixture riêng | 2/2 legacy ko/ru: metadata bốn mã, không tạo Visit khi mở Entry, không đổi hồ sơ/ID/version/status/steps khi đổi query language |
| `npm run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb027-mobile-export` | Pass Android JS/Hermes bundle; chưa build/cài APK |

API tests dùng SQL Server container local, database `HospitalAcceptance_*` mới,
workflow V2 tắt để dựng attendance legacy; không ghi database demo. CI đã nối
hai ca API vào `ci-native.ps1`; unit/native language nằm trong script languages
đã có của CI, browser languages nằm trong suite mặc định. Chưa chạy toàn bộ
pipeline Windows LocalDB trên máy này.

Ảnh giao diện reception: `artifacts/pb027-{vi,en,zh,ja}-{chromium-desktop,chromium-mobile}.png`.
Ảnh tắt animation hữu hạn để tránh chụp drawer đang đóng. Browser đo không tràn
ngang trên mỗi locale. Đây là viewport web, không phải kiểm chứng bố cục Android.
Log ở `.local/pb027-*.log`; ảnh/log/bundle/credentials không commit.

## Chạy lại API

Publish bằng `scripts/deploy/publish-azure.ps1`. Dùng database SQL local mới
`HospitalAcceptance_<timestamp>`, đặt `ACCEPTANCE_DB`, `ConnectionStrings__Hospital`,
`DEMO_PASSWORD`, `Demo__Enabled=true`, `Demo__Password` cùng mật khẩu và
`Workflow__PrdV2Enabled=false`. Từ thư mục published chạy
`dotnet Hospital.Api.dll --migrate-only`, sau đó khởi động API với `--no-migrate`.
Đặt `API_URL` trỏ API đó rồi chạy lệnh API trong bảng. Hoặc chạy
`scripts/test/ci-native.ps1` sau publish trên Windows có SQL LocalDB.

## Gate native trước khi nghiệm thu

Máy chưa có adb/JDK/SDK/giả lập hoặc thiết bị kết nối. Chưa kiểm chứng layout,
font, SecureStore thật, deep link hệ điều hành và âm thanh thật của APK. Unit
test thực thi component/hook với React/AppState/SecureStore/Speech giả không
thay thế gate này. Trên APK mới theo [Android](../guides/ANDROID.md), cần:

1. Kiểm tra picker đúng bốn lựa chọn ở Auth và trong app; thử từng vi/en/zh/ja
   qua tiếp nhận, Journey, kết quả, trợ giúp, khôi phục Guest và bản đồ.
2. Kiểm tra nhãn dài, chữ Trung/Nhật, bàn phím và tăng cỡ chữ; không cắt chữ,
   tràn ngang hoặc che nút. Phát hướng dẫn, gọi số và chỉ đường, đối chiếu giọng
   với ngôn ngữ văn bản; thử thiếu giọng và dịch lỗi.
3. Dùng dữ liệu synthetic có SecureStore ko/ru, khởi động lại, kiểm tra banner
   Việt, lịch sử/phiên còn nguyên; đổi sang từng ngôn ngữ chính và xác nhận
   Visit/tiến độ không đổi. Kiểm tra link Entry và quay lại từ background.

Task giữ **In Progress** cho đến khi có bằng chứng native, review và merge PR.
