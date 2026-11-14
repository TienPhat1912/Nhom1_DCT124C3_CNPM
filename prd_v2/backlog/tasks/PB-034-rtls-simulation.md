# PB-034 Mô phỏng vị trí RTLS và di chuyển theo chặng

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Bản đồ / mô phỏng |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-033](./PB-033-map-layout.md) |
| Đối chiếu kế hoạch | Mở rộng mô phỏng theo yêu cầu ngày 14/11/2026 |
| Branch gợi ý | `feat/pb-034-rtls-simulation` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Nguồn vị trí mô phỏng dùng chung web/mobile, marker di chuyển theo đồ thị và dừng ở điểm hướng dẫn. Chi tiết chu kỳ và ngoại lệ tích hợp trong [PB-026](./PB-026-route-narration.md). PB-026 nối nguồn này với Journey/TTS để hoàn thành luồng chỉ đường.

## Hợp đồng nguồn vị trí và điều khiển

PB-033 chốt cấu trúc mặt bằng/đồ thị, ánh xạ ID phòng và kết quả tính tuyến có chặng/thao tác chuyển tầng. PB-034 chốt nguồn vị trí gồm `source`, `sessionId`, `buildingId`, `floorId`, tọa độ, `timestamp`, trạng thái khả dụng và thao tác start/pause/resume/reset/dispose. Nguồn thủ công và mô phỏng tuân cùng hợp đồng, RTLS thật là adapter tương lai.

PB-034 xuất sự kiện đến điểm hướng dẫn kèm ID phiên/tuyến/chặng và đợi lệnh tiếp tục từ PB-026. PB-026 chỉ phát mỗi chỉ dẫn một lần cho một phiên/tuyến/chặng; loại bỏ callback/speech/timer của tuyến cũ. Chốt giá trị ngưỡng stale và timeout TTS trong cấu hình và ghi lại trong hướng dẫn demo.

Mặc định di chuyển 5 giây/chặng và dừng tối thiểu 1 giây tại điểm hướng dẫn, kể cả chặng cuối. Đây là tốc độ trình diễn; chặng dài và ngắn có thể cùng mất 5 giây. Marker cập nhật liên tục, không dùng 5 giây làm khoảng cách giữa hai lần phát vị trí. PB-026 quyết định lệnh tiếp tục sau lời đọc; PB-034 kiểm thử độc lập bằng bộ điều khiển thử, không phụ thuộc ngược PB-026.

## Phạm vi mã nguồn

Đường dẫn từ `codes/`: module nguồn vị trí/bộ điều khiển mô phỏng mới trong packages/shared/src/; apps/web/src/HospitalMap.tsx; apps/mobile/src/HospitalMap.tsx; kiểm thử map/position và UI liên quan. Không đặt hai bộ logic thời gian khác nhau cho web/mobile.

## Tiêu chí chấp nhận

- [ ] Hợp đồng vị trí có nguồn, ID phiên, tòa/tầng/tọa độ, timestamp, trạng thái khả dụng; có start/pause/resume/reset/dispose. Chế độ thủ công vẫn hoạt động độc lập.
- [ ] UI ghi rõ Mô phỏng RTLS; khi mở phiên dùng điểm đầu demo hợp lệ, cho phép đổi điểm đầu; không tuyên bố nhận vị trí thiết bị thật hoặc mang vị trí qua tài khoản khác.
- [ ] Marker nội suy mượt dọc các cạnh của mỗi chặng trong khoảng 5 giây, dừng ngay trước điểm rẽ/đổi tầng/tòa hoặc tại đích. Không cắt góc qua tường, không nội suy giữa hệ tọa độ tầng khác nhau.
- [ ] Phát sự kiện đến điểm hướng dẫn kèm ID phiên/tuyến/chặng và giữ dừng ít nhất 1 giây; chỉ đi tiếp khi nhận lệnh tiếp tục hợp lệ. PB-026 quyết định lệnh theo TTS; PB-034 được kiểm thử bằng bộ điều khiển thử, không phụ thuộc ngược PB-026.
- [ ] Có điều khiển bắt đầu/tiếp tục, tạm dừng, đặt lại và đổi điểm xuất phát; thao tác thử lệch tuyến và mất/khôi phục tín hiệu. Đứng yên vẫn cập nhật timestamp; mất/stale tín hiệu dừng tiến độ.
- [ ] Khi đổi tuyến giữa cạnh, cung cấp vị trí hiện tại trên cạnh làm điểm đầu tạm; không nhảy lại đầu chặng. Chuyển tầng/tòa hiển thị bước chuyển và mặt bằng hiện tại rõ ràng.
- [ ] Đóng bản đồ/đổi phiên/đưa app vào nền dừng chuyển động, hủy timer/subscription; callback cũ không cập nhật phiên mới. Khôi phục tín hiệu/foreground không chạy bù quãng đường.
- [ ] Thời gian chặng, dừng và ngưỡng stale có cấu hình chung; không dùng thời gian demo làm thời gian đi bộ thực. Chưa nối TTS thì không công bố luồng dẫn đường hoàn chỉnh đã sẵn sàng.

## Kiểm chứng bắt buộc

Kiểm thử đồng hồ giả cho chặng 5 giây, dừng tối thiểu 1 giây, lệnh tiếp tục trễ, pause/resume/reset, mất/stale tín hiệu và callback phiên cũ. Browser/native quan sát marker cùng tầng/khác tầng/khác tòa và vòng đời app. Chạy kiểm tra phù hợp theo [quy ước Done](../README.md#hoàn-thành-một-task), ghi bằng chứng và giới hạn trong PR.

## Ngoài phạm vi

Không tích hợp cảm biến/RTLS thật, không xây lại mặt bằng (PB-033), không điều phối lời đọc/Journey (PB-026), không chạy vị trí nền và không thay trạng thái khám khi đến đích.

## Bàn giao

- [ ] Đạt tiêu chí và quy ước Done; tài liệu hợp đồng điều khiển và cấu hình thời gian cho PB-026.
- [ ] PR ghi PB-034 và bằng chứng kiểm thử/ảnh hoặc video; reviewer duyệt và merge mới chuyển Done.
