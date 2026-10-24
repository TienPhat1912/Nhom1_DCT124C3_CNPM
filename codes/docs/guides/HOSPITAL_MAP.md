# Bản đồ bệnh viện — bản mẫu

Mở **Hành trình → Chỉ đường** trên web hoặc Android:

1. Trong tòa: chọn tòa A–G → lầu → checkpoint/phòng/khoa gần nhất.
2. Ngoài tòa: chọn **Ngoài tòa nhà** rồi chọn checkpoint trên map hoặc danh sách.
3. Bấm **Tìm đường**. Mặc định đích lấy từ phòng trên bước hiện tại của phiếu.
4. Để tra cứu khoa khác, mở **Tra cứu khoa/phòng (50)**, tìm tên khoa và chọn
   khoa cần đến. Nếu khoa có nhiều tầng, chọn tầng đích. Việc tra cứu không
   thay đổi thông tin phiếu hoặc chỉ định khám.
5. Chọn **Tầng đang xem** để xem đoạn đường trên tầng hầm, trệt hoặc tầng 1–7.
6. Bấm **Nghe chỉ đường** để nghe cùng nội dung với hướng dẫn từng chặng.
7. Tới checkpoint mới, bấm **Tôi đang ở đây**, rồi tìm đường lại.

Mỗi phòng có một node. Mỗi điểm vào khoa ở một tầng có một node riêng. Khoa
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

Ảnh nền `sd_bv_dkhoa_tduc.jpg` không thể hiện chi tiết từng phòng.
**Tọa độ điểm vào khoa, phòng mẫu, thang máy và lối đi vẫn là minh họa**,
cần đối chiếu thực tế. Tầng trên được chiếu lên sơ đồ khuôn viên, chưa phải
mặt bằng riêng. Khu và tầng trong danh mục khoa giữ đúng thông tin trên ảnh.

- Mã tầng: `-1` = hầm, `0` = trệt, `1`…`7` = tầng trên. Sân ngoài nhà ở
  mức trệt. Phòng demo vẫn giữ số tầng trong snapshot phiếu.
- Chỉnh tọa độ/nối đường trong `packages/shared/src/hospitalMap.ts`.
  `buildingLayout` chứa điểm vào thang máy, hành lang và các vị trí minh họa
  cho khoa. `pairs` chỉ nối các checkpoint có lối đi; thêm node ở chỗ rẽ.
- `kind: "room"` có khu + tầng + mã phòng, khớp đủ ba thông tin trên phiếu.
  `kind: "department"` liên kết `departmentId` của danh mục, không tự tạo
  số phòng lâm sàng. ID point ổn định theo khoa + tầng.
- Cạnh có trọng số dương, mặc định hai chiều; hỗ trợ `oneWay`, `closed`.
  Chỉ thang máy nối hai tầng khác nhau. Trọng số là đơn vị mô hình,
  không phải mét/phút. Dijkstra không tạo đường thẳng khi thiếu kết nối.
- Ảnh đóng gói tại `apps/web/public/maps/thu-duc-campus.jpg` và
  `apps/mobile/assets/thu-duc-campus.jpg`, cần cập nhật đồng bộ.
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
```

`npm run test:map` dùng API giả lập, tự mở Vite riêng ở cổng 5189 và dừng
sau kiểm thử. Không cần SQL Server/API, không dùng nhầm bản web Docker cũ.
Có thể đổi cổng bằng `MAP_TEST_PORT`. Cấu hình trong
`playwright.map.config.ts` đã được đưa vào repository.

Trên Windows, Playwright tự dùng Chrome hoặc Edge đã cài. Nếu máy không có
hai trình duyệt này, chạy `npx playwright install chromium` một lần.
Có thể chỉ định `PLAYWRIGHT_CHANNEL=chrome`, `msedge` hoặc `chromium`.
CI dùng Chromium của Playwright như trước.

Kiểm thử bao gồm desktop/mobile viewport, tìm khoa, khoa nhiều tầng, đi tới
tầng hầm/tầng 4, vị trí cần xác nhận, reset tuyến/giọng đọc và lỗi âm thanh.
Unit test kiểm tra đủ mục danh mục, tính liên thông và so sánh mọi cặp node
với Bellman-Ford. Android cần kiểm tra thêm trên thiết bị thật.
