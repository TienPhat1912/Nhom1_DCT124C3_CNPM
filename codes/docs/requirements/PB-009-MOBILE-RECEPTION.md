# PB-009 — Tiếp nhận V2 trên mobile

## Phạm vi

Mobile dùng API PB-006/008 khi public config `prdV2Enabled=true`. Không thêm API,
migration, permission hoặc dependency native. Luồng legacy vẫn được dùng khi cờ
tắt. Không triển khai tự phát TTS hoặc toàn bộ trạng thái khám PB-022/025.

Reception V2 chỉ gửi bốn trường: `contact`, `preferredDepartmentId` nullable,
`description` nguyên văn và `sourceLanguage` thuộc vi/en/zh/ja. Tên lấy từ profile;
Guest thiếu tên được hướng tới Profile trước khi gửi. Locale ko/ru không tự suy
diễn nguồn mô tả; người dùng phải chọn một trong bốn ngôn ngữ nguồn.

Không có booking, form bổ sung, liên kết Guest hay QR tiếp nhận/kích hoạt trong
luồng V2. Request/Visit đang có được mở từ ID đã được server cho phép trong lỗi
409. Request legacy mở bằng hợp đồng cũ trong phần hồ sơ trước đây, chỉ đọc.
Hai danh sách phân trang độc lập theo offset 100. Backend vẫn kiểm tra quyền cho mỗi lần đọc.

Reception polling 5 giây khi app active, refresh khi focus. Khi request được confirm,
mobile tự vào Journey bằng VisitId, không gọi redeem. GET Journey hiện có theo
bàn giao PB-008 tiếp tục phục vụ chỉ dẫn. Kết quả/đọc đầy đủ trạng thái khám thuộc
các task tiếp theo; PB-009 không bật thêm capability backend.

## Draft và retry

`receptionState.ts` tạo store qua `expo-secure-store` hiện có. Key riêng theo
SessionId, không theo contact hoặc PatientId. Giá trị bao gồm bản nháp, request
được chọn và command chưa được xác nhận. Selected Visit dùng key riêng cùng scope.
Writes được xếp hàng để lần lưu chậm không ghi đè lần sửa mới hơn.

- Mỗi thay đổi lưu nội dung gốc; đổi locale không đổi sourceLanguage/description.
  App giữ Patient screen trong lúc tải config ngôn ngữ mới.
- Trước POST, lưu chính xác body và idempotency key. Nếu lưu thiết bị thất bại,
  không truyền command. Nếu mất mạng/timeout/5xx, giữ pending body/key, khóa sửa
  body và cho Retry; restart đọc lại và gửi cùng key. Không tự gửi POST khi khởi động.
- Thành công lưu requestId rồi bỏ pending. Lỗi 4xx xác định không phải thành công
  cho phép sửa lại; pending/active conflict có nút mở hồ sơ được phép. Backend
  chống trùng theo Patient vẫn là lớp bảo vệ quyết định.
- Khi bỏ màn hình trước lúc ghi pending xong, không được gửi dữ liệu cũ bằng
  session mới. Response đến sau unmount không điều hướng hoặc thay draft hiện tại.
- Profile update cùng SessionId giữ draft. Logout/đổi session xóa draft và selected
  Visit của session cũ. Một Guest khác, Account hoặc session recovery không kế thừa.
- Cold start cần kết nối để xác minh session/config; khi offline, màn hình Retry
  chờ kết nối. Draft vẫn được giữ trên thiết bị, không hiển thị dữ liệu riêng tư khi
  chưa khôi phục được session. Đây không phải một chế độ đọc hồ sơ offline.

Không ghi draft/token vào log hoặc artifact. Dữ liệu chỉ được gửi tới API cấu hình.
Android/iOS có thể báo lỗi SecureStore; UI giữ lỗi và chỉ gửi sau khi lưu thành công.
Khả năng lưu bản nháp dài, Unicode và khôi phục thực tế của SecureStore vẫn phải
được nghiệm thu native trên nền tảng đích; unit test dùng dịch vụ thiết bị giả lập.

## Entry, phục hồi và phiếu

- `hguide://entry?language=vi`: Entry công khai, không cấp quyền vào hồ sơ.
- `hguide://entry?visit=<uuid>&language=en` hoặc URL có `#visit=<uuid>`:
  lưu navigation hint qua Auth, GET Visit kiểm tra quyền trước khi chuyển màn hình.
  Không gọi confirm/create/redeem hoặc tạo grant từ URL. 403 không mở Journey;
  lỗi mạng có Retry.
