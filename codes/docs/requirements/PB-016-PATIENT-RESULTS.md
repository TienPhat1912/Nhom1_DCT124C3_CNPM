# PB-016 — Kết quả và khuyến nghị cho bệnh nhân

Web và mobile hiển thị kết quả đã xác nhận khi ExamStatus Completed, kể cả Visit
vẫn Active/chưa quyết toán. Account chỉ đọc Visit của mình; Guest phải có grant
còn hiệu lực cho đúng Visit. Không chuyển dữ liệu Guest sang Account hoặc mở booking.

## Hợp đồng đọc

Giữ `GET /api/visits/{id}/content?language=vi` để cả client V2 và hồ sơ legacy dùng
cùng đường đọc có kiểm tra quyền. Response mở rộng tương thích:

- `visitId`, `examStatus`: nhận diện lượt và trạng thái khám (null cho legacy).
- `summary`: tóm tắt nguồn Việt hoặc bản dịch, có authorName/publishedAt/revision,
  original Việt, language/requestedLanguage/fallback/translationStatus/contentKey.
- `clinicalRecord`: ClinicalRecordV2 đã xác nhận, hoặc null. Gồm triệu chứng/dấu hiệu/
  chẩn đoán từ snapshot danh mục, mã, version, mẫu, tác giả, thời điểm xác nhận và
  nội dung Việt gốc. Bộ lọc bản dịch không sửa snapshot này.
- `followUps`: chỉ Published và thuộc đúng Visit, có visitId/departmentId/thời gian,
  text được dịch nếu có, metadata dịch/fallback và `original:{language,text}` bất biến.
  Thời điểm khuyến nghị trả UTC. Khuyến nghị Superseded không xuất hiện.
- `bookingUrl`: null. Không có nút booking hoặc trạng thái thiếu booking trên client.

Với V2 chưa Completed hoặc chưa có ExaminationCompletedAt/ClinicalRecord, summary và
clinicalRecord null, followUps rỗng. Preview không được công bố. Doctor vẫn dùng
workflow xác nhận PB-014; Patient không đọc được drafts. API clinical-record V2 và
narration Summary dùng cùng điều kiện xác nhận. Narration kiểm tra revision và
contentKey của văn bản đang hiển thị; stale translation trả 409 sourceChanged.

Legacy vẫn đọc SummaryVersion Published và khuyến nghị Published hiện có, không cần
snapshot V2. Không đổi lịch sử, sinh lịch hẹn/Visit mới hoặc migration. Scope/ownership/
grant được kiểm tra trước khi tải và dịch nội dung; Cashier/Service/Reception/Admin
không được đọc kết quả lâm sàng qua endpoint này.

## Giao diện

- Hiển thị ba nhóm snapshot và tác giả/thời điểm xác nhận, ghi rõ nguồn Việt.
- Giữ tóm tắt/hướng dẫn đã dịch, nhãn machine translation hoặc fallback, và bản gốc.
- Khuyến nghị đúng khoa/Visit, thời gian và bản gốc; không có booking handoff.
- Mỗi lần đổi Visit hoặc ngôn ngữ dùng đúng resource; context audio gắn session,
  Visit, revision, actual language và contentKey. Chuyển phiên tháo workspace cũ.
- Nếu refresh trả lỗi quyền/grant, ẩn cả snapshot trước đó và dừng context audio;
  không tiếp tục hiển thị nội dung đã mất quyền. Loading/error dùng component chung.
- Shared labels sáu locale theo repository hiện tại. UI Journey tổng thể thuộc
  PB-021/022, không thay đổi trong task này.

## Kiểm chứng và gate native

Chạy từ `codes/` với database SQL local riêng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/patient-results/run.ps1 -SqlServer '.\SQLEXPRESS' -Regression -Capture
npm run test:results:native
npm run typecheck
npm run lint
npm run test:languages:unit
npm run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb016-mobile
```

Runner build/publish rồi chạy component native bằng device stubs, API ownership/
grant/unpublished/language/narration/legacy, browser desktop/mobile viewport, và
hồi quy PB-014/013/012/011/010/008 cùng API legacy khi V2 tắt. SQL fixtures được giữ;
env được khôi phục, process được dừng. CI native có phase PB-016 riêng.

**Component stubs và Metro export không thay thế kiểm thử trên Android.** Script
`tests/android/android-results.mjs` là gate riêng: APK hiện tại, AVD `cnpm_api36`,
API local có Workflow:PrdV2Enabled và database fixture mới. Dùng ADB_PATH/
ANDROID_SERIAL nếu cần. Build/cài APK trỏ `http://127.0.0.1:5280` theo
[hướng dẫn Android](../guides/ANDROID.md), sau đó chạy runner với `-Native` để giữ API
fixture trong suốt kiểm thử thiết bị:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/patient-results/run.ps1 -SqlServer '.\SQLEXPRESS' -Native -Capture
```

Có thể chạy `node tests/android/android-results.mjs` riêng nếu API fixture đang mở
và đã đặt API_URL/DEMO_PASSWORD/ACCEPTANCE_DB đúng môi trường đó. Script kiểm tra
chưa công bố → xác nhận trước quyết toán → khuyến nghị/ngôn ngữ →
lịch sử legacy của Account độc lập; giữ báo cáo và ảnh trong artifacts/android.
Không clear app-data. Không chạy khi thiếu fixture hoặc APK tương ứng.

Phiên triển khai local thiếu Android SDK platform 36/ADB/AVD nên chưa chạy được APK
build và gate thiết bị. Phải hoàn tất gate này trước khi đánh task Done; không suy
native PASS từ browser Pixel 7 viewport hoặc test hooks giả lập.
