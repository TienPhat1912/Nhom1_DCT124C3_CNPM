```markdown
# Hướng dẫn sử dụng GitHub cho Nhóm 01

Tài liệu này hướng dẫn quy trình làm việc trên repository [Nhom1_DCT124C3_CNPM](https://github.com/TienPhat1912/Nhom1_DCT124C3_CNPM): tạo Issue, tạo branch, commit/push code, mở Pull Request, review, merge và xử lý conflict.

## 1. Quy trình tổng thể của nhóm

Repository hiện có nhánh `main` và `dev`. Để tránh mỗi thành viên làm theo một quy trình khác nhau, đề xuất dùng luồng:

```text
Issue
  ↓
Tạo feature/fix/docs branch từ dev
  ↓
Code và commit trên branch riêng
  ↓
Push branch lên GitHub
  ↓
Pull Request: feature branch → dev
  ↓
Review + kiểm tra
  ↓
Merge vào dev
  ↓
Kiểm thử tích hợp
  ↓
Pull Request: dev → main
  ↓
Review lần cuối + merge bản ổn định
```

**Nguyên tắc quan trọng:** không làm tính năng trực tiếp trên `main` hoặc `dev`. Mỗi công việc nên có Issue, branch riêng và Pull Request. Nếu nhóm quyết định thay đổi nhánh tích hợp, hãy thống nhất trong nhóm và cập nhật lại tài liệu trước khi áp dụng.

## 2. Tạo Issue bằng các mẫu có sẵn

Trong ảnh thư mục `.github/ISSUE_TEMPLATE/` có ba file:

| File mẫu | Dùng khi nào? | Ví dụ tiêu đề |
| --- | --- | --- |
| `bug_report.md` | Báo lỗi có thể tái hiện | `[BUG] Không mở được lịch sử khám` |
| `feature_request.md` | Đề xuất chức năng hoặc cải tiến | `[FEATURE] Thêm bộ lọc lịch hẹn` |
| `task.md` | Giao và theo dõi một công việc cụ thể | `[TASK] Hoàn thiện giao diện đăng nhập` |

Đây là **mẫu biểu mẫu**, không phải file thành viên cần mở và sửa khi báo lỗi. Khi cấu hình đã có trên nhánh mặc định của repository, GitHub sẽ dùng phần metadata ở đầu file để hiển thị lựa chọn tương ứng.

### Tạo Issue trên giao diện GitHub

1. Mở trang repository và chọn tab **Issues**.
2. Chọn **New issue**.
3. Chọn mẫu phù hợp: **Báo lỗi**, **Đề xuất chức năng** hoặc **Công việc**.
4. Điền tiêu đề, mô tả, bước tái hiện/tiêu chí chấp nhận và kết quả mong đợi.
5. Gán người phụ trách nếu đã thống nhất; sau đó chọn **Submit new issue**.
6. Ghi lại số Issue, ví dụ `#24`, để liên kết vào branch và Pull Request.

Một Issue tốt cần đủ thông tin để thành viên khác hiểu công việc mà không phải đoán. Với bug, hãy ghi các bước tái hiện và kết quả thực tế. Với task/feature, hãy ghi đầu ra mong đợi và tiêu chí xem là hoàn thành.

## 3. Tạo branch cho công việc

Tên branch nên ngắn, viết thường và dùng dấu gạch ngang.

| Loại công việc | Quy ước | Ví dụ |
| --- | --- | --- |
| Tính năng | `feature/<ten-tinh-nang>` | `feature/patient-history` |
| Sửa lỗi | `fix/<ten-loi>` | `fix/login-validation` |
| Tài liệu | `docs/<ten-tai-lieu>` | `docs/github-guide` |
| CI/CD | `ci/<ten-cong-viec>` | `ci/web-checks` |
| Tái cấu trúc | `refactor/<pham-vi>` | `refactor/shared-components` |

### Cách A — Tạo branch trên website GitHub

1. Mở trang repository, nhấn bộ chọn nhánh ở khu vực đang hiển thị tên branch.
2. Chuyển sang nhánh nguồn `dev` trước.
3. Trong ô tìm kiếm branch, nhập tên mới, ví dụ `feature/patient-history`.
4. Chọn mục **Create branch: feature/patient-history from dev**.
5. Kiểm tra tên nhánh ở góc trang trước khi chỉnh sửa file.

