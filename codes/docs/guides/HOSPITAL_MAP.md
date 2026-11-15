# Bản đồ bệnh viện — mặt bằng demo PB-033

Mở **Hành trình → Chỉ đường** trên web hoặc Android:

Mặc định PB-034 mở **Mô phỏng RTLS** tại Cổng 1. Chọn điểm đầu, bấm
**Bắt đầu / tiếp tục**, rồi xác nhận ở mỗi điểm hướng dẫn; có pause/reset,
thử lệch tuyến và mất/stale tín hiệu. Mỗi chặng demo 5 giây, dừng ít nhất
1 giây; không phải vị trí thiết bị hoặc thời gian đi bộ thực. Chưa nối TTS
theo vị trí. Xem [hướng dẫn và hợp đồng PB-034](../requirements/PB-034-RTLS-SIMULATION.md).

Chọn **Thủ công** để dùng quy trình chọn vị trí và đọc tuyến tĩnh bên dưới:

1. Trong tòa: chọn tòa A–G → lầu → checkpoint/phòng/khoa gần nhất.
2. Ngoài tòa: chọn **Ngoài tòa nhà** rồi chọn checkpoint trên map hoặc danh sách.
3. Bấm **Tìm đường**. Mặc định đích lấy từ phòng trên bước hiện tại của phiếu.
4. Để tra cứu khoa khác, mở **Tra cứu khoa/phòng**, tìm tên khoa và chọn
   khoa cần đến. Nếu khoa có nhiều tầng, chọn tầng đích. Việc tra cứu không
   thay đổi thông tin phiếu hoặc chỉ định khám.
5. Chọn **Tòa đang xem** rồi **Tầng đang xem** để xem khuôn viên hoặc mặt bằng
   của tầng/tòa tương ứng. Duyệt mặt bằng giữ nguyên điểm xuất phát và tuyến.
   Chọn một chặng để mở đúng mặt bằng của chặng đó.
6. Bấm **Nghe chỉ đường** để nghe cùng nội dung với hướng dẫn từng chặng.
7. Tới checkpoint mới, chọn điểm đó trên bản đồ hoặc danh sách rồi tìm đường lại.

Mỗi phòng nối qua cửa riêng vào hành lang. Mỗi điểm vào khoa ở một tầng có một node riêng. Khoa
nhiều tầng có nhiều điểm vào, không gộp các tầng thành một vị trí. Đổi nguồn,
đích hoặc tầng đích xóa tuyến cũ và dừng thuyết minh. Chọn vị trí không làm
hoàn thành bước khám. Không tự định vị bệnh nhân.

## Danh mục từ ảnh

`packages/shared/data/hospital-departments.json` chứa 50 mục; 47 mục từ ảnh gồm:
C: 19, D: 8, F: 1, G: 3, A: 6, B: 5, E: 2, khu chưa xác định: 3.

Khu/tầng được chép từ ảnh người dùng cung cấp, gồm:

- C: tầng hầm (Dược), trệt, tầng 1–7.
- D: trệt, tầng 1–3.
- A: trệt, tầng 1.
- B: trệt; Nội tổng hợp ở tầng 1 và 2.
- G: hội trường ở hầm; Nội thận – Thận nhân tạo ở trệt và 1;
  Nội tim mạch – Lão học ở tầng 2 và 3.

Thêm 3 mục từ Excel (Nội thần kinh, Sản chưa phân biệt B/C, Phòng khám Chuyên gia), tổng cộng 50. Cả ba chưa có vị trí.
Xem [danh mục khoa và bác sĩ](HOSPITAL_DIRECTORY.md) cho phạm vi đồng bộ.

Sáu mục từ ảnh **Cần xác nhận**:

- Khoa Y học cổ truyền (F): chưa rõ tầng.
- Khám chữa bệnh chất lượng cao và Giải phẫu bệnh (E): chưa rõ tầng.
- Phòng Tiếp công dân, Da liễu, Vật lý trị liệu – Phục hồi chức năng:
  chưa rõ khu và tầng.

Các mục này vẫn tìm thấy trong danh mục nhưng không tạo node đích hoặc tuyến
giả định. Sảnh E/F là checkpoint mẫu của khu, không thay cho vị trí khoa.
Không suy đoán khoa đích từ tên phòng trên phiếu.

## Giới hạn và cấu hình

**Tọa độ điểm vào khoa, phòng mẫu, thang máy và lối đi là tự thiết kế để demo**,
cần đối chiếu thực tế. Có khuôn viên và 25 mặt bằng tầng riêng; không dùng ảnh
khuôn viên cũ để thể hiện các tầng. Khu và tầng trong danh mục khoa giữ thông
tin nguồn; E/F chỉ có sảnh tầng trệt demo, chưa xác nhận tầng của khoa.
Xem [kiểm kê từng tầng/phòng](../requirements/PB-033-MAP-INVENTORY.md) và
[hợp đồng PB-033](../requirements/PB-033-MAP-LAYOUT.md).

- Mã tầng: `-1` = hầm, `0` = trệt, `1`…`7` = tầng trên. Sân ngoài nhà ở
  mức trệt. Phòng demo vẫn giữ số tầng trong snapshot phiếu.
