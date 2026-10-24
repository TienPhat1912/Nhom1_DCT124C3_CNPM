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
- Doctor: tra cứu khoa, chuyên khoa và phòng khám trong mục Khoa và bác sĩ; chỉ xem lượt khám giao cho tài khoản đó. Không hiển thị khung hồ sơ nhân viên ở đầu trang.
- Reception: chọn khoa → chuyên khoa/nhóm phòng → phòng khám → bác sĩ phù hợp. API kiểm tra quan hệ bác sĩ/phòng. Nhân viên xác nhận phân công thực tế vì nguồn là tháng 08/2025.
- Bệnh nhân web/Android: mục Khoa và bác sĩ tìm không dấu và lọc; hành trình/phiếu hiển thị khoa, bác sĩ phụ trách. Tái khám và hỗ trợ đọc cùng danh mục.
- Bản đồ: dùng chung mã khoa, lấy tên theo cấu hình admin, không tìm đường đến khoa ngừng hoạt động. Khu/tầng/tọa độ vẫn theo giới hạn bản đồ mẫu.

Hồ sơ Excel chưa có mật khẩu đăng nhập. Để cấp tài khoản, admin mở đúng hồ sơ,
xác minh nhân sự, đặt email và mật khẩu riêng. Không có mật khẩu mặc định.
Ba mục CN không được tạo thành tài khoản Doctor.

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

Browser test mở Vite 5189, dùng API giả lập, chạy desktop và viewport điện thoại.
API test tạo database HospitalAcceptance_<timestamp> trên SQL Docker, kiểm tra nhập
trên dữ liệu cũ, giữ cấu hình, không nhập trùng, quyền tiếp nhận, quan hệ phòng/bác sĩ,
CN, đăng nhập hồ sơ chưa cấp tài khoản, cấp tài khoản thử và thông tin trên phiếu.
Database kiểm thử được giữ riêng; tiến trình API kiểm thử tự dừng.
