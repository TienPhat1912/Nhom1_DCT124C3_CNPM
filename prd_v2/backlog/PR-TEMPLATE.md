# Mẫu nội dung PR cho một task

Sao chép phần bên dưới vào PR, thay chỗ trống bằng nội dung cụ thể. Tiêu đề: `[PB-xxx] Kết quả thay đổi`.

---

Task: PB-xxx — tên task  
Issue: link nếu nhóm dùng Issues  
Card: đường dẫn đến file task trong repository  
Phụ thuộc: các PR cần merge trước, hoặc Không

## Thay đổi

Mô tả vấn đề và hành vi mới trong 2–4 câu. Nêu một ví dụ trước/sau nếu thay quy tắc nghiệp vụ.

## Phạm vi

- API/schema/UI nào thay đổi.
- Có thay hợp đồng dùng chung hoặc file dễ conflict không.
- Có migration/cấu hình mới không; nếu có, ghi cách áp dụng và khôi phục.

## Tiêu chí chấp nhận

Dán checklist của task và đánh dấu đúng phần đã hoàn thành. Không tự đánh dấu tiêu chí chưa kiểm chứng.

## Kiểm chứng

| Lệnh hoặc kịch bản | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| Điền lệnh thực chạy | Pass/Fail/Chưa chạy | Môi trường, log CI hoặc mô tả kết quả |

Nếu thay giao diện: thêm ảnh hoặc video ngắn, nêu web/mobile và ngôn ngữ đã kiểm tra. Không đưa dữ liệu bệnh nhân thật, token hoặc mật khẩu vào ảnh/log.

## Lưu ý khi merge

Ghi thứ tự migration/dependency hoặc cách bật chức năng nếu cần. Nếu không có, ghi “Không có yêu cầu đặc biệt”.

## Checklist

- [ ] Đúng phạm vi task; các dependency cần thiết đã merge.
- [ ] Đạt tiêu chí chấp nhận và test liên quan.
- [ ] Quyền/validation/chống lệnh trùng được kiểm tra khi có thay nghiệp vụ.
- [ ] Không commit secrets, artifact sinh tự động hoặc file của người khác.
- [ ] Đã ghi rõ hạn chế, việc chưa kiểm chứng và hướng xử lý.
- [ ] Task vẫn In review; chỉ chuyển Done sau khi PR được merge.

