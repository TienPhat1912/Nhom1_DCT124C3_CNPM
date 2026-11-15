# PB-025 — Tự phát hướng dẫn và gọi số trên mobile

## Hành vi

Journey dùng Expo Speech, tự phát mặc định trên màn hình đang hoạt động. Switch
cho phép tắt/bật; tắt hủy cả request và âm thanh. Nút Nghe vẫn dùng được khi tắt
tự phát. Lựa chọn giữ khi đổi Visit trên màn hình đang mount; mở lại màn hình
bắt đầu với mặc định bật. Hướng dẫn gốc luôn có trên màn hình. Sau khi tải lời
đọc, giao diện hiện đầy đủ văn bản gồm số và phòng, kể cả khi không có giọng.

Số đọc khớp thẻ hàng chờ: V2 dùng số phiếu, luồng cũ dùng số hàng chờ của bước
hoặc số phiếu dự phòng. Phòng lấy từ snapshot của bước. Bước khám/khám lại V2
chỉ coi là được gọi khi `ExamStatus == InConsultation`; cập nhật hàng chờ cũ
không thay quyết định bác sĩ tiếp nhận. Bước dịch vụ và luồng cũ dùng `Called`.
Giọng và nhãn lời đọc theo ngôn ngữ thực tế của response, bao gồm fallback Việt.

Khóa âm thanh gồm session, Visit, bước, ngôn ngữ, nội dung/revision, snapshot
phòng, số phiếu và trạng thái có ý nghĩa với lời đọc. Không dùng Visit.Version
hoặc version bước để phát lại. Chuyển trạng thái mới có thể đọc lại, kể cả trở
về một trạng thái trước đó. Nghe thủ công luôn cho phép đọc lại nội dung hiện tại.

## Sự kiện và vòng đời

`useVisitEvents` trong runtime đọc PB-023 mỗi 1–10 giây theo `pollAfterMs`, một
request tại một thời điểm. Cursor là chuỗi opaque, không chuyển thành số.
Sự kiện lặp/stale/hết hạn/khác Visit không phát lịch sử. Trạng thái mới hoặc
sự kiện mới hợp lệ yêu cầu tải lại Visit được dịch, rồi mới quyết định đọc nội
dung hiện hành. Không đọc trực tiếp guidance tiếng Việt trong event lịch sử.

Background/inactive hủy request, dừng tiếng và bỏ cursor/timer. Foreground tải
lại Visit, bootstrap stream hiện tại và không phát hàng loạt lời gọi đã bỏ lỡ.
Polling Visit chậm 5 giây cũng tắt timer và hủy request khi xuống nền; dữ liệu cũ
được đánh dấu stale cho đến khi xác thực lại. Mất mạng giữ cursor để retry sau
5 giây; `invalidCursor` bỏ cursor để bootstrap. Đổi Visit/session hoặc unmount
hủy toàn bộ timer/request/listener thuộc màn hình.

`useNarration` dùng generation và AbortController để chặn response/callback cũ
khi dừng, đổi session/ngôn ngữ/ngữ cảnh, background hoặc unmount. Chờ native
`Speech.stop()` hoàn tất trước khi tải/đọc tiếp và kiểm tra generation sau mỗi
await. Không có giọng phù hợp thì giữ văn bản và thông báo lỗi. Engine không
phát `onStart` trong 3 giây sẽ dừng và cho phép thử lại thủ công. Callback lỗi,
kết thúc hoặc dừng của tiếng cũ không thay trạng thái tiếng mới.

## Kiểm chứng

Các lệnh từ `codes/`:

```text
npm.cmd run test:narration:unit
node --test tests/unit/native-*.test.mjs
npm.cmd run test:languages:unit
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run export --workspace @hospital/mobile
git diff --check
```