Tên nhánh cần được tạo **từ `dev`** theo luồng đề xuất ở mục 1. Không tạo branch mới từ `main` chỉ vì `main` đang là nhánh được chọn mặc định.

### Cách B — Tạo branch bằng VS Code/Terminal

Chạy tại thư mục local của repository:

```bash
git status
git switch dev
git pull origin dev
git switch -c feature/patient-history
```

Thay `feature/patient-history` bằng tên công việc thật. Nếu `git status` cho thấy đang có thay đổi chưa commit, hãy lưu/commit hoặc xử lý chúng trước khi chuyển nhánh.

## 4. Commit và push code

Sau khi chỉnh sửa, kiểm tra file sẽ được đưa vào commit:

```bash
git status
git diff
git add .
git commit -m "feat: add patient history screen"
git push -u origin feature/patient-history
```

`git add .` sẽ đưa mọi thay đổi chưa được bỏ qua vào vùng chờ. Nếu dự án có file môi trường, log hoặc file không thuộc công việc hiện tại, hãy chọn file cụ thể thay vì dùng lệnh này một cách máy móc.

Dùng commit message mô tả rõ thay đổi:

- `feat: ...` — thêm tính năng.
- `fix: ...` — sửa lỗi.
- `docs: ...` — cập nhật tài liệu.
- `refactor: ...` — tái cấu trúc.
- `test: ...` — thêm hoặc sửa kiểm thử.
- `ci: ...` — cập nhật quy trình CI/CD.

Không commit file `.env`, token, khóa ký, mật khẩu thật, database chứa dữ liệu thật hoặc thông tin bệnh nhân.

## 5. Tạo Pull Request (PR)

Pull Request là đề nghị đưa thay đổi từ một branch vào branch khác. PR cho phép nhóm xem diff, trao đổi và review trước khi merge.

1. Push branch lên GitHub.
2. Mở repository. Nếu GitHub hiện gợi ý **Compare & pull request**, có thể nhấn vào; hoặc chọn tab **Pull requests → New pull request**.
3. Chọn đúng hai nhánh:
   - **base:** `dev` — nhánh sẽ nhận thay đổi.
   - **compare/head:** branch của bạn, ví dụ `feature/patient-history`.
4. Kiểm tra danh sách file/diff; bảo đảm không có thay đổi ngoài phạm vi.
5. Viết tiêu đề và mô tả: mục đích, thay đổi chính, cách kiểm tra.
6. Liên kết Issue, ví dụ `Closes #24`.
7. Tạo PR bằng **Create pull request**.
8. Chờ thành viên review; sửa theo góp ý bằng cách commit và push tiếp lên cùng branch. PR sẽ tự cập nhật.

**Lưu ý:** Với PR thông thường của thành viên, base nên là `dev`. Chỉ tạo PR `dev` → `main` khi nhóm muốn đưa bản đã tích hợp/kiểm thử sang nhánh ổn định.

## 6. Review và merge Pull Request

### Checklist trước khi merge

- [ ] PR đúng base branch.
- [ ] Nội dung diff chỉ gồm thay đổi thuộc Issue.
- [ ] Đã kiểm tra chức năng bị ảnh hưởng.
- [ ] Không có secret hoặc dữ liệu nhạy cảm.
- [ ] Nhận xét review đã được xử lý.
- [ ] Kiểm thử/build cần thiết đã thành công.
- [ ] Issue được liên kết hoặc cập nhật trạng thái.

### Thao tác merge trên GitHub

1. Mở tab **Pull requests** và chọn PR cần kiểm tra.
2. Đọc phần **Conversation**, xem các tệp trong **Files changed**.
3. Nếu cần sửa, ghi comment hoặc chọn **Request changes** khi dùng tính năng review; tác giả cập nhật branch rồi push lại.
4. Khi đạt yêu cầu, chọn nút merge và kiểu merge được hiển thị.
5. Xác nhận merge theo hộp thoại GitHub.
6. Sau khi merge, kiểm tra nhánh nhận thay đổi và cập nhật local.

### Ba kiểu merge phổ biến

