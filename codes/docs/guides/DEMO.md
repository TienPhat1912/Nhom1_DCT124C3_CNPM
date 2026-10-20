# Kịch bản demo

Dùng cửa sổ riêng/incognito cho bệnh nhân và từng nhân viên. Mật khẩu tại `.local/demo-access.txt`; dữ liệu nhập trong demo nên là dữ liệu tổng hợp.

## Không hẹn trước, dịch vụ và nhà thuốc

1. Bệnh nhân mở `/entry` hoặc trang chủ, chọn VI/EN, tiếp tục khách. Vào Chuẩn bị tiếp nhận → Chưa có lịch hẹn, nhập tên/liên hệ/khoa và gửi. Có request + QR tiếp nhận, chưa có Visit.
2. Tiếp nhận đăng nhập, quét/dán QR hoặc chọn request. Gửi mẫu yêu cầu bổ sung. Bệnh nhân sửa/gửi lại; mã request giữ nguyên.
3. Tiếp nhận chọn khoa/phòng/bác sĩ, xác nhận đã kiểm tra người đến khám và ghi nhận xác minh; Xác nhận tiếp nhận & cấp phiếu. Nhấn lại/in lại vẫn là cùng Visit/Journey/phiếu.
4. Bệnh nhân mở phiếu, Mở hành trình hoặc quét QR phiếu. Hành trình hiện bước khám, điểm đến, số hàng đợi, Nghe/Chỉ đường/Hỗ trợ. Chọn vị trí bắt đầu khi xem chỉ đường; thiếu tuyến vẫn có tầng/phòng.
5. Bác sĩ chọn đúng Visit, thêm chỉ định xét nghiệm/chẩn đoán hình ảnh; bật yêu cầu hướng dẫn nhà thuốc. Lưu nháp chẩn đoán/hướng dẫn: bệnh nhân chưa thấy. Rà soát rồi công bố: bệnh nhân thấy ngay cả khi chưa quyết toán. Có thể thêm bản dịch được duyệt và khuyến nghị tái khám riêng.
6. Bác sĩ xác nhận hoàn tất khám đầu. Dịch vụ đăng nhập, cập nhật số/trạng thái hàng đợi, bắt đầu/hoàn tất bước; quay lại khám chỉ sẵn sàng khi tất cả dịch vụ bắt buộc đã giải quyết.
7. Bác sĩ xác nhận khám lại. Thu ngân chọn Quyết toán cuối cùng hoặc Không cần thanh toán và ghi nhận. Visit đóng; Journey tiếp tục nhà thuốc.
8. Bệnh nhân chọn Hoàn thành hành trình tại hướng dẫn nhà thuốc. Đây không là xác nhận cấp phát thuốc. Sau đó có lời mời liên kết tài khoản hoặc Để sau. Đăng ký/liên kết đúng giữ nguyên mã Visit/Journey và trả về hồ sơ đó.
9. Bác sĩ công bố bản sửa mới sau đóng Visit. Bệnh nhân xem bản hiện hành, nguồn gốc, thời gian và nghe riêng chẩn đoán/hướng dẫn. Bản dịch cũ không tự áp sang nguồn mới.

## Có lịch hẹn

Tài khoản bệnh nhân mới → Liên kết hệ thống bệnh viện. Fixture `DEMO-001`, bằng chứng `SIM-VERIFY-DEMO-001` trả booking `BOOK-001`. Chọn chuẩn bị lịch hẹn tạo QR, chưa tạo Visit. Tiếp nhận xác minh và cấp phiếu rồi thực hiện các bước trên.

Fixture `DEMO-002`/`SIM-VERIFY-DEMO-002` không có booking, dùng nhánh walk-in. Mỗi external identity chỉ liên kết một Patient trong một database; muốn demo lại fixture đã dùng, dùng chính tài khoản đó hoặc database mới. Guest có booking thì tiếp nhận kiểm tra mã `BOOK-001` từ request sau xác minh trực tiếp. Booking fixture dùng mốc thời gian cố định 2026-10-16 để tái lập; đây không phải lịch hẹn bệnh viện thật.

## Dashboard quản trị

Đăng nhập `admin@demo.local` tại trang chủ. Tab **Tổng quan** mở mặc định, hiển thị số lượt khám hôm nay, lượt khám đang xử lý, yêu cầu chờ tiếp nhận và hỗ trợ chưa giải quyết. Số liệu lấy từ database và tự cập nhật mỗi 5 giây.

Chọn **7 ngày gần nhất** hoặc **30 ngày gần nhất** trên biểu đồ; bấm một ngày để xem số lượt tiếp nhận/đóng. Các ngày dùng giờ Việt Nam UTC+7. Bảng **Tình hình các khoa** có ô tìm kiếm theo tên, bao gồm tìm không dấu. **Quản lý nhanh** mở các tab khoa, nhân viên, dịch vụ; thông báo dịch vụ chưa có quy trình được duyệt dẫn đến tab quy trình. Các tab cấu hình và **QR truy cập công khai bệnh viện** vẫn có sẵn. Đổi VI/EN để kiểm tra nhãn và số liệu; tắt mạng rồi tải lại để xem thông báo dữ liệu cũ.

## Các nhánh và quản trị

- Không yêu cầu nhà thuốc: khi đủ chuyên môn + quyết toán hợp lệ, Journey tự hoàn thành.
- Ghi Intermediate khi còn công việc: Visit vẫn Active. Quyết toán sớm được giữ lại nhưng thêm/sửa/hủy công việc làm mất hiệu lực revision cũ.
- Quản trị cấu hình dịch vụ + mapping đã duyệt (tối đa 12 node, chỉ phụ thuộc node trước); thiếu mapping không tạo chỉ định. Địa điểm/mẫu lịch sử được giữ bằng tham chiếu/snapshot, không xóa cascade.
- Yêu cầu hỗ trợ có Open → Acknowledged → Resolved hoặc chuyển khoa. Reception/Service chỉ xử lý phạm vi được cấp.
- QR cũ sau reissue bị từ chối. Mất guest session: tiếp nhận xác minh rồi cấp recovery code một lần, thời hạn 10 phút; nhập tại trang đăng nhập. Không dùng mã Visit làm bằng chứng sở hữu.
- Dùng `otherdoctor@demo.local` hoặc tài khoản bệnh nhân khác để chứng minh bị từ chối đọc hồ sơ. Quản trị không công bố chẩn đoán thay bác sĩ.
- Tắt mạng trình duyệt ở bước nhà thuốc: giữ văn bản và báo dữ liệu có thể cũ; nhấn hoàn thành không báo thành công cho đến khi máy chủ xác nhận.

## Nguồn mô phỏng

`Providers:Mode=Simulation`, `Demo:Enabled=true`. Identity/appointments/operational/settlement adapters có cùng hợp đồng typed và failure code. TTS backend trả manifest đã kiểm tra quyền/version, client dùng Web Speech/Expo Speech của thiết bị. Không gọi dịch vụ sinh chẩn đoán, dịch y khoa tự động, tính viện phí, cổng thanh toán hay cấp phát thuốc.