Suite narration được gắn vào script CI `test:narration:unit`, gồm hook speech,
stream và component Journey thật với boundary React Native/Expo được giả lập.
Bao phủ auto/manual/toggle/dedup, đúng số/phòng, V2 và legacy, fallback ngôn ngữ,
thiếu giọng, lỗi API, watchdog, hủy trong lúc chờ native stop/request/voices,
callback cũ, session boundary, background/foreground, reconnect/backoff,
cursor rất lớn, event lặp/stale/hết hạn, bỏ dữ liệu chậm và cleanup timer/listener.
Hồi quy bao gồm session, cache/offline Journey, tiếp nhận, kết quả và trợ giúp.

Kết quả local ngày 15/11/2026: 67/67 native tests đạt (trong đó 21 ca thuộc
script narration), 3/3 ca ngôn ngữ đạt. Typecheck toàn workspace/contracts,
lint, web build, kiểm tra định dạng file mới và `git diff --check` đạt.
Expo export Android đạt: bundle Hermes 943 modules, khoảng 2,6 MB.
Vite web build có cảnh báo chunk lớn hơn 500 kB; không có lỗi build.

Kiểm tra tích hợp Application sau PB-025, ngày 15/11/2026: đã publish mới và
chạy **toàn bộ** `scripts/test/ci-native.ps1 -SqlServer localhost`, exit code 0.
Migration, API, tải, 78 ca browser mặc định và các bộ browser V2 phía sau,
dịch thuật, trợ giúp, recovery, Journey, phân công phòng, provider Timeout và
Unavailable đều đạt. Fixture chính giữ lại: `HospitalAcceptance_1794731885227`.
Các script unit của job Application, Release build và lệnh export đúng output
`../../artifacts/mobile-android` cũng đạt. Lượt này không cần sửa thêm mã nguồn.
Đây là kiểm chứng local Windows/SQL localhost/Node 24.19.0; chưa phải kết quả
GitHub Actions mới trên Windows 2022/LocalDB/Node 22.19.0, không bao gồm job APK.

## Nghiệm thu thiết bị riêng

`tests/android/android-narration.mjs` yêu cầu API local có `Workflow__PrdV2Enabled=true`,
database acceptance mới được seed, các biến `API_URL`, `DEMO_PASSWORD`,
`ACCEPTANCE_DB=HospitalAcceptance_<timestamp>` và emulator chuyên dụng `cnpm_api36`.
Không chạy trên database demo/production đang sử dụng. Runner tạo bệnh nhân,
tiếp nhận ở A101, gọi khám, kiểm tra switch mặc định/tắt/nghe thủ công/văn bản,
foreground giữ lựa chọn, logout và chụp ảnh/report. Phải cài APK mới đúng hash
`artifacts/android/an-tam-demo.apk` trước khi chạy; driver từ chối APK khác.

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build/build-android.ps1 -ApiUrl http://127.0.0.1:5280
node tests/android/android-narration.mjs
```

Kiểm tra nghe qua loa/tai nghe riêng khi có giọng: số/phòng đúng phiếu, gọi khám
một lần sau bác sĩ tiếp nhận, không lặp khi polling; tắt tự phát rồi nghe lại;
đổi tiếng/Visit khi đang đọc; Home rồi quay lại sau một cập nhật; đăng xuất khi
đang đọc. Xác nhận giọng đúng ngôn ngữ response và fallback Việt. Với iOS, kiểm
tra thêm chế độ im lặng và chính sách âm thanh của thiết bị. Report UI không
chứng minh có âm thanh qua loa.

Ngày 15/11/2026, môi trường không có Android SDK platform 36/adb. Lệnh build
APK dừng ở kiểm tra SDK; chưa chạy script thiết bị, chưa xác nhận âm thanh thật
hoặc tạo APK mới. Export Android bằng Metro/Hermes là kiểm tra bundle, không
thay nghiệm thu APK/thiết bị. Không thay native dependency, schema hoặc migration.

Task chỉ Done sau khi đủ gate thiết bị phù hợp, dependency merge, reviewer
duyệt và PR merge theo quy ước backlog. Bản triển khai local không tự xác nhận
các điều kiện bàn giao này.