- Entry ticket token legacy vẫn được hỗ trợ qua màn hình kiểm tra quyền hiện có.
  Home/Journey V2 không mời quét QR hoặc kích hoạt. Không sinh token QR cho phiếu V2.
- Recovery đã xác minh nhận session mới, lưu session rồi mở VisitId do server trả;
  không liên kết với tài khoản hoặc cấp quyền từ việc biết số phiếu.
- Selected Visit được lưu theo session để cold start mở đúng lượt. Mỗi lần đọc
  vẫn phải qua backend; lỗi quyền không dùng dữ liệu cache của lượt khác.
- Phiếu V2 đọc GET ticket: hiển thị snapshot bệnh nhân/phòng/bác sĩ cùng ngày/số
  đã lưu, không lấy profile hiện tại để viết lại. Mở/đóng/xem lại chỉ đọc, không cấp
  số hoặc QR mới. In lại từ Reception web hiện có; PB-009 không thêm in vật lý native.

## Kiểm chứng local đã chạy ngày 14/11/2026

Từ `codes/`:

| Lệnh | Kết quả |
|---|---|
| `npm run test:reception:unit` | PASS — 19 test |
| `node --test tests/unit/native-session.test.mjs tests/unit/native-narration.test.mjs` | PASS — 15 test hồi quy |
| `npm run typecheck` | PASS — web/mobile/shared contracts |
| `npm run lint` | PASS — 0 warning |
| `npm run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb009-mobile-export` | PASS — Android Hermes bundle, không phải APK |
| `node --check tests/android/android-reception.mjs` | PASS — cú pháp runner, chưa chạy thiết bị |

19 test chạy code component thật với hook React và thiết bị giả lập: payload bốn
trường, nguyên văn/locale, retry cùng key sau remount kể cả response mơ hồ đã commit,
lỗi storage trước POST, unmount/đổi session, profile/source bắt buộc, conflict V2/
legacy/Visit, polling confirm không redeem, snapshot không QR, URL validation,
Entry được phép/bị từ chối, selected Visit, xóa draft khi logout, config locale giữ
screen, recovery điều hướng sau lưu session và phân trang legacy chỉ đọc độc lập.
CI thêm `test:reception:unit`.

Log local (ignored): `.local/pb009-unit.log`, `pb009-regression.log`,
`pb009-typecheck.log`, `pb009-lint.log`, `pb009-export.log`.
Không dùng database demo/online trong kiểm thử local này.

## Gate native còn thiếu

Người dùng xác nhận máy chưa có SDK/giả lập. Chưa chạy build APK, native Android,
camera, iOS hoặc kiểm tra layout/screen reader trên thiết bị. Không có screenshot
native mới hay báo cáo pass thiết bị. Typecheck/export/unit không thay bước này;
task giữ In progress và không đánh Done.

Khi có SDK/emulator, làm theo [Android guide](../guides/ANDROID.md), build APK hiện
tại với API đóng gói `http://127.0.0.1:5280`, cài vào AVD riêng `cnpm_api36`.
Khởi động API + web với database `HospitalAcceptance_*` mới, bật V2; dùng password
demo fixture qua biến môi trường, không ghi vào lệnh được chia sẻ.

```powershell
# Đặt API_URL, WEB_URL, DEMO_PASSWORD, ACCEPTANCE_DB, ADB_PATH khi cần.
# API_URL/WEB_URL phải là loopback, APK dùng cổng 5280 qua adb reverse.
node tests/android/android-reception.mjs
```

Runner có kiểm tra APK hash, tên AVD và dịch vụ loopback. Nó tạo Guest tổng hợp,
hoàn thiện profile trong app, gửi offline rồi force-stop, retry sau restart, mở
Reception web bằng Playwright để chọn phòng/xác minh/confirm thật, xem phiếu native,
cold start, Visit deep link đổi locale và verified recovery. Staff API chỉ dùng cho
fixture/đối chiếu; thao tác confirm dùng giao diện web thật. Tạm tháo adb reverse
để mô phỏng offline và khôi phục trong finally. Không xóa app data.
Output `artifacts/android/android-reception.json` và ảnh `pb009-native-*.png` chỉ
có khi chạy; report phân biệt running/failed/passed. Runner mới **chưa được chạy**;
cần kiểm tra selector/layout với APK trên giả lập trước khi công bố nghiệm thu.

Nghiệm thu bổ sung trên thiết bị: hai tab/các xung đột đã có; deep link trước Auth,
Guest recovery hết hạn/sai code, offline lúc confirm, mô tả Unicode dài, font lớn
và sáu locale. Các kiểm tra quyền/receipt server tiếp tục dùng bộ API PB-006/008.
