# PB-033 — Mặt bằng và hợp đồng tuyến dùng chung

Ngày kiểm chứng local: 15/11/2026. Mã đã triển khai cho web và mobile; còn gate APK/thiết bị Android và reviewer/merge trước khi chuyển task thành Done. Đây là mặt bằng demo tự thiết kế, không phải bản vẽ khảo sát hoặc công cụ dẫn đường đã được hiệu chỉnh tại bệnh viện.

## Danh mục và nguồn dữ liệu

[Bảng kiểm kê đầy đủ](PB-033-MAP-INVENTORY.md) ghi từng tầng, ID điểm vào khoa, phòng Journey và 81 phòng khám nhập từ danh mục. Nguồn gồm `hospital-departments.json`, `hospital-roster.json`, metadata phòng Journey hiện có và cách nhập vị trí trong backend `HospitalCatalog.cs`.

| Tòa | Tầng có mặt bằng demo |
|---|---|
| A | 0, 1 |
| B | 0, 1, 2 |
| C | -1, 0, 1, 2, 3, 4, 5, 6, 7 |
| D | 0, 1, 2, 3 |
| E | 0 — chỉ sảnh/lối vào demo, chưa xác nhận tầng của khoa |
| F | 0 — chỉ sảnh/lối vào demo, chưa xác nhận tầng của khoa |
| G | -1, 0, 1, 2, 3 |

Tổng cộng 25 mặt bằng tầng và một khuôn viên, 425 nút và 480 cạnh trong phiên bản `pb033-demo-v1`. Có 7 phòng Journey và 44 điểm vào khoa theo tầng. Chín khoa thiếu tòa hoặc tầng vẫn hiện trong danh mục nhưng không có node đích. Các tầng ngoài bảng chưa có dữ liệu; không kết luận chúng không tồn tại trong thực tế.

81 phòng khám của nguồn nhập chưa được xác nhận tòa/tầng; 12 mục còn thiếu mã phòng. Không lấy số phòng hoặc tên khoa làm bằng chứng về tầng. Danh mục trong giao diện cũng liệt kê các phòng/khoa mới do API cấu hình trả về mà chưa ánh xạ; không tự sinh tọa độ cho chúng. PB-033 không migration, sửa vị trí nghiệp vụ, đổi snapshot phiếu hoặc hoàn tất khám khi người dùng chọn/đến đích.

## Dữ liệu hình vẽ và mạng đường đi

- `packages/shared/data/hospital-layout.json`: phiên bản, phạm vi tầng, footprint khuôn viên và vị trí tòa/tầng được khai báo rõ cho phòng Journey.
- `hospitalLayout.ts`: tạo `MapSpace`, tường có khe cửa, vùng hành lang, phòng, cửa, sảnh, lõi thang và đồ thị từ cùng dữ liệu. Phòng chỉ nối qua cửa riêng; không làm lối tắt xuyên phòng khác. Thang máy phục vụ các tầng đã công bố, cầu thang nối tầng liền kề. Tòa nối với khuôn viên tại cửa tầng trệt.
- `mapModel.ts`, `mapRouting.ts`, `mapValidation.ts`: kiểu dữ liệu, Dijkstra, chặng, kiểm tra tham chiếu, hệ tọa độ và giao cắt hình học. Validator dùng hợp các khoảng hành lang và kiểm tra giao tường, không chỉ lấy vài điểm mẫu trên cạnh.
- `mapPresentation.ts`: nhãn sáu ngôn ngữ và `mapScene` giới hạn nét vẽ trong đúng một hệ tọa độ.
- `apps/web/src/FloorPlan.tsx`, `apps/mobile/src/FloorPlan.tsx`: SVG tương ứng, dùng cùng `MapSpace` và tuyến, có mũi tên đúng chiều đi. Không phủ tầng lên ảnh khuôn viên cũ.

`campus` có kích thước 604 × 760 đơn vị vẽ. Mỗi `floor:<building>:<floor>` có kích thước 720 × 500. Đây là hai loại hệ tọa độ riêng, không phải tỷ lệ mét. Không so khoảng cách, tính góc rẽ, vẽ đoạn thẳng hoặc nội suy giữa các `spaceId` khác nhau.

## Hợp đồng cho PB-034 và PB-026

Các API tiếp tục xuất từ `packages/shared/src/hospitalMap.ts` và entry point shared hiện có. Các ID đích `room-A101`, `room-R01`, `room-P01`, `room-C01`, `room-B201`, `room-B202`, `room-D301`, `department-<id>-<floor>`, `gate-*`, `entry-*` và `lobby-*` được giữ tương thích.

