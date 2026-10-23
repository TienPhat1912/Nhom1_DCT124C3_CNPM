# Bản đồ bệnh viện — bản mẫu

Mở **Hành trình → Chỉ đường** trên web hoặc Android:

1. Đang trong tòa: chọn tòa A–G → lầu → checkpoint/phòng gần nhất.
2. Đang ngoài tòa: chọn **Ngoài tòa nhà**, chọn checkpoint trên map hoặc danh sách.
3. Bấm **Tìm đường**. Đích tự lấy từ phòng trên bước hiện tại của phiếu.
4. Tuyến ngắn nhất được tô xanh; chọn tầng đang xem để theo dõi đoạn đổi tầng.
5. Bấm **Nghe chỉ đường** để nghe cùng nội dung với hướng dẫn từng chặng.
6. Tới checkpoint mới, bấm **Tôi đang ở đây**, rồi tìm đường lại.

Mỗi phòng là một node. Cổng, sảnh, hành lang và thang máy là các checkpoint cố
định bổ sung. Đổi tòa, tầng, checkpoint hoặc phòng đích xóa tuyến cũ và dừng
thuyết minh. Đích thay đổi theo dữ liệu phiếu được cập nhật từ máy chủ.
Chọn vị trí không làm hoàn thành bước khám. Không tự định vị hoặc tự xác nhận
bệnh nhân đã đến nơi.

## Giới hạn của dữ liệu mẫu

Ảnh nền do người dùng cung cấp: `sd_bv_dkhoa_tduc.jpg`, chỉ thể hiện các khu.
Vị trí phòng, tầng, thang máy và các cạnh nối là **minh họa**, chưa được xác
nhận ngoài thực địa. Giao diện luôn thông báo bản mẫu. Các điểm tầng trên
được chiếu lên sơ đồ khuôn viên; đây chưa phải bản vẽ mặt bằng chi tiết.
Tầng 1/2/3 theo dữ liệu demo, không khẳng định cách đánh số tầng thực tế.

Trọng số tìm đường hiện là đơn vị tương đối của mô hình, không phải mét/phút.
Dijkstra chỉ đi trên cạnh được khai báo; không vẽ đường thẳng khi thiếu tuyến.
Phòng khớp bằng đủ khu + tầng + mã phòng trong snapshot phiếu, không suy đoán
từ tên khoa hay location ID. Phòng chưa cấu hình báo liên hệ tiếp nhận.
Giọng đọc dùng Web Speech API / expo-speech trên thiết bị. Thiếu giọng đọc
hoặc lỗi âm thanh vẫn giữ nguyên hướng dẫn chữ.

## Cấu hình checkpoint

Chỉnh `packages/shared/src/hospitalMap.ts`, dùng chung web và Android:

- `nodes`: ID ổn định, tọa độ x/y trong khung 604 × 666, tầng, tên Việt/Anh.
  Node trong nhà có `building`; node ngoài nhà bỏ trống thuộc tính này.
  Mỗi phòng có `kind: "room"`, `building`, `floor`, `room`.
- `pairs`: chỉ nối hai checkpoint có lối đi thực. Thêm node ở chỗ rẽ để
  đường không xuyên khối nhà. Không tự nối mọi phòng.
- `edges`: trọng số dương; mặc định hai chiều, có thể `oneWay: true`.
  `closed: true` trên node/cạnh loại khỏi tìm đường. Đổi tầng phải qua
  cạnh thang máy; thêm đủ checkpoint thang máy cho tầng được phục vụ.
- Sau khảo sát, thay tọa độ và trọng số bằng dữ liệu đã xác nhận trong cùng
  một hệ đơn vị. Bản mẫu không tính tình trạng thang máy hay tắc đường trực tiếp.

Ảnh nền được đóng gói ở `apps/web/public/maps/thu-duc-campus.jpg` và
`apps/mobile/assets/thu-duc-campus.jpg`; cập nhật đồng bộ khi đổi sơ đồ.

Các phòng mẫu: A101, R01, P01 ở A/tầng 1; C01 ở C/tầng 1;
B201/B202 ở B/tầng 2; D301 ở D/tầng 3.

**Database demo cũ:** seed trước đây để mặc định khu A cho mọi phòng. Seed mới
đã sửa B201/B202 thành B, C01 thành C, D301 thành D. Với database có sẵn,
sửa khu của các phòng này trong trang quản trị Địa điểm và tạo phiếu mới.
Phiếu cũ giữ snapshot cũ; không sửa hồi tố để ép khớp bản đồ.

## Kiểm tra

```text
node --experimental-strip-types --test tests/unit/hospital-map.test.mjs
npm run typecheck
npm run lint
npm run build
npm run dev
npx playwright test tests/browser/hospital-map.spec.ts
```

Browser test dùng API giả lập, không cần SQL Server; chạy ở cả desktop/mobile
viewport. Kiểm tra lựa chọn trong/ngoài tòa, reset vị trí, đổi tầng, đọc tuyến,
lỗi âm thanh, cập nhật phòng đích và phòng không có trên map. Unit test so
sánh mọi cặp checkpoint với Bellman-Ford độc lập, cạnh đóng/một chiều và
trọng số không hợp lệ. Giao diện Android cần kiểm tra thêm trên thiết bị.
