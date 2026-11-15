# PB-026 — Chỉ đường và thuyết minh theo vị trí mô phỏng

Triển khai local ngày 15/11/2026, dùng mặt bằng [PB-033](PB-033-MAP-LAYOUT.md) và nguồn vị trí [PB-034](PB-034-RTLS-SIMULATION.md). Phần mã đã nối với Web Speech và Expo Speech, thay bộ điều khiển thử của PB-034. Gate APK/thiết bị Android và reviewer/merge còn phải hoàn tất trước khi chuyển Done.

## Hành vi sử dụng

Mở Hành trình → Chỉ đường. Chế độ **Mô phỏng RTLS** nhận đích hiện tại và nguồn demo mặc định Cổng 1. Khi có tuyến hợp lệ, tự phát chỉ dẫn đầu. Marker chỉ đi sau khi lời đọc kết thúc và đã dừng tối thiểu 1 giây; mỗi chặng di chuyển khoảng 5 giây. Tại điểm rẽ/chuyển tầng/tòa, đọc chỉ dẫn mới trước khi thực hiện chặng tiếp. Mặt bằng theo đúng vị trí hiện tại, không vẽ marker xuyên các tầng.

- **Tự động đọc chỉ đường** nhận lựa chọn tự phát của Journey khi mở màn hình. Tắt lựa chọn này vẫn có chỉ dẫn chữ và mô phỏng đi tiếp sau dwell. Có thể chủ động nghe lại.
- **Nghe chỉ đường** đọc chặng hiện tại. Nghe lại tại điểm hướng dẫn giữ nguyên chặng và thời gian dừng đã tích lũy; không tạo phiên/timer/chặng mới. Nếu đang di chuyển, nghe lại không tính thêm một lượt tiến độ.
- **Tạm dừng** giữ vị trí/tiến độ và dừng âm thanh. **Bắt đầu / tiếp tục** phát lại chỉ dẫn còn hiệu lực trước khi đi phần còn lại.
- **Đặt lại**, đổi nguồn và thử lệch tuyến dùng các điểm hợp lệ của graph. Thử mất/stale tín hiệu dừng chuyển động; khôi phục chỉ đưa về paused, cần tiếp tục rõ ràng.
- Journey đổi đích/bước: hủy câu cũ, giữ đúng vị trí hiện tại trên cạnh, tính tuyến mới. Không nhảy về Cổng 1 hoặc đầu chặng.
- Thiếu phòng/tầng/đích hoặc không có tuyến: hiện lý do, không phát và không cho bắt đầu. Chọn **Thủ công** vẫn dùng được bộ chọn tòa/tầng/checkpoint và đọc tuyến tĩnh; không tự di chuyển.
- Đến đích tự đọc thông báo đến nơi một lần cho lượt tuyến; nghe lại theo yêu cầu không phát sinh sự kiện đến đích mới. Không gọi API hoàn tất khám/dịch vụ/Journey.

Đây là vị trí và tốc độ trình diễn, không phải định vị thiết bị, ETA thật hay RTLS cảm biến. Việc marker đến nơi không chứng minh bệnh nhân đã đến phòng trong thực tế.

## Tích hợp và hợp đồng

| Module | Trách nhiệm |
|---|---|
| Shared `routeNarration.ts` | Handshake speech/position, dedup token, chờ speech+dwell, muted/replay, lỗi/timeout, nhường quyền và tiếp tục sau Journey. Không import API hoặc engine nền tảng. |
| Shared `audioCoordinator.ts`, `deviceAudio.ts` | Một lease đang có quyền phát trong mỗi JS runtime. Journey/gọi số ưu tiên cao hơn route; route không ngắt Journey. Singleton không chứa dữ liệu bệnh nhân hoặc vị trí. |
| Web/native `routeSpeechAdapter.ts` | Chọn đúng giọng/ngôn ngữ của nội dung thực tế, đọc một chặng bằng Web Speech/Expo Speech; hủy voice loading và callback cũ. Web chờ inventory giọng tối đa 750 ms. |
| Web/native `useRouteNarration.ts` | Vòng đời React, autoplay/muted/error/replay, visibility/AppState, ngôn ngữ và trạng thái sẵn sàng của nhãn cấu hình. |
| Web `useSpeech.ts`, native `useNarration` trong `runtime.tsx` | Journey/gọi số dùng cùng lease. Giữ quyền từ lúc nhận yêu cầu đọc đến hết phát hoặc timeout; cleanup chỉ dừng engine khi chính hook đang có quyền hoặc engine đang rảnh. |
| Web/native `useRouteSpeech.ts` | Tuyến thủ công cũng xin lease route, không đọc chồng Journey. Dừng khi đổi nội dung, ngôn ngữ, unmount hoặc vào nền. |
| Web/native `SimulationMap.tsx` | Điều khiển thật đã tích hợp, bỏ nút xác nhận chặng thử nghiệm; hiển thị chữ, lỗi và thao tác nghe lại khi autoplay bị chặn. |
| Native `App.tsx`, `Journey.tsx` | Journey vẫn được mount trong vùng ẩn khi mở Directions để tiếp tục nhận gọi số/đổi bước và phát thông báo ưu tiên. Vùng ẩn không hiển thị hoặc nhận thao tác người dùng. Lựa chọn autoplay được truyền sang Directions. |

