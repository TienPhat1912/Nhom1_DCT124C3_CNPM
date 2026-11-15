# PB-026 — Kiểm tra dependency và phần chuẩn bị

Ngày 15/11/2026, kiểm tra source thực tế trước khi triển khai:

| Dependency | Hiện trạng trong source | Còn thiếu để PB-026 tích hợp |
|---|---|---|
| PB-033 | Đã có mã local: 25 mặt bằng tầng, khuôn viên riêng, MapRoute/MapLeg và chỉ dẫn trước rẽ/chuyển tầng/tòa; xem [hợp đồng PB-033](PB-033-MAP-LAYOUT.md) | Gate APK/thiết bị và reviewer/merge; PB-026 cần dùng hợp đồng chặng mới khi tích hợp |
| PB-034 | Chưa có module nguồn vị trí hoặc controller mô phỏng trong shared | Hợp đồng vị trí, session/route/leg ID, timestamp, marker nội suy, giữ vị trí giữa cạnh khi đổi tuyến, start/pause/resume/reset/dispose và handshake tiếp tục |
| PB-024/025 | Có Journey narration và route speech riêng, có cleanup tại ranh giới phiên/ngôn ngữ | Bộ điều phối quyền âm thanh chung và handshake giữa speech với controller vị trí |

Đã có mã PB-033 local để import; PB-034 vẫn chưa có. Không thể hoàn tất chu kỳ 5 giây/chặng,
dừng ít nhất 1 giây, lệch tuyến/mất tín hiệu và đổi đích giữa cạnh bằng cách
chỉ sửa các hook speech hiện tại. PB-026 ghi rõ thiết kế mặt bằng và nguồn vị
trí thuộc hai task phụ thuộc, không phải phần được tự mở rộng trong PB-026.

Theo yêu cầu tiếp theo, PB-033 đã được triển khai riêng. PB-026 vẫn chỉ có
phần chuẩn bị dưới đây, chờ PB-034 và các gate phụ thuộc; chưa coi Ready/Done.

## Phần chuẩn bị độc lập

`packages/shared/src/audioCoordinator.ts` cung cấp lease âm thanh, ưu tiên
Journey/gọi số trước dẫn đường, từ chối route trong lúc Journey giữ quyền,
watchdog cấu hình theo lần acquire và bỏ release/timeout của lease cũ.
Thu hồi lease xóa timer trước khi gọi cancellation. Lỗi callback/subscriber
không làm kẹt quyền âm thanh. Đây là module chuẩn bị, **chưa nối vào các hook
web/mobile, chưa bật tính năng hoặc công bố PB-026 hoàn tất**.

Kiểm thử độc lập:

```text
node --experimental-strip-types --test tests/unit/audio-coordinator.test.mjs
npm.cmd run typecheck
npm.cmd run lint
```

Các ca kiểm tra priority/preemption, timeout, stale callback, cancellation
reentrant dạng release và exception của engine/subscriber. Chưa thay thế các
gate bắt buộc của PB-026: controller với đồng hồ giả, browser mocked speech,
demo marker/video, native cùng/khác tầng/tòa và nền/foreground.

Không thay dependency card thành Done, không tạo tọa độ cho phòng chưa ánh
xạ và không thêm cơ chế di chuyển tạm để giả định PB-034 đã tồn tại.