| Dữ liệu | Quy tắc sử dụng |
|---|---|
| `MapNode` | Có `id`, `building`, `floor`, `x`, `y`, `kind`, `closed`; tất cả node của dataset PB-033 có `spaceId`. `spaceId` chỉ optional trong type để tương thích đồ thị kiểm thử/caller cũ. |
| `MapEdge` | `id`, `from`, `to`, `weight > 0`, `kind`, `zone`; mặc định hai chiều, `oneWay` chỉ cho `from → to`, `closed` chặn cả hai chiều. Node đóng cũng không thể đi qua. |
| `transition` | Cạnh elevator/stairs/connector khai báo `fromSpace`, `toSpace`, `fromFloor`, `toFloor` theo hướng lưu cạnh. Khi đi ngược cạnh hai chiều, dùng thứ tự `route.nodes`/`leg.nodes` để lấy hướng thực tế. Không sửa metadata gốc. |
| `shortestPath(graph, fromId, toId)` | Trả `MapRoute` hoặc `null` nếu thiếu/đóng điểm hoặc không có đường. Không tạo đường dự phòng xuyên hình học. Đích phòng cần khớp đủ mã phòng, tòa, tầng. |
| `MapRoute` | `id`, `nodes`, `edges`, `weight`, `legs`. `edges[i]` nối `nodes[i]` tới `nodes[i + 1]`; thứ tự node thể hiện hướng đi thực tế. `weight` là chi phí demo, không hiển thị thành mét hoặc giây đi bộ. |
| `route.id` / `leg.id` | Chuỗi opaque, ổn định khi cùng đường/hình học/trọng số; route ID chứa chữ ký canonical, không phải hash ngắn có thể va chạm. Không parse, cắt ngắn hoặc lưu làm session ID. Consumer thêm session/generation riêng để callback của lần chạy cũ không ảnh hưởng lần chạy lại cùng tuyến. |
| `MapLeg` | `id`, `action`, `nodes`, `edges`, `fromSpace`, `toSpace`, `transition`. Điểm phát chỉ dẫn là `nodes[0]`, trước khi thực hiện chặng. Điểm kết thúc là node cuối. Các node thẳng hàng được gộp. |
| `action` | `start`, `straight`, `left`, `right`, `uturn`, `elevator`, `stairs`, `enter`, `exit`, `transfer`, `arrive`. Góc rẽ chỉ tính giữa cạnh đi bộ cùng mặt bằng; Y tăng xuống dưới. Sau chuyển hệ tọa độ không suy góc từ hệ cũ. |
| Chặng chuyển hệ tọa độ | Đúng một cạnh, `transition: true`; đổi mặt bằng bằng thao tác riêng. Consumer không nội suy x/y giữa hai đầu thang hoặc giữa cửa tòa với khuôn viên. |
| Chặng đến đích | Một chặng `arrive` cuối tuyến, một node, không có cạnh. Tuyến xuất phát ngay tại đích chỉ có chặng này. Consumer phát thông báo một lần theo session/route/leg, không theo từng bản tin vị trí. |
| `routeInstructions` | Một câu cho mỗi chặng, gồm rẽ/chuyển tầng/tòa/đích; hỗ trợ vi/en/zh/ko/ja/ru và chính sách fallback hiện có. |
| `mapScene(graph, spaceId, route)` | Chỉ trả nét đi bộ nằm trong mặt bằng đang xem; không biến cạnh thang/connector thành đoạn chéo trên SVG. |

PB-034 quản lý vị trí, đồng hồ, nội suy trong cạnh đi bộ và vòng đời phiên. PB-026 điều phối câu đọc theo chặng, quyền ưu tiên âm thanh và handshake tiếp tục. PB-033 chỉ cung cấp mặt bằng/tuyến/chỉ dẫn tĩnh và giữ chọn vị trí thủ công. Không bật mô phỏng chuyển động hoặc đọc theo mỗi bản tin vị trí trong task này.

## Hành vi web và mobile

Người dùng chọn ngoài trời hoặc tòa/tầng/checkpoint làm điểm xuất phát. Bộ chọn **Tòa đang xem / Tầng đang xem** chỉ đổi mặt bằng hiển thị, giữ điểm đầu và tuyến. Chọn chặng trong danh sách mở đúng mặt bằng của chặng; chặng đổi tầng/tòa mở mặt bằng đến. Đổi điểm đầu hoặc đích hủy tuyến/câu đọc cũ; phòng/khoa chưa ánh xạ hoặc ngừng hoạt động có lý do và không cho tìm tuyến giả định. Zoom và tra cứu khoa tiếp tục dùng được.

Khối kiểm kê trong giao diện liệt kê phạm vi tầng và các cấu hình chưa ánh xạ. Tòa E/F có thông báo riêng về sảnh demo. Giao diện vẽ cửa/phòng, hành lang, thang máy/cầu thang, hướng tuyến và nhãn điểm đầu/đích theo mặt bằng đang xem.

## Kiểm chứng và ảnh

Chạy từ `codes/`:

```text
npm.cmd run test:map:unit
npm.cmd run test:directory:unit
npm.cmd run test:languages:unit
node --test tests/unit/native-*.test.mjs
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:map
node tests/map/render-atlas.mjs
npm.cmd run export --workspace @hospital/mobile -- --output-dir ../../artifacts/mobile-android
```

Nếu dùng Chrome cài sẵn, đặt `PLAYWRIGHT_CHANNEL=chrome` trước lệnh render atlas; CI dùng Chromium của Playwright. `MAP_TEST_PORT` đổi cổng Vite riêng của map tests, mặc định 5189.

