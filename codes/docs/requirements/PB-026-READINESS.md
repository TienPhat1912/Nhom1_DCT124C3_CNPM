# PB-026 — Trạng thái tích hợp

Cập nhật ngày 15/11/2026: đã tích hợp source PB-033/PB-034 với thuyết minh
từng chặng trên web và native. Tài liệu chuẩn bị cũ được thay bằng
[bàn giao PB-026](PB-026-ROUTE-NARRATION.md), ghi hợp đồng, cách chạy,
bằng chứng kiểm thử và giới hạn môi trường.

| Dependency | Tích hợp local |
|---|---|
| PB-033 | Dùng đồ thị/mặt bằng, MapRoute/MapLeg và chỉ dẫn trước rẽ/chuyển tầng/tòa |
| PB-034 | Nối guidance token, dwell, chuyển động, retarget giữa cạnh, tín hiệu và lifecycle với TTS; bỏ nút tiếp tục chặng thử nghiệm |
| PB-024/025 | Web Speech/Expo Speech và Journey dùng chung audio coordinator; Journey/gọi số ngắt dẫn đường rồi trả quyền |

Đã có tự phát/tắt tiếng/nghe lại, timeout/fallback, pause/resume, hủy callback
cũ và giữ vị trí khi đổi ngôn ngữ. Kiểm chứng cuối nằm trong mục
**Kiểm chứng local** của tài liệu bàn giao; không dùng kết quả phần chuẩn bị
để thay cho kiểm thử bản tích hợp.

Chưa đánh dấu Done: thiếu Android SDK platform 36 để build/chạy APK mới
trên AVD/thiết bị; reviewer/PR/merge của task và dependency chưa được xác minh.
Metro export và component tests không thay kiểm chứng âm thanh native thực tế.