`createRouteNarration(source, audio, speech, clock, onError)` nhận nguồn PB-034, coordinator dùng chung, adapter speech và đồng hồ. API trả về `start`, `pause`, `resume`, `replay`, `setMuted`, `dispose`. Adapter `speak(snapshot, done, failed)` trả hàm cancel; lỗi đồng bộ, callback failed hoặc không có callback đều có đường xử lý hữu hạn.

Mỗi chỉ dẫn dùng token PB-034 `{sessionId, routeId, legId, revision}`. Lượt tự phát giữ một khóa token hiện tại; heartbeat tọa độ, polling hoặc `Visit.Version` không làm đọc lại. Pause/resume tạo token mới cho phần chặng còn lại. Callback phải còn đúng generation và token mới được ack. Mọi callback sau dispose/đổi tuyến/ngôn ngữ đều vô hiệu.

PB-034 có thêm `hold(token)` để rút ack sớm khi người dùng nghe lại tại điểm hướng dẫn. Hàm này không đổi node/chặng/revision, không tạo timer; khi lời nghe lại kết thúc, PB-026 trả ack cho chính token đó. Dwell vẫn do một controller PB-034 thực hiện.

## Quyền âm thanh và vòng đời

Journey/gọi số có thể ngắt route đang đọc hoặc đang di chuyển. Source dừng tại vị trí hiện tại. Khi lease Journey được trả, PB-026 chờ một lượt xử lý kế tiếp, kiểm tra lại trạng thái source/foreground/vòng đời rồi mới resume và đọc chỉ dẫn mới. Lượt chờ này bị hủy khi pause, mất tín hiệu, đóng màn hình hoặc dispose; việc trả quyền lúc unmount không được enqueue câu của phiên cũ.

Khi mất/stale tín hiệu trong lúc nhường quyền, việc Journey kết thúc không tự resume nguồn. Khôi phục tín hiệu và foreground cũng không chạy bù thời gian đứng yên. Phải tiếp tục bằng thao tác rõ ràng.

Đổi ngôn ngữ dừng câu cũ và đợi cấu hình nhãn đúng ngôn ngữ. `configLocale` được ghi theo dữ liệu thực đã tải, không theo lựa chọn UI đang chờ request. `positionGraphIdentity` bỏ phần nhãn khỏi định danh hình học; `refreshLabels` cập nhật tên node/tuyến nhưng giữ vị trí, session, cạnh tạm và tham chiếu cạnh để nét route vẫn đúng. Nếu hình học/trạng thái đường đi thay đổi thực sự thì phải tạo nguồn mới, không tái sử dụng tọa độ giả định. Không đọc tên còn thuộc ngôn ngữ cũ bằng giọng mới.

## Thời gian và fallback

| Cơ chế | Giá trị mặc định |
|---|---|
| Di chuyển mỗi chặng / dwell tối thiểu | 5000 / 1000 ms từ cấu hình PB-034 |
| Heartbeat / stale | 50 / 3000 ms từ cấu hình PB-034 |
| Watchdog route TTS | `source.config.ttsTimeoutMs`, mặc định 15000 ms |
| Lease route | Watchdog route + một tick; timeout adapter được xử lý trước khi hết lease |
| Giữ quyền Journey | Tối đa 15000 ms mỗi lượt, kể cả khi engine đã báo start nhưng không trả end |
| Startup watchdog Journey hiện có | Web 2500 ms, native 3000 ms, được xóa khi engine báo start |

TTS lỗi, thiếu giọng, throw, bị chặn tự phát hoặc timeout: hiện hướng dẫn chữ/lỗi và nút nghe lại, trả quyền engine, ack token còn hợp lệ để mô phỏng không chờ vô hạn. Bấm nghe lại là thao tác người dùng để thử phát lại/bật âm thanh; không ép giả định engine đã đọc thành công. Khi nhãn chưa có bản dịch, dùng chính sách fallback tiếng Việt hiện có và chọn giọng cho ngôn ngữ của nội dung thực tế.

## Kiểm chứng local

Chạy từ `codes/`:

```text
npm.cmd run test:route:unit
npm.cmd run test:position:unit
npm.cmd run test:narration:unit
npm.cmd run test:map:unit
npm.cmd run test:languages:unit
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:map
npm.cmd run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb026-mobile-android
```

Bộ bắt buộc bao gồm:

