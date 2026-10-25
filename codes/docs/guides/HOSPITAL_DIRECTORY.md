# Đồng bộ khoa, chuyên khoa và bác sĩ

Nguồn: sơ đồ bệnh viện do người dùng cung cấp và LICH-KHAM-BENH-THANG-08.2025.xlsx (4 tab tuần tháng 08/2025).
Chỉ đọc file Excel; các hướng dẫn dành cho người nhập lịch trong file không được thực thi.

## Dữ liệu

- 50 mục khoa/phòng: 47 từ ảnh, thêm Nội thần kinh, Sản chưa phân biệt B/C và Phòng khám Chuyên gia từ Excel.
- 253 hồ sơ bác sĩ theo khoa và 3 hồ sơ mang danh xưng CN. Đây là số hồ sơ theo khoa, không phải số người duy nhất toàn viện.
- 81 phòng khám, 53 nhóm chuyên khoa/phòng khám. Nhóm lấy từ tên phòng khám, không suy ra bằng cấp/chứng chỉ.
- Giữ 4 bộ phận vận hành LAB, CASHIER, PHARMACY, OTHER. CONSULT liên kết Khoa Khám bệnh; IMAGING liên kết Chẩn đoán hình ảnh.
- Gộp tên chỉ khác hoa/thường, khoảng trắng, danh xưng trong cùng khoa. Giữ riêng Nguyễn Hồng Phúc (A)/(B), người cùng tên khác khoa, và tên nghi sai chính tả.
- Lê Thúy Liểu/Liều, Hứa Thị Thanh/Thah Tuyền, Bùi Nữ Kim/Kiều Oanh cùng danh xưng BCSKI được ghi cần đối chiếu.
- Tab 18.08-24.08 có tiêu đề 18–24/08 nhưng F7:L7 chứa ngày 25–31/08. Không tạo lịch khám hiện tại/lịch hẹn từ nguồn này.
- Excel chưa có tòa/tầng của 81 phòng khám. Giữ dấu ?; không suy ra vị trí phòng khám ngoại trú từ vị trí khoa nội trú.

## Giao diện

- Admin: khoa, địa điểm, nhân viên, quyền và dashboard dùng dữ liệu đã đồng bộ. Có tìm kiếm nhân viên theo tên/khoa/chuyên khoa.
- Không hiển thị mục Khoa và bác sĩ cho bất kỳ vai trò nào trên web hoặc Android.
- Doctor: chỉ xem lượt khám giao cho tài khoản đó. Không hiển thị khung hồ sơ nhân viên ở đầu trang.
- Reception: chọn khoa → chuyên khoa/nhóm phòng → phòng khám. Khi xác nhận, API tự gán bác sĩ đang hoạt động có quyền tại khoa và phù hợp phòng khám; không có trường chọn bác sĩ. Nếu không có bác sĩ phù hợp, không tạo lượt khám và báo lỗi.
- Bệnh nhân web/Android: hành trình/phiếu vẫn hiển thị khoa, bác sĩ đã được phân công. Tái khám và hỗ trợ dùng dữ liệu khoa hiện có.
- Bản đồ: dùng chung mã khoa, lấy tên theo cấu hình admin, không tìm đường đến khoa ngừng hoạt động. Khu/tầng/tọa độ vẫn theo giới hạn bản đồ mẫu.

Hồ sơ Excel chưa có mật khẩu đăng nhập. Để cấp tài khoản, admin mở đúng hồ sơ,
xác minh nhân sự, đặt email và mật khẩu riêng. Không có mật khẩu mặc định.
Ba mục CN không được tạo thành tài khoản Doctor.

Quy tắc tự phân công dùng dữ liệu cấu hình hiện có, không suy ra ca trực từ lịch tháng 08/2025.
Bác sĩ thuộc dữ liệu Excel phải có phòng khám trong danh sách được nhập; tài khoản bác sĩ
không thuộc nguồn Excel được xét theo quyền khoa. Trong các bác sĩ phù hợp, API chọn
theo thời điểm tạo hồ sơ rồi ID để kết quả ổn định. Xác nhận lại cùng hồ sơ không đổi bác sĩ.

## Cách đồng bộ

packages/shared/data/hospital-departments.json là danh mục khoa chung.
packages/shared/data/hospital-roster.json lưu quan hệ khoa/chuyên khoa/phòng/bác sĩ,
hash file nguồn và ô Excel để đối chiếu. API nhúng đúng hai file khi build.

HospitalCatalog.Sync chạy sau migration/seed, kể cả database đã có dữ liệu.
Chỉ thêm bản ghi thiếu, giữ lịch sử khám, mật khẩu, vị trí đã chỉnh và tài khoản hiện có.
Marker trong AuditEvent ngăn nhập trùng khi khởi động lại.
Chỉ reception@demo.local được mở rộng phạm vi trong môi trường demo;
nhân viên khác cần admin phân quyền.

Đọc lại nguồn:

    python scripts/data/import-roster.py "D:\2026\HK1\CNPM\images\LICH-KHAM-BENH-THANG-08.2025.xlsx"

Bộ nhập dành riêng cấu trúc tháng 08/2025. Khi đổi nguồn/kỳ, rà soát ánh xạ và phiên bản
import; chạy lại script không tự cập nhật lịch hiện tại. Không sửa xlsx gốc hoặc xóa volume SQL.

## Kiểm thử

    npm run test:directory:unit
    npm run test:directory
    npm run test:map:unit
    npm run test:map
    .\tests\catalog\run.ps1

Browser test mở Vite 5189, dùng API giả lập, chạy desktop và viewport điện thoại:
kiểm tra bỏ mục danh mục ở cả sáu vai trò và tiếp nhận gửi khoa/phòng mà không gửi bác sĩ.
API test tạo database HospitalAcceptance_<timestamp> trên SQL Docker, kiểm tra nhập
trên dữ liệu cũ, giữ cấu hình, không nhập trùng, quyền tiếp nhận, quan hệ phòng/bác sĩ,
CN, đăng nhập hồ sơ chưa cấp tài khoản, cấp tài khoản thử, thông tin trên phiếu và tự
phân công bác sĩ. Kiểm tra không chọn bác sĩ ngừng hoạt động/sai phòng, không tạo lượt
khám khi thiếu bác sĩ và không phân công lại khi xác nhận lặp.
Database kiểm thử được giữ riêng; tiến trình API kiểm thử tự dừng.