| Kiểu | Cách hoạt động | Khi nên dùng |
| --- | --- | --- |
| **Create a merge commit** | Giữ các commit của branch và tạo thêm một merge commit. | Khi muốn thể hiện rõ điểm hợp nhất giữa các nhánh hoặc giữ lịch sử đầy đủ. |
| **Squash and merge** | Gộp tất cả commit trong PR thành một commit trên nhánh đích. | Phù hợp với PR tính năng nhỏ có nhiều commit sửa dần; lịch sử nhánh đích gọn hơn. |
| **Rebase and merge** | Đặt lại các commit của branch lên đầu nhánh đích, giữ lịch sử tuyến tính và không tạo merge commit. | Khi nhóm hiểu rõ rebase và thống nhất muốn lịch sử tuyến tính. |

GitHub chỉ hiện những kiểu merge được cho phép trong repository. Nếu một lựa chọn không xuất hiện thì không nhất thiết là lỗi. Không cần bật tất cả các kiểu; nhóm nên chọn quy ước thống nhất.

**Đề xuất cho đồ án:** dùng **Squash and merge** cho các PR tính năng đã review vào `dev` để lịch sử tích hợp gọn. Khi `dev` đã qua kiểm thử và chuẩn bị phát hành bản ổn định, mở PR `dev` → `main` và dùng **Create a merge commit** nếu nhóm muốn giữ mốc tích hợp/release riêng. Đây là quy ước đề xuất; nhóm có thể thống nhất cách khác.

Sau khi merge xong, xóa branch tính năng trên GitHub nếu GitHub cung cấp nút **Delete branch** và công việc đã hoàn tất. Không xóa `dev` hoặc `main`.

## 7. Cập nhật local sau khi merge

Sau khi PR đã merge vào `dev`:

```bash
git switch dev
git pull origin dev
git branch -d feature/patient-history
```

Lệnh cuối chỉ xóa branch local đã được merge an toàn. Nếu Git báo branch chưa được merge, **không dùng ép xóa ngay**; hãy kiểm tra trạng thái và bảo đảm thay đổi không bị mất.

Để chuyển sang công việc mới, tạo branch mới từ bản `dev` đã cập nhật:

```bash
git switch -c fix/another-task
```

## 8. Xử lý merge conflict

Conflict xảy ra khi Git không tự kết hợp được các thay đổi, thường do nhiều branch chỉnh cùng dòng hoặc cùng vùng của một file.

Cách xử lý an toàn:

1. Đọc thông báo Git và danh sách file bị conflict.
2. Đồng bộ branch tích hợp theo hướng dẫn nhóm. Với branch công việc, có thể merge `dev` mới nhất vào branch hiện tại:
   
   ```bash
   git switch feature/patient-history
   git fetch origin
   git merge origin/dev
   ```

3. Mở các file được báo conflict trong VS Code. Xem các phần **Current Change**, **Incoming Change** và quyết định nội dung cuối cùng; không chấp nhận một phía một cách máy móc.
4. Xóa các dấu phân cách conflict sau khi đã hợp nhất nội dung.
5. Kiểm tra lại file, chạy test/build liên quan, rồi:

   ```bash
   git add <file-da-giai-quyet>
   git commit -m "fix: resolve merge conflict"
   git push
   ```

6. Kiểm tra PR trên GitHub đã hết conflict và CI/checks đã đạt trước khi merge.

Nếu không chắc phần thay đổi nào đúng, hãy trao đổi với tác giả của thay đổi đó trước khi giải quyết.

## 9. Quy trình từ đầu đến cuối — ví dụ

Giả sử nhóm giao công việc “Thêm lịch sử khám bệnh nhân” và đã tạo Issue `#24`:

```text
1. Issues → New issue → chọn Công việc
2. Đặt tiêu đề: [TASK] Thêm lịch sử khám bệnh nhân
3. Tạo branch feature/patient-history từ dev
4. Code → git add/commit → git push
5. Pull requests → New pull request
6. base = dev; compare = feature/patient-history
7. Mô tả PR và thêm "Closes #24"
8. Review → chỉnh sửa nếu cần → Squash and merge
9. Cập nhật local từ dev và xóa branch local đã merge
10. Sau khi tích hợp/kiểm thử đủ, mở PR dev → main
```

## 10. Tài liệu liên quan

- [Quy ước đóng góp](../CONTRIBUTING.md)
- [Hướng dẫn sử dụng hệ thống Web/Mobile](huong-dan-su-dung.md)
- [Kế hoạch và TODO của nhóm](team-planning/README.md)
- [Trang chủ repository](../README.md)

```