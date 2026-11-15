# PB-034 — Nguồn vị trí và bộ điều khiển mô phỏng

Triển khai local ngày 15/11/2026, dựa trên [mặt bằng PB-033](PB-033-MAP-LAYOUT.md). Đây là vị trí và tốc độ trình diễn, không thu vị trí thiết bị, không phải RTLS thật. Phần điều phối Journey/TTS theo từng chặng thuộc PB-026; chưa công bố tính năng dẫn đường bằng giọng nói theo vị trí đã hoàn chỉnh.

## Chạy demo

Mở Hành trình → Chỉ đường. Mặc định là **Mô phỏng RTLS**, marker ở Cổng 1 (`gate-1`), chưa tự di chuyển. Chọn **Điểm xuất phát mô phỏng** hoặc một điểm hợp lệ trên bản đồ để đổi nguồn; đích dùng phòng hiện tại hoặc khoa được chọn để tra cứu. Mục chưa ánh xạ không có tuyến và không cho bắt đầu.

1. Bấm **Bắt đầu / tiếp tục**. Trong PB-034, nút này là bộ điều khiển thử: bắt đầu nguồn và xác nhận chỉ dẫn đang hiển thị. Không giả lập một câu TTS đã được đọc.
2. Đợi tối thiểu 1 giây tại điểm hướng dẫn, rồi marker đi dọc chặng trong khoảng 5 giây. Độ dài chặng không đổi thời gian trình diễn.
3. Đến điểm rẽ/chuyển tầng/tòa, marker dừng. Bấm **Tiếp tục chặng (thử nghiệm)** để đi tiếp. Nếu bấm trễ hơn 1 giây, có thể đi ngay; nếu bấm sớm, vẫn phải hết thời gian dừng.
4. Khi đi thang/connector, nguồn giữ marker ở mặt bằng đầu trong thời gian chuyển, sau đó chuyển sang đúng điểm/mặt bằng đến. Không vẽ chuyển động xuyên các tầng.
5. Chặng đi bộ cuối cũng kéo dài 5 giây; tại đích vẫn có lượt hướng dẫn/dừng tối thiểu 1 giây trước trạng thái Đã đến đích. Không thay trạng thái khám.

**Tạm dừng** giữ tiến độ. **Khôi phục tín hiệu** chỉ làm vị trí khả dụng lại; cần tiếp tục rõ ràng. **Thử lệch tuyến** đặt nguồn tại điểm đi lại hợp lệ ngoài tuyến cũ rồi tính lại (ưu tiên cùng mặt bằng; không chọn phòng hoặc tự tạo tọa độ). **Thử mất tín hiệu / Thử tín hiệu cũ** dừng tiến độ. **Đặt lại mô phỏng** tạo phiên mới tại Cổng 1. Đóng/mở lại hoặc chuyển tài khoản/lượt khám tạo phiên mới; không lưu vị trí vào storage.

Chọn **Thủ công** để dùng bộ chọn tòa/tầng/checkpoint và Tìm đường có sẵn. Chế độ này không tự di chuyển. Chuyển chế độ tháo nguồn mô phỏng và hủy timer. Nội dung điều khiển/trạng thái có đủ vi/en/zh/ko/ja/ru.

## Module và ranh giới tích hợp

- `packages/shared/src/positionSource.ts`: `PositionSource`, `DemoPositionSource`, cấu hình, đồng hồ và vòng đời; không phụ thuộc React, speech, API hoặc PB-026.
- `positionCopy.ts`: nhãn sáu ngôn ngữ. `mapPresentation.ts` nhận nhãn điểm đầu tạm của tuyến tính lại.
- Web/mobile `usePositionDemo.ts`: đăng ký React, gắn đích, lắng nghe visibility/AppState, hủy subscription và dispose khi tháo màn hình. Không nhân bản logic thời gian.
- Web/mobile `SimulationMap.tsx`, `FloorPlan.tsx`: điều khiển thử, marker, chỉ dẫn chữ và mặt bằng hiện tại.
- `HospitalMap.tsx`: tách chế độ mô phỏng/thủ công, giữ graph ổn định khi API trả cùng cấu hình. Thay cấu hình đồ thị thực sự sẽ tạo nguồn mới an toàn.
- `PatientJourney.tsx` và native `Journey.tsx`: giữ component theo lượt khám khi đích đổi, truyền `contextKey` của bước. Tuyến/callback cũ hết hiệu lực nhưng vị trí mô phỏng được giữ. Manual panel vẫn tạo lại theo đích/bước để dừng lời đọc cũ.

## Hợp đồng nguồn vị trí

API xuất qua entry point `@hospital/shared`; kiểm thử Node trực tiếp import `positionSource.ts`.

| Dữ liệu | Quy tắc |
|---|---|
| `PositionFix.source` | `simulation` hoặc `manual`. `new DemoPositionSource(graph, 'manual')` tuân cùng giao diện vòng đời, có thể chọn điểm độc lập nhưng không tạo timer di chuyển hoặc nhận lệnh tiếp tục chặng. |
| `sessionId` | Chuỗi opaque chỉ sống trong nguồn hiện tại, tạo mới khi reset/đổi điểm đầu/mở phiên. Không dùng ID này thay ID tài khoản hoặc persist sang phiên khác. |
| `buildingId`, `floorId`, `spaceId` | Tòa là `null` ở khuôn viên; tầng là chuỗi (`-1`, `0`…), hệ tọa độ khớp PB-033. Không so x/y của hai space khác nhau. |
| `x`, `y` | Tọa độ vẽ trong space, không phải mét/GPS. Nội suy theo độ dài hình học các cạnh đi bộ liên tiếp trong một chặng, không nối thẳng bỏ qua các cạnh. |
| `timestamp` | Millisecond từ đồng hồ nguồn. Mặc định Date.now; test tiêm đồng hồ giả. Nguồn đang chạy vẫn phát timestamp mới khi đứng chờ/đến đích. |
| `availability` | `available`, `unavailable`, `stale`. Khi mất/stale tín hiệu không làm mới timestamp cũ và không cộng tiến độ. Khôi phục cập nhật timestamp nhưng giữ trạng thái paused. |
| `nodeId` / `edge` | Tại node có `nodeId`; giữa cạnh có `edge: {from,to,progress}` theo hướng đi thực tế. Các ID có thể chứa điểm đầu tạm của tuyến tính lại; tra trong `getGraph()` của nguồn, không chỉ graph gốc. |
| `PositionSnapshot` | Vị trí, `status`, tuyến PB-033, `legIndex`, `guidance`, `revision`. Snapshot/fix/token được đóng băng; consumer coi graph/route là dữ liệu chỉ đọc. |

`PositionSource`: `getSnapshot()`, `subscribe(listener) → unsubscribe`, `start()`, `pause()`, `resume()`, `reset(nodeId?)`, `dispose()`. Dispose là kết thúc vĩnh viễn, các lệnh/callback đến sau không tạo timer hoặc đổi phiên. Consumer đọc snapshot hiện tại sau khi subscribe; subscribe không tự replay sự kiện cũ.

`DemoPositionSource` còn có `setTarget(id | null)`, `setOrigin(nodeId)`, `continue(token) → boolean`, `setSignal(availability)`, `getGraph()` và `graphAtPosition()`. Origin phải là node hợp lệ/không đóng; giá trị sai bị từ chối. Đích không hợp lệ/không liên thông trả trạng thái `no-route`, không tạo tọa độ hoặc đường giả định.

Các trạng thái: `ready`, `guidance`, `moving`, `paused`, `lost`, `stale`, `no-route`, `arrived`, `disposed`. Sự kiện subscriber: `position` (heartbeat/tiến độ), `guidance` (yêu cầu chỉ dẫn mới), `state` (điều khiển), `arrived` (một lần cho tuyến hoàn tất). Không phát lại guidance theo mỗi heartbeat.

## Handshake cho PB-026

Mỗi sự kiện `guidance` cung cấp token:

```ts
type GuidanceToken = {
  sessionId: string;
  routeId: string;
  legId: string;
  revision: number;
};
```

PB-026 hiển thị/đọc chỉ dẫn của `snapshot.route.legs[snapshot.legIndex]`. Sau khi speech hợp lệ đã kết thúc, gọi `continue(token)` với nguyên token đã nhận. Nguồn phải được `start()`/`resume()` trước khi nhận ack. `continue` trả false khi sai phiên/tuyến/chặng/revision, đang paused/mất tín hiệu, đã dispose hoặc thuộc nguồn thủ công. Ack sớm chỉ được ghi nhận; chuyển động vẫn chờ hết dwell. Ack trễ không tạo timer thứ hai.

`pause/resume`, mất/khôi phục tín hiệu, đổi đích/bước và reset làm token trước đó hết hiệu lực. Resume yêu cầu một chỉ dẫn mới cho phần chặng còn lại; không tự chạy tiếp do callback cũ. Đổi ngôn ngữ không đổi geometry/session; PB-026 phải hủy speech theo ngôn ngữ và dùng token/revision còn hiệu lực khi tích hợp.

```ts
const source = new DemoPositionSource(graph);
const off = source.subscribe((snapshot, event) => {
  if (event === 'guidance' && snapshot.guidance) {
    // PB-026 giữ token, đọc/chờ quyền âm thanh rồi source.continue(token).
    // PB-034 UI dùng thao tác người trình bày thay cho bước này.
  }
});
source.start();
source.setTarget(destinationNodeId);
// Ranh giới màn hình/tài khoản: off(); source.dispose();
```

Khi đang giữa cạnh, `setTarget` lấy vị trí đúng thời điểm gọi, thêm điểm đầu tạm và hai phần cạnh có trọng số tỷ lệ, giữ chiều đi/trạng thái cạnh. Tính lại từ điểm này, kể cả khi đổi đích nhiều lần; không quay về nguồn hoặc node gần nhất. Điểm tạm và cạnh bổ sung chỉ nằm trong graph phiên, không sửa graph gốc/dữ liệu phòng.

## Cấu hình chung

| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| `defaultNodeId` | `gate-1` | Nguồn mặc định và khi reset |
| `legMs` | 5000 | Thời gian hoạt động của một chặng, kể cả chuyển tầng/tòa |
| `dwellMs` | 1000 | Dừng tối thiểu tại mỗi điểm hướng dẫn, kể cả đích |
| `tickMs` | 50 | Cập nhật vị trí/heartbeat; không lấy 5 giây làm chu kỳ phát fix |
| `staleMs` | 3000 | Khoảng gián đoạn quá ngưỡng thì dừng thay vì chạy bù |
| `ttsTimeoutMs` | 15000 | Giá trị chung bàn giao cho PB-026; PB-026 thực thi watchdog TTS. PB-034 không tự ack khi hết hạn này. |

Cấu hình được truyền qua constructor và kiểm tra thời gian hữu hạn/dương, không copy hằng số sang hai UI. 5 giây/chặng không phải ETA thật. Mỗi nguồn chỉ giữ một timeout đang chờ; pause/loss/dispose hủy nó và tăng generation để callback đã lấy ra trước đó cũng vô hiệu. Visibility/AppState foreground không tự resume. Event loop bị treo lâu hơn ngưỡng stale không được cộng toàn bộ khoảng treo vào chuyển động.

## Bằng chứng kiểm chứng local

Chạy từ `codes/`:

```text
npm.cmd run test:position:unit
npm.cmd run test:map:unit
npm.cmd run test:languages:unit
npm.cmd run test:directory:unit
node --experimental-strip-types --test tests/unit/native-*.test.mjs
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:map
npm.cmd run export --workspace @hospital/mobile -- --output-dir ../../artifacts/pb034-mobile-android
```

- Nguồn vị trí/native component: 16/16 ca, gồm đồng hồ giả 5 giây/1 giây, ack trễ/cũ, pause/resume/reset/dispose, một arrival, timestamp đứng yên, mất/stale tín hiệu/event loop, đổi đích lặp giữa cạnh, một chiều, ba loại tuyến và sáu ngôn ngữ.
- Hồi quy Node 22.19.0: 87/87 native + nguồn vị trí; map 20/20, directory 3/3, languages 3/3. Không cộng các bộ có ca trùng thành số ca độc lập.
- Typecheck/contracts, lint, web build và Metro Android export đạt. Cảnh báo bundle Vite trên 500 kB vẫn còn, không làm build thất bại.
- Browser desktop/mobile: 12/12 ca map đạt, trong đó sáu ca PB-034; kiểm tra bổ sung điều khiển/lệch tuyến trên bản cuối đạt 2/2. Ảnh điều khiển, các thao tác chuyển frame và đến đích ở `artifacts/pb034/`; ca marker dùng đồng hồ Playwright nên kiểm tra chuyển động nhanh mà vẫn đi qua các tick thực của controller. Bài chụp mặt bằng tăng chiều cao viewport để lấy trọn SVG, giữ nguyên chiều rộng điện thoại; bài tương tác/tín hiệu vẫn dùng viewport gốc.
- Application browser: **88/88 đạt trong 7,0 phút** trên production build/API .NET với SQL fixture riêng `HospitalAcceptance_1794746558881`, không dùng database demo/online. Lệnh `npx.cmd playwright test --reporter=list --output artifacts/pb034-verified-application` với `WEB_URL`/`API_URL`/`DEMO_PASSWORD` của fixture; trạng thái lượt chạy tại `artifacts/pb034-verified-application/.last-run.json`. Không phát hiện lỗi Application trong các ca đã chạy; không thay kết quả local bằng kết luận GitHub Actions đã xanh.

Workflow Application chạy `test:position:unit`, toàn bộ các ca browser mới và upload ảnh PB-034. Không đổi schema/API/seed hay trạng thái nghiệp vụ trong source task; các mutation tạo hồ sơ chỉ thuộc fixture acceptance riêng.

## Giới hạn và gate còn lại

Máy chưa có SDK platform 36 nên `scripts/build/build-android.ps1` chưa tạo được APK mới; chưa quan sát marker/AppState trên thiết bị/giả lập Android. Component tests và viewport điện thoại không thay bằng chứng native thực tế. Sau khi có môi trường theo [hướng dẫn Android](../guides/ANDROID.md), build/xác minh APK mới, chạy trên AVD riêng `cnpm_api36` với API V2/SQL acceptance riêng và lưu ảnh/video cho:

1. P01 A1 → A101 (cùng tầng); sảnh A0 → A101 (khác tầng); B201 → A101 (khác tòa).
2. Pause/resume, đổi nguồn, đổi đích giữa cạnh, mất/stale/khôi phục tín hiệu, reset và một lần đến đích.
3. Home/background dừng; foreground chờ tiếp tục; đóng/mở và đổi tài khoản không nhận vị trí/callback cũ. Luồng thủ công vẫn dùng được.

PR cần gắn PB-034, tài liệu/ảnh/kết quả trên và giới hạn môi trường. Chỉ chuyển Done sau gate native, reviewer duyệt và merge theo backlog; chưa triển khai RTLS thật hoặc hoàn tất PB-026 trong task này.