- Unit đồng hồ giả: lời đọc dài hơn dwell/chặng, lỗi/timeout, muted, token cũ, nghe lại không nhân tiến độ, priority preemption/release, signal recovery và race trả quyền ngay trước unmount.
- Native component/adapter: Expo Speech cùng tầng/khác tầng/khác tòa, muted, loading voices đến muộn, timeout, nền/foreground, callback cũ; hook Journey thật dùng chung coordinator với route; ngôn ngữ chờ nhãn đúng và giữ phiên vị trí.
- Browser PB-026 trên desktop/điện thoại: chữ/giọng/chuyển động, đổi đích giữa cạnh, callback cũ, muted/manual replay/arrival, blocked/throw/silent, Journey thật ngắt rồi trả quyền, nền/khôi phục tín hiệu/đích thiếu/đóng, đổi ngôn ngữ giữa cạnh. Các bài fixture không ghi trạng thái lâm sàng; POST narration chỉ là yêu cầu nội dung đọc hiện có.
- Hồi quy bản đồ thủ công/PB-033/PB-034, Journey narration, session và Application trên production build với API/SQL fixture local riêng.

Kết quả bản tích hợp cuối ngày 15/11/2026:

| Kiểm tra | Kết quả |
|---|---|
| `test:route:unit` | 15/15 đạt: coordinator, handshake, Expo adapter/hook |
| Hồi quy `native-*.test.mjs` + position-source + coordinator + route | 104/104 đạt trên Node 22.19.0; bao gồm Journey/session/native và các ca PB-026 |
| `test:map:unit` | 20/20 đạt |
| `test:languages:unit`, `test:directory:unit` | 3/3 và 3/3 đạt |
| `typecheck` (web/mobile/shared/contracts), `lint` | Đạt |
| Production web build | Đạt; còn cảnh báo bundle chính 593.20 kB vượt mức khuyến nghị 500 kB |
| Expo Android export | Đạt, 960 modules; Hermes bundle 2.6 MB tại `artifacts/pb026-mobile-android` |
| Browser bản đồ desktop/mobile | 28/28 đạt trong 5.3 phút, gồm 16 ca PB-026; `artifacts/pb026-final-map/.last-run.json` |
| Application production build + API/SQL fixture riêng | 104/104 đạt trong 6.7 phút; fixture `HospitalAcceptance_1794751246284`, output `artifacts/pb026-final-application/.last-run.json` |
| Build APK | Dừng ở guard môi trường: thiếu Android SDK platform 36 |

Lượt Node 22 dùng `npm.cmd exec --yes --offline --cache artifacts/npm-cache --package=node@22.19.0 -- node --test --test-reporter=dot tests/unit/native-*.test.mjs tests/unit/position-source.test.mjs tests/unit/audio-coordinator.test.mjs tests/unit/route-narration.test.mjs`. Các bộ có phần giao nhau, không cộng số test thành một tổng độc lập.

Các lần đang sửa đã phát hiện và xử lý race trả quyền lúc unmount, giữ vị trí khi nhãn API đổi ngôn ngữ và chuỗi Unicode bị sai khi ghi file. Bằng chứng browser cuối phải thuộc bản tích hợp sau các sửa này, không lấy kết quả lượt cũ thay thế.

Lượt Application cuối phục vụ `apps/web/dist` từ API đã publish tại `http://127.0.0.1:5298`, dùng SQL localhost và database acceptance mới, rồi chạy `npx.cmd playwright test --reporter=list --output artifacts/pb026-final-application`. V2 tắt theo cấu hình bộ Application legacy hiện có; các ca bản đồ/TTS dùng response fixture có kiểm soát, các ca nghiệp vụ còn lại dùng API/SQL local thật. API đã được dừng sau lượt chạy; database fixture được giữ để đối chiếu. Không dùng database online và không có bằng chứng triển khai bản này lên server. Không phát hiện lỗi trong các kiểm tra đã chạy; chất lượng âm thanh/phát giọng trên thiết bị vẫn thuộc gate riêng.

Ảnh demo tại `artifacts/pb026/*-guidance.png`; đã xem ảnh giao diện điện thoại sau lượt chạy, chữ và các điều khiển không chồng/cắt ngang. Đây là ảnh browser viewport, không phải ảnh APK. Ảnh mặt bằng/chuyển tầng và marker tại `artifacts/pb034/`. Trace/screenshot lỗi và trạng thái lượt browser nằm trong thư mục output của lượt chạy. Workflow Application chạy thêm `test:route:unit` và upload ảnh PB-026; chưa có bằng chứng GitHub Actions đã chạy bản thay đổi local này.

## Gate còn lại

Máy thiếu Android SDK platform 36: lệnh build APK dừng tại kiểm tra môi trường. Metro/Hermes export đạt không thay cho kiểm chứng loa/giọng, AppState và bố cục của APK mới trên AVD/thiết bị. Theo [hướng dẫn Android](../guides/ANDROID.md), build/xác minh APK rồi chạy trên AVD `cnpm_api36` với API V2/SQL fixture riêng; lưu ảnh/video ba tuyến, đổi đích giữa cạnh, gọi số ưu tiên, autoplay off/lỗi âm thanh, pause/loss/background và đến đích. Không lấy viewport điện thoại làm bằng chứng native thực tế.

Theo quy ước backlog, gate native và reviewer duyệt/merge còn thiếu nên chưa chuyển Done. Mã tích hợp không còn chỉ là phần chuẩn bị và UI không dùng nút tiếp tục chặng thử nghiệm PB-034 nữa.