Kết quả local ngày 15/11/2026:

- 20/20 map unit/component tests: kiểm kê, cửa/tường/hành lang, ID, liên thông 425 nút; đối chiếu chi phí tối ưu với Bellman-Ford độc lập từ 10 nguồn tới toàn bộ đích; tuyến cùng/khác tầng/tòa; cạnh đóng, một chiều, mất đường; gộp chặng, hướng rẽ, một arrival; cùng hệ tọa độ và sáu ngôn ngữ.
- 71/71 native component/hook regression tests, trong đó có bốn ca map mới: cùng/khác tầng/tòa, duyệt tầng giữ điểm đầu, đổi đích/giọng chờ cũ, thiếu vị trí và SVG đúng frame/hướng.
- Directory 3/3, languages 3/3; cả 26 map/directory/languages tests cũng đã chạy lại bằng Node 22.19.0 đúng phiên bản CI và đạt 26/26. Typecheck/contracts, lint và web production build đạt. Vite còn cảnh báo bundle vượt 500 kB, không làm build thất bại.
- 6/6 map browser tests trên desktop và viewport điện thoại, gồm chụp toàn bộ tầng, kiểm tra cấu hình chưa ánh xạ, tuyến/hướng mũi tên, đổi đích, callback speech cũ và không ghi nghiệp vụ.
- Bộ browser Application: 82/82 đạt trong 6,1 phút với web production build, API .NET và SQL fixture `HospitalAcceptance_1794740429495` riêng trên localhost. Không phát hiện lỗi Application trong các ca này; không dùng database demo/online. Lệnh browser: `npx.cmd playwright test --reporter=list --output artifacts/pb033-application` với `WEB_URL`/`API_URL`/`DEMO_PASSWORD` trỏ fixture. Để tái tạo toàn bộ gate CI trên máy đủ công cụ, publish rồi chạy `scripts/test/ci-native.ps1` theo [hướng dẫn kiểm thử](../../tests/README.md). Đây là kiểm tra local, không phải bằng chứng GitHub Actions đã chạy thành công.
- Metro export Android/Hermes đạt. Lệnh `scripts/build/build-android.ps1` dừng ở kiểm tra môi trường: thiếu SDK platform 36; chưa tạo/kiểm tra APK mới hoặc chạy luồng trên giả lập/thiết bị. Mobile viewport và component tests không thay thế gate native này. Các build/browser checks local dùng Node 24.19.0; bộ 26 tests nói trên dùng thêm Node 22.19.0 tải vào cache artifact, không đổi runtime hệ thống. CI khóa Node 22.19.0.

Ảnh sinh tại `artifacts/pb033/`, không commit artifact:

- `chromium-desktop-campus.png`, `chromium-mobile-campus.png`: khuôn viên.
- `chromium-{desktop|mobile}-<building>-<floor>.png`: đủ 25 mặt bằng trên mỗi viewport; hầm có dạng `C--1`/`G--1`.
- `chromium-{desktop|mobile}-B2-route.png`: tuyến và hướng đi ở tầng 2 tòa B.
- `atlas-desktop.png`, `atlas-index.json`: tờ tổng hợp và chỉ mục phiên bản/frame, tái tạo bằng `tests/map/render-atlas.mjs`. Đã rà trực quan atlas và các ảnh khuôn viên/tuyến/điện thoại. Bài chụp atlas tăng chiều cao viewport để chứa trọn khung, giữ nguyên chiều rộng desktop/điện thoại; các bài tương tác dùng viewport thực trong cấu hình Playwright.

Workflow Application chạy map/directory unit tests, giữ các ca browser trong bộ acceptance hiện có, tạo atlas và upload thư mục ảnh. Không thay kết quả local bằng trạng thái CI giả định.

## Gate Android còn lại

Sau khi có SDK/build tools 36, JDK 17 và AVD riêng `cnpm_api36`, build và xác minh APK theo [hướng dẫn Android](../guides/ANDROID.md). Dùng API V2 và database `HospitalAcceptance_<timestamp>` riêng, đặt `API_URL`, `DEMO_PASSWORD`, `ACCEPTANCE_DB`, `ANDROID_SERIAL`, rồi chạy:

```text
node tests/android/verify-android.mjs
node --experimental-strip-types tests/android/android-map-layout.mjs
```

Runner đã chuẩn bị và kiểm tra cú pháp, chưa chạy thiết bị: xác minh hash APK đã cài, tạo fixture synthetic, mở Journey, chọn tuyến cùng tầng/khác tầng/khác tòa, chụp mặt bằng đến, từ chối khoa E chưa có tầng và kiểm tra Visit vẫn Waiting. Ảnh/báo cáo sẽ ghi `artifacts/android/native-pb033-*` và `android-map-layout.json`. Chỉ ghi gate đạt sau khi runner thực sự thành công trên APK mới.

PR cần gắn PB-033, ảnh/báo cáo trên, giới hạn Android và link hợp đồng này; reviewer duyệt/merge rồi mới cập nhật Done. Không deploy hoặc thay dữ liệu bệnh viện trong lần triển khai local này.
