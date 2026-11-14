# PB-033 Thiết kế lại bản đồ và mạng đường đi các tầng, các tòa

| Trường | Giá trị |
|---|---|
| Trạng thái | Ready |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Bản đồ |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | Không; giữ tương thích ID phòng/đích hiện có |
| Đối chiếu kế hoạch | Mở rộng bản đồ theo yêu cầu ngày 14/11/2026 |
| Branch gợi ý | `feat/pb-033-map-layout` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Mặt bằng demo tự thiết kế và mạng đường đi dùng chung cho web/mobile, phủ các tòa A–G và các tầng/phòng đã cấu hình. Chi tiết thiết kế nằm ngay trong task này; nguồn vị trí thuộc [PB-034](./PB-034-rtls-simulation.md), tích hợp hướng dẫn thuộc [PB-026](./PB-026-route-narration.md).

## Thiết kế và hợp đồng bản đồ

Mã hiện tại ở `codes/packages/shared/src/hospitalMap.ts` có các tòa A–G và đồ thị mẫu; tọa độ, lối vào và hành lang là dữ liệu mẫu. Mặt bằng demo tự thiết kế không khẳng định phản ánh mặt bằng bệnh viện thực tế.

1. Kiểm kê danh mục tòa, tầng, phòng và các điểm đến Journey đang dùng. Lập bảng phủ toàn bộ các tòa A–G, các tầng được cấu hình và các phòng/điểm đến; công bố rõ tầng nào không tồn tại hoặc chưa có dữ liệu. Không tự suy diễn số tầng từ mã phòng.
2. Tự thiết kế mặt bằng từng tầng: đường bao, phòng, cửa phòng, hành lang, giao lộ, sảnh, thang máy, cầu thang, lối ra và lối nối giữa các tòa. Có bản tổng quan khuôn viên và bản chi tiết từng tầng/tòa.
3. Dùng một bộ dữ liệu cho hình vẽ và tính tuyến. Phòng nối từ cửa vào hành lang; cạnh đi bộ không xuyên phòng/tường. Khác tầng phải qua thang; khác tòa phải qua lối nối có khai báo tầng ở hai đầu.
4. Mỗi nút có ID ổn định, tòa, tầng và tọa độ trong mặt bằng tương ứng. Tách tọa độ khuôn viên với tọa độ tầng; không nội suy trực tiếp giữa hai hệ tọa độ. Cạnh có loại đi bộ/thang máy/cầu thang/lối nối, chiều đi và trạng thái đóng. Chỉ hiển thị mét hoặc thời gian thực khi có dữ liệu được hiệu chỉnh; trọng số đồ thị demo không tự trở thành mét.
5. Tạo chặng hướng dẫn ở điểm bắt đầu, trước chỗ rẽ, chỗ đổi tầng/tòa và điểm đến; gộp các nút thẳng hàng thành một chặng. Không đọc lại ở mỗi lần cập nhật tọa độ. Chỗ rẽ được xác định từ hướng đi trong cùng mặt bằng; đổi tầng/tòa là thao tác riêng.

PB-033 chốt cấu trúc mặt bằng/đồ thị, ánh xạ ID phòng và kết quả tính tuyến có chặng/thao tác chuyển tầng để PB-034 và PB-026 dùng chung.

## Phạm vi mã nguồn

Đường dẫn từ `codes/`: packages/shared/src/hospitalMap.ts, hospitalDepartments.ts và module dữ liệu/tính tuyến mới nếu cần; apps/web/src/HospitalMap.tsx; apps/mobile/src/HospitalMap.tsx; map tests và tài liệu mặt bằng demo. Khảo sát API/danh mục để ánh xạ ID, không tự thay dữ liệu phòng nghiệp vụ.

## Tiêu chí chấp nhận

- [ ] Có bảng kiểm kê tòa/tầng/phòng/đích Journey, bản tổng quan và mặt bằng từng tầng; ghi rõ dữ liệu tự thiết kế và mục chưa ánh xạ. Không âm thầm bỏ tòa/tầng đã cấu hình.
- [ ] Bố trí phòng, cửa, hành lang, giao lộ, sảnh, thang máy/cầu thang và lối nối; hình vẽ và đồ thị lấy cùng dữ liệu. Tuyến đi qua cửa/hành lang, không xuyên tường/phòng.
- [ ] Tính và hiển thị tuyến cùng tầng, khác tầng, khác tòa bằng kết nối hợp lệ. Cạnh đóng/một chiều có hiệu lực; phòng không ánh xạ hoặc tuyến không tồn tại được báo rõ.
- [ ] Định danh tòa/tầng rõ ràng; tách tọa độ khuôn viên và tọa độ tầng. Không coi trọng số demo là mét hay thời gian đi bộ thật.
- [ ] Kết quả tuyến có chặng và thao tác rẽ/đổi tầng/đổi tòa/đến đích cho PB-034/026; không coi mọi nút thẳng hàng là điểm phải đọc.
- [ ] Web/mobile chọn tòa/tầng, hiển thị điểm xuất phát/đích/tuyến và hướng đi rõ ràng; giữ tương thích chọn vị trí thủ công và các ID điểm đến hiện có.

## Kiểm chứng bắt buộc

Map tests kiểm tra tính hợp lệ đồ thị, tham chiếu ID, liên thông các điểm có trong phạm vi, tuyến qua cửa/thang/lối nối, cạnh đóng và không có tuyến. Review trực quan toàn bộ mặt bằng; browser/native kiểm tra cùng tầng, khác tầng, khác tòa. Chạy các kiểm tra phù hợp theo [quy ước Done](../README.md#hoàn-thành-một-task), ghi bằng chứng và giới hạn trong PR.

## Ngoài phạm vi

Không triển khai nguồn vị trí hoặc mô phỏng chuyển động (PB-034), điều phối TTS theo vị trí (PB-026), RTLS thật hoặc công cụ quản trị chỉnh sửa mặt bằng.

## Bàn giao

- [ ] Đạt tiêu chí và quy ước Done; tài liệu ghi danh mục phủ và quyết định mặt bằng.
- [ ] PB-034/026 có hợp đồng dữ liệu chặng và ID ổn định để sử dụng.
- [ ] PR ghi PB-033, bằng chứng hình ảnh/kiểm thử; reviewer duyệt và merge mới chuyển Done.
