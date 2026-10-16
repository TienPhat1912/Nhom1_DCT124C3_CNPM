```markdown
# Quy ước đóng góp

Tài liệu này thống nhất cách làm việc trên repository của Nhóm 01 để lịch sử thay đổi dễ đọc, review và truy vết.

## 1. Tạo Issue trước khi làm

Tạo Issue cho chức năng, lỗi hoặc công việc tài liệu. Mỗi Issue nên có mục tiêu, kết quả mong đợi và tiêu chí hoàn thành. Gán người phụ trách khi nhóm đã thống nhất.

## 2. Quy ước branch

Tạo branch từ `main`; không phát triển trực tiếp trên `main`.

| Loại thay đổi | Quy ước | Ví dụ |
| --- | --- | --- |
| Chức năng | `feature/<short-name>` | `feature/patient-history` |
| Sửa lỗi | `fix/<short-name>` | `fix/mobile-navigation` |
| Tài liệu | `docs/<short-name>` | `docs/api-setup-guide` |
| CI/CD | `ci/<short-name>` | `ci/web-checks` |
| Tái cấu trúc | `refactor/<short-name>` | `refactor/shared-components` |

Dùng tên ngắn, chữ thường, phân cách bằng dấu gạch ngang.

## 3. Quy ước commit

Ưu tiên Conventional Commits:

```text
feat: add patient history screen
fix: handle empty appointment result
docs: clarify local setup steps
refactor: extract reusable form field
test: add navigation tests
ci: validate web build on pull request
```

Mỗi commit nên đại diện cho một thay đổi có ý nghĩa. Tránh message không mô tả nội dung như `update`, `test`, `final2` hoặc `fix`.

## 4. Pull Request

- PR cần có tiêu đề mô tả hành động, phạm vi rõ ràng.
- Tóm tắt nội dung và cách kiểm tra thay đổi.
- Liên kết Issue bằng `Closes #<number>` khi phù hợp.
- Không đưa mật khẩu, token, file `.env` hoặc dữ liệu thật vào commit.
- Kiểm tra diff để tránh đưa file build, log hay thay đổi ngoài phạm vi.
- Yêu cầu ít nhất một thành viên review trước khi merge nếu lịch làm việc cho phép.

## 5. Checklist trước khi hoàn tất

- [ ] Thay đổi đáp ứng nội dung Issue.
- [ ] Đã tự kiểm tra phần bị ảnh hưởng.
- [ ] Không commit thông tin bí mật hoặc dữ liệu nhạy cảm.
- [ ] README/tài liệu được cập nhật nếu cách cài đặt hay hành vi thay đổi.
- [ ] PR có mô tả, cách kiểm thử và Issue liên quan.
- [ ] Các nhận xét review đã được xử lý hoặc phản hồi rõ ràng.

## 6. Quy tắc an toàn

Chỉ sử dụng dữ liệu demo. Không đưa thông tin bệnh nhân, thông tin xác thực thật, khóa ký hoặc bí mật môi trường lên GitHub. Nếu phát hiện bí mật đã được commit, cần thu hồi/thay khóa tương ứng; chỉ xóa khỏi commit mới là chưa đủ.
```