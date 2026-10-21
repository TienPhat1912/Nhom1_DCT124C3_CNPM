# File lưu trữ cục bộ

Thư mục này gom các file không cần để clone, build hoặc chạy demo:

- `artifacts/`: APK, bundle, ảnh chụp, kết quả build và kiểm thử trước khi dọn.
- `docs/evidence/`, `docs/reports/`: bằng chứng và nhật ký bàn giao của các lần chạy cũ.
- `local/`: bộ cài Android đã tải, log build và báo cáo audit cũ.

Xem [danh mục di chuyển](MANIFEST.md) để tìm vị trí cũ/mới. Các file được giữ nguyên nội dung, không xóa. Khi cần, sao chép file cần dùng về vị trí cũ; kiểm thử Android cần APK tại `artifacts/android/an-tam-demo.apk`.

Git chỉ theo dõi hai file `README.md` và `MANIFEST.md` của thư mục này. Một bản clone mới không có nội dung lưu trữ; build và kiểm thử sẽ tạo kết quả mới trong `artifacts/`. APK chia sẻ cho nhóm có thể đưa lên GitHub Releases hoặc tải từ Actions thay vì commit vào source.

`.env`, `.local/` đang sử dụng (SDK, giả lập, key, thông tin truy cập), `node_modules/`, `bin/`, `obj/` vẫn ở vị trí mà công cụ cần và được Git bỏ qua. Đây là dữ liệu cấu hình/phụ thuộc có thể sinh lại, không phải mã nguồn cần push.