- `packages/shared/data/hospital-layout.json` khai báo phạm vi tầng, khuôn viên
  và metadata phòng Journey. `hospitalLayout.ts` tạo hình học và đồ thị dùng
  chung web/mobile; `hospitalMap.ts` giữ entry point tương thích.
- Mỗi tầng có `spaceId` riêng (`floor:A:1`…), khuôn viên có `spaceId=campus`.
  Chỉ vẽ/nội suy trong cùng hệ tọa độ. Các mặt bằng gồm tường, khe cửa,
  hành lang, phòng, sảnh, thang máy/cầu thang và cửa ra; tuyến đi đúng cửa.
- `kind: "room"` có khu + tầng + mã phòng, khớp đủ ba thông tin trên phiếu.
  `kind: "department"` liên kết `departmentId` của danh mục, không tự tạo
  số phòng lâm sàng. ID point ổn định theo khoa + tầng.
- Cạnh có trọng số dương, mặc định hai chiều; hỗ trợ `oneWay`, `closed`.
  Thang máy/cầu thang nối tầng; connector nối cửa tầng trệt với khuôn viên,
  khai báo tầng và hệ tọa độ hai đầu. Trọng số là đơn vị mô hình,
  không phải mét/phút. Dijkstra không tạo đường thẳng khi thiếu kết nối.
- Chặng thẳng gộp nhiều checkpoint; chỉ dẫn rẽ phát tại đầu chặng trước
  khi rẽ. Đổi tầng/tòa là thao tác riêng; không suy góc từ hai mặt bằng khác nhau.
- Danh mục/phòng mới từ API chưa có ánh xạ vẫn được liệt kê trong phần
  kiểm kê với lý do, không tự tạo tầng/tọa độ từ số phòng.
- Giọng đọc dùng Web Speech API / expo-speech. Khi thiếu giọng đọc hoặc lỗi
  âm thanh, hướng dẫn chữ vẫn hiển thị.

Phòng mẫu: A101/R01/P01 ở A tầng 1; C01 ở C tầng 1; B201/B202 ở B tầng 2;
D301 ở D tầng 3. Database demo cũ có thể còn khu A cho tất cả phòng.
Sửa khu B201/B202 thành B, C01 thành C, D301 thành D ở quản trị Địa điểm,
rồi dùng phiếu mới; phiếu cũ giữ snapshot cũ theo thiết kế.

## Chạy ứng dụng và khắc phục ECONNREFUSED 5280

`npm run dev` chỉ chạy web, vẫn cần API và SQL Server.
Chạy toàn bộ bằng Docker từ thư mục `codes`:

```powershell
docker compose up -d --build --wait --wait-timeout 180
```

Mở http://localhost:5180. Nếu web Docker đã chạy thì không chạy thêm Vite
trên cùng cổng. Để phát triển bằng Vite, chủ động dừng riêng web Docker:

```powershell
docker compose stop web
docker compose up -d sql api
npm run dev
```

Kiểm tra API: `Invoke-RestMethod http://127.0.0.1:5280/health`.
Nếu API chưa chạy, xem `docker compose logs --tail=60 api sql`.
Không đổi cổng proxy chỉ để che lỗi backend chưa khởi động.

## Kiểm tra bản đồ độc lập

```text
npm run test:map:unit
npm run typecheck
npm run lint
npm run build
npm run test:map
node tests/map/render-atlas.mjs
```

`npm run test:map` dùng API giả lập, tự mở Vite riêng ở cổng 5189 và dừng
sau kiểm thử. Không cần SQL Server/API, không dùng nhầm bản web Docker cũ.
Có thể đổi cổng bằng `MAP_TEST_PORT`. Cấu hình trong
`playwright.map.config.ts` đã được đưa vào repository.

Trên Windows, Playwright tự dùng Chrome hoặc Edge đã cài. Nếu máy không có
hai trình duyệt này, chạy `npx playwright install chromium` một lần.
Có thể chỉ định `PLAYWRIGHT_CHANNEL=chrome`, `msedge` hoặc `chromium`.
CI dùng Chromium của Playwright như trước.

Lệnh render atlas dùng `PLAYWRIGHT_CHANNEL=chrome` khi chỉ có Chrome cài sẵn;
CI dùng Chromium của Playwright. Ảnh khuôn viên, toàn bộ 25 mặt bằng trên
desktop/mobile viewport, tuyến mẫu và atlas nằm tại `artifacts/pb033/`.

Kiểm thử bao gồm tìm khoa, khoa nhiều tầng, hầm/tầng 4, phòng chưa ánh xạ,
đóng/một chiều/mất tuyến, gộp chặng, hướng mũi tên, đổi điểm đầu/đích và hủy
callback giọng đọc cũ. Unit tests kiểm tra hình học từng cạnh, tính liên thông
toàn đồ thị và so chi phí tối ưu với Bellman-Ford độc lập từ 10 nguồn tới mọi
đích. Component tests kiểm tra luồng native; chúng không thay kiểm tra APK trên
giả lập/thiết bị. Gate riêng: `node --experimental-strip-types tests/android/android-map-layout.mjs`,
với APK mới đã xác minh và API V2/SQL fixture riêng theo hợp đồng PB-033.
