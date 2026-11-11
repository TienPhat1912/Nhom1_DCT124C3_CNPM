# Kế hoạch chỉnh sửa theo PRD mới

Ngày cập nhật: 11/11/2026. Phiên bản kế hoạch: 2. Trạng thái: đã cập nhật các quyết định nghiệp vụ của người dùng, sẵn sàng làm căn cứ triển khai; chưa sửa mã nguồn hoặc chạy migration.

Nguồn ưu tiên: các quyết định người dùng chốt trong cuộc trao đổi → PRD mới → sơ đồ đi kèm → tài liệu/mã nguồn cũ để đối chiếu. PRD và sơ đồ đang được trợ lý khác viết lại; không cần đợi hoàn thiện trình bày để chuẩn bị triển khai. Khi nhận bản mới, kiểm tra chênh lệch trước khi cập nhật truy vết; không tự thay đổi quyết định đã chốt theo một sơ đồ còn cũ.

Mục tiêu là đưa ứng dụng An Tâm hiện có về luồng tiếp nhận và khám đơn giản hơn của PRD mới, đồng thời bổ sung quản lý phòng khám, chẩn đoán từ danh mục, dịch mô tả của bệnh nhân và thống kê trực tuyến. Giữ kiến trúc React web, Expo mobile, ASP.NET Core và SQL Server; tái sử dụng xác thực, quyền truy cập, giao dịch, chống thao tác trùng, bản đồ và TTS hiện có.

**Thứ tự triển khai:** hợp đồng dữ liệu và khảo sát chuyển đổi → dữ liệu/phòng/bác sĩ → bỏ liên kết Guest và sửa tiếp nhận → khám/dịch vụ tuần tự → chẩn đoán/quyết toán → dịch và hỗ trợ → thuyết minh/Dashboard → nghiệm thu và phát hành. Migration được thiết kế, thử trên bản sao ngay từ gói dữ liệu; không để tới cuối mới kiểm tra dữ liệu cũ. Mỗi phần nghiệp vụ phải hoàn thành cả API, giao diện liên quan và kiểm thử trước khi chuyển sang phần tiếp theo. Checklist thực thi nằm ở mục 9.

## 1. Tài liệu đã đối chiếu

- Nguồn yêu cầu mới: [prd moi.docx](../../../docs/prd/prd%20moi.docx), đặc biệt Chương 2 và 19 đặc tả UC ở Chương 4.
- ERD ý niệm và logic: [erd muc 1.png](../../../docs/prd/png/erd%20muc%201.png), [erd muc 2.png](../../../docs/prd/png/erd%20muc%202.png).
- Đã đọc các nút, swimlane, điều kiện và cạnh nối của đủ AD-01 đến AD-19 trong [Activity_Diagrams](../../../docs/prd/Activity_Diagrams). PNG/SVG/Draw.io là các định dạng của cùng bộ sơ đồ, không phải các yêu cầu độc lập.
- Đối chiếu bộ sơ đồ cũ trong [Hospital_Visit_Guidance_Diagrams.drawio](../../../docs/diagrams/system/Hospital_Visit_Guidance_Diagrams.drawio) và [Hospital_Use_Cases_6_Diagrams.drawio](../../../docs/diagrams/use-cases/Hospital_Use_Cases_6_Diagrams.drawio).
- Đối chiếu PRD cũ trong [PRD-extracted.txt](PRD-extracted.txt), bảng truy vết và mã nguồn backend, shared, web, mobile cùng danh mục kiểm thử hiện tại.

Khi sơ đồ có nhánh chưa khớp mô tả, áp dụng quyết định đã chốt tại mục 7 và các quy tắc PRD không bị thay thế. Bộ đã đọc có 19 UC; phạm vi đích còn 18 UC sau khi bỏ liên kết Guest (UC-14 cũ). Mã UC trong kế hoạch giữ theo bản đã đọc để truy vết, sẽ ánh xạ lại theo tên nếu bản viết lại đánh số khác.

## 2. Những thay đổi so với ứng dụng hiện tại

| Nhóm | Hiện trạng đã đọc trong mã | Thay đổi cần triển khai | Căn cứ mới |
|---|---|---|---|
| Tiếp nhận | Account chưa bị chặn đầy đủ yêu cầu chờ/Visit hoạt động; Guest bị chặn theo phiên với mọi yêu cầu chưa Withdrawn | Kiểm tra theo Patient: tối đa một yêu cầu chờ và một Visit hoạt động; khi trùng trả về hồ sơ hiện có | FR-RCP-01, FR-VISIT-01/08, AD-02 |
| Kích hoạt Journey | Xác nhận tạo `PendingActivation`; `/tickets/redeem` chuyển Active | Tạo Visit, phiếu và Journey Active trong cùng giao dịch xác nhận; mở Journey ngay | FR-RCP-04, FR-JRN-01, AD-03 |
| Phòng và bác sĩ | Chọn bác sĩ bằng thứ tự tạo/ID và phạm vi khoa; liên kết phòng dựa một phần vào roster tĩnh; `Visit.DoctorId` được gán ngay | Phân công theo database; giữ phòng/bác sĩ của Visit; một bệnh nhân Đang khám/phòng; không chuyển bác sĩ giữa lượt khám | Quyết định 1/2, FR-VISIT-04/09, FR-ADM-07 |
| Trạng thái khám | Chủ yếu dựa `JourneyStep.Status` và `QueueStatus`; chưa có trạng thái khám riêng | Bốn trạng thái: Chờ khám / Đang khám / Đang thực hiện dịch vụ / Hoàn tất; dịch vụ xong tự trở lại hàng chờ phòng cũ | Quyết định 3, thay nội dung FR-VISIT-03/05/10 |
| Chỉ định | Có API và UI Update/Cancel; tiến độ có Skipped; bước quay lại phụ thuộc `ReturnRequired` | Một dịch vụ mỗi lần; tối đa một chỉ định chưa hoàn tất/Visit; xác nhận bất biến; làm xong phải khám lại trước khi chỉ định tiếp | Quyết định 4, FR-VISIT-11/12, BR-22 |
| Phiếu khám | Số hiện tại là mã H- ghép một phần UUID | Số tăng riêng theo phòng/ngày, giữ nguyên khi in lại/quay lại sau dịch vụ, gọi kèm phòng | Quyết định 5, FR-RCP-04/05 |
| Guest | Có link-claim/convert và UI liên kết tài khoản | Bỏ liên kết/chuyển đổi Guest; Account và Guest độc lập; giữ khôi phục Guest đã xác minh | Quyết định 6; loại UC-14 cũ |
| Kết quả khám | Nhập tự do Diagnosis/Explanation/Instructions; publish độc lập với hoàn tất khám | Chọn triệu chứng/dấu hiệu/chẩn đoán từ danh mục; tạo mẫu tiếng Việt; xác nhận đồng thời kết thúc khám và công bố kết quả | FR-DOC-01..05, AD-10 |
| Quyết toán | Có thể ghi nhận quyết toán cuối sớm; workflow đóng sau khi đủ bước; nhà thuốc có thể giữ Journey chưa hoàn tất | Chỉ cho quyết toán cuối khi khám và dịch vụ hoàn tất; đóng Visit và Journey cùng giao dịch | FR-VISIT-06/07, BR-11/12, AD-12 |
| Dịch mô tả | Bộ dịch chỉ nhận nguồn tiếng Việt; response filter chủ ý bỏ qua nội dung bệnh nhân nhập | Lưu bản gốc/ngôn ngữ nguồn; dịch sang Việt chỉ khi tiếp nhận mở chi tiết yêu cầu tiếp nhận hoặc hỗ trợ | FR-REG-03/04, FR-AST-04, BR-18/19 |
| Hỗ trợ | Reception và Service đều xử lý; danh sách trả toàn bộ mô tả; chưa có endpoint chi tiết riêng | Reception chịu trách nhiệm; thêm màn hình/API chi tiết có bản gốc + bản dịch; vẫn gửi được khi chưa có Journey | FR-AST-01..04, AD-16/17 |
| Thuyết minh | Journey và bản đồ chủ yếu có nút phát thủ công; polling nghiệp vụ 5 giây | Tự phát mặc định khi thiết bị cho phép, bật/tắt/nghe lại; gọi số theo sự kiện; mục tiêu thông báo ≤3 giây | FR-NAR, NFR-PERF-02, AD-05/07 |
| Dashboard | Có thống kê Visit/yêu cầu/dịch vụ; chưa có tín hiệu hiện diện | Thêm heartbeat, thời hạn hiện diện và đếm Account/Guest thực sự đang dùng; tránh đếm trùng tài khoản | FR-ADM-05, BR-24, AD-19 |
| Ngôn ngữ | Web/mobile/bộ dịch hỗ trợ vi/en/zh/ko/ja/ru; `/api/entry` còn trả vi/en | Đồng bộ danh sách cho Entry/Auth/UI/API/TTS; đề xuất giao diện mới dùng bốn ngôn ngữ vi/en/zh/ja theo UC-01 | NFR-LOC-01, UC-01, AD-01 |
| Chỉ đường | Có đồ thị tuyến, điểm xuất phát chọn thủ công và thuyết minh tuyến; chưa RTLS | Giữ bản đồ khả dụng, đích theo Journey; cải tiến tự phát sau khi có tuyến; ghi rõ RTLS là kiến trúc mục tiêu | Mục 1.1, 2.5, UC-06, AD-06 |

Hiện chưa có mô hình nhập/lưu kết quả xét nghiệm hoặc ảnh chụp trong các module đã kiểm tra. Yêu cầu “không lưu kết quả dịch vụ” chủ yếu là ranh giới cần giữ, không phải một phân hệ lớn cần xóa.

### Những phần đề xuất rút khỏi luồng chính

- **Đã chốt loại bỏ:** liên kết Guest với tài khoản, gộp lịch sử và chuyển Guest thành tài khoản. Bỏ API/UI thực hiện liên kết; giữ chức năng đăng ký độc lập, đăng nhập, Guest, khôi phục Guest và lịch sử được phép xem. Không tách ngược những dữ liệu đã liên kết trước đây.
- Chuẩn bị tiếp nhận bằng lịch hẹn/định danh ngoài, tra cứu booking và booking handoff: không còn UC tương ứng trong bản mới. Giữ khuyến nghị tái khám, lần quay lại vẫn tạo Visit mới sau tiếp nhận.
- QR tiếp nhận, quét QR phiếu để kích hoạt và nút Kích hoạt Journey: thay bằng danh sách yêu cầu và Journey tự hoạt động. Giữ QR Entry và cơ chế xác minh/khôi phục Guest; link cũ có thể mở hồ sơ được phép mà không thay đổi trạng thái.
- Trao đổi bổ sung theo mẫu với nhiều trường nhập tự do: form mới gồm liên hệ, khoa mong muốn không bắt buộc và một mô tả tình trạng; hỗ trợ có một mô tả vấn đề. Giữ được nội dung lịch sử đã lưu.
- Sửa/hủy chỉ định đã xác nhận, bỏ qua dịch vụ, chỉnh trạng thái gọi số thủ công nhiều bước: thay bằng thao tác nghiệp vụ có điều kiện rõ ràng.
- Nhà thuốc là bước bệnh nhân tự xác nhận sau khi đóng Visit: không đưa vào Journey mới vì BR-12 yêu cầu Journey hoàn tất khi Visit kết thúc. Địa điểm nhà thuốc vẫn có thể tồn tại trong danh mục/bản đồ.
- UI soạn/công bố nhiều phiên bản kết quả tự do: thay bằng chọn danh mục → xem trước → xác nhận hoàn tất khám. Lưu lịch sử cũ và metadata tác giả/thời điểm; không xóa hàng loạt `SummaryVersion`.

Đây là đề xuất thu gọn với các phần không còn được đặc tả, không suy ra rằng PRD bắt buộc xóa mọi bảng/API cũ. Thanh toán dịch vụ riêng lẻ vẫn không được đóng Visit (FR-VISIT-07); chưa cần mở rộng một phân hệ thu tiền mới.

## 3. Những điểm cần đồng bộ trong sơ đồ

| Sơ đồ | Quan sát từ nút và cạnh nối | Cách sửa khi đồng bộ tài liệu |
|---|---|---|
| AD-01, AD-02, AD-03 | Phù hợp các nhánh truy cập, chặn trùng và kích hoạt Journey mới | Giữ làm nền cho kiểm thử tiếp nhận; thêm kiểm tra quyền/chống trùng ở API theo precondition |
| AD-04 | Nhánh chờ kết thúc một lượt xem; sơ đồ chưa biểu diễn vòng cập nhật liên tục | Ghi rõ đây là một lần đánh giá trạng thái hoặc nối vòng chờ sự kiện; không kết thúc Journey khi còn việc |
| AD-05 | Tắt tự phát dẫn đến final; có thể bị hiểu là không thể nghe lại/đổi ngôn ngữ | Giữ điều khiển nghe lại và đổi ngôn ngữ khả dụng khi tắt tự phát; mô tả các sự kiện độc lập |
| AD-06 | Đổi đích, lệch tuyến và chưa đến đích đều đi tới activity final | Nối về tính tuyến/theo dõi vị trí; chỉ kết thúc phiên khi đến đích hoặc người dùng dừng. Ghi RTLS là mục tiêu |
| AD-07 | Chưa có điều kiện chỉ một bệnh nhân Đang khám/phòng | Chỉ tiếp nhận khi phòng rảnh và bệnh nhân Chờ khám; dịch vụ hoàn tất tự đưa về danh sách chờ, không thêm bước check-in |
| AD-08 | Chỉ định chuyển về Chờ khám theo bản trước | Chọn đúng một dịch vụ, xác nhận rồi chuyển Đang thực hiện dịch vụ và nhả ca; không cho thêm/sửa/hủy chỉ định lúc này |
| AD-09 | Hoàn tất một dịch vụ dẫn về phòng khám | Giữ đường về phòng cũ; chuyển Chờ khám và đưa ngay vào hàng chờ bác sĩ cũ trong cùng giao dịch; không tự tiếp nhận vào khám |
| AD-10 | Nhánh sửa lựa chọn kết thúc ngay sau tạo lại mẫu | Nối lại bước bác sĩ kiểm tra; nhánh hủy vẫn được kết thúc mà không công bố |
| AD-11 | Lưu khuyến nghị gắn Visit phù hợp đặc tả | Giữ; quyền xem/ghi phải theo Visit, không tạo lịch hẹn tự động |
| AD-12 | Nhánh Không cần thanh toán đi thẳng final, thiếu đường nối đóng Visit/Journey | Gộp cả hai kết quả vào bước ghi quyết toán và đóng Visit/Journey; cả hai cùng kiểm tra điều kiện |
| AD-13 | Nhánh Guest kết thúc sau giới hạn quyền | Nối tiếp danh sách Visit đã lọc quyền, chọn Visit và xem kết quả; không chặn Guest khỏi lịch sử hợp lệ |
| AD-14 | Sơ đồ liên kết Guest với tài khoản | Loại khỏi phạm vi mới theo quyết định người dùng; giữ AD-15 khôi phục Guest |
| AD-15 | Nhánh nhiều kết quả kết thúc sau đối chiếu bổ sung | Sau chọn đúng Visit phải quay lại xác minh/cấp quyền; chưa xác minh thì không cấp quyền |
| AD-16 | Chưa có Journey thì kết thúc ngay sau gắn ngữ cảnh làm thủ tục | Nối về gửi, lưu yêu cầu, hiển thị cho Reception và theo dõi trạng thái |
| AD-17 | Nhánh Đang xử lý kết thúc trước bước thông báo trạng thái chung | Thể hiện lưu/hiển thị trạng thái Đang xử lý; có thể kết thúc lần xử lý hiện tại và tiếp tục ở lần mở sau |
| AD-18 | Nhánh nội dung/phân quyền kết thúc trước xác nhận/lưu; chọn bác sĩ hoạt động nằm sau lần lưu chính | Các nhánh đều đi qua xác nhận, validation, lưu và audit; kiểm tra duy nhất theo phòng và điều kiện không đổi bác sĩ khi còn Visit Active theo mục 7 |
| AD-19 | Có xác định Account/Guest hoạt động nhưng chưa định nghĩa online | Bổ sung quy tắc heartbeat, hết hạn, logout và chống đếm trùng trong thiết kế kỹ thuật |

**ERD:** hai ảnh đã thể hiện ClinicalRecord, SymptomCatalog/DiagnosisCatalog và các quan hệ nhiều–nhiều, phù hợp hướng chẩn đoán mới. Tuy nhiên ERD logic chưa chỉ rõ `ExamStatus`, phòng của Visit, quan hệ bác sĩ–phòng, bác sĩ đang hoạt động, ngôn ngữ/bản dịch của mô tả và thời điểm hiện diện. Cần bổ sung các thuộc tính/quan hệ này trước migration. `DashboardMetric` không đủ để xác định ai đang online; có thể dùng cho lịch sử số liệu, còn số hiện tại phải dựa trên phiên/heartbeat.

ERD ý niệm gắn yêu cầu hỗ trợ với Visit; ERD logic cho `visit_id` tùy chọn. Giữ tùy chọn theo UC-16 để hỗ trợ trước tiếp nhận. Không cần tách toàn bộ bảng Account/Staff đang dùng chỉ để trùng tên trong ERD: cần khớp quan hệ và quyền nghiệp vụ.

Bộ sơ đồ hệ thống/use case cũ vẫn dùng 21 UC, `PendingActivation`, ba mục đích QR, nhà thuốc sau quyết toán và sửa chỉ định. Cần đánh dấu là tài liệu phiên bản cũ, rồi đối chiếu sơ đồ kiến trúc/trạng thái/sequence và một Use Case tổng thể 18 UC theo phạm vi đã chốt. Không đổi số UC bằng tìm-thay vì ý nghĩa đã thay đổi. Việc viết lại PRD/sơ đồ thuộc phần trợ lý tài liệu đang thực hiện; gói dự án cập nhật truy vết và tài liệu kỹ thuật sau khi nhận bản đó.

## 4. Mô hình nghiệp vụ đích

### Trạng thái và thao tác

| Sự kiện | Trạng thái khám | Visit / Journey | Điều kiện và kết quả |
|---|---|---|---|
| Gửi yêu cầu | Chưa có | Chưa tạo | Không có yêu cầu chờ hoặc Visit hoạt động của Patient |
| Reception xác nhận | Chờ khám | Active / Active | Tạo phiếu theo phòng/ngày; ghi cố định phòng/bác sĩ; thêm hàng chờ, cấp quyền Guest cùng giao dịch |
| Bác sĩ tiếp nhận | Đang khám | Active / Active | Đúng bác sĩ/phòng, phòng chưa có ca Đang khám; ghi lần khám và sự kiện gọi số |
| Xác nhận chỉ định | Đang thực hiện dịch vụ | Active / Active | Chỉ khi đang khám và không còn chỉ định chưa xong; tạo đúng một order, khóa chỉ định, chuyển Journey sang dịch vụ và nhả phòng |
| Hoàn tất dịch vụ | Chờ khám | Active / Active | Hoàn tất order hiện tại; đích về phòng cũ, xuất hiện ngay trong danh sách chờ bác sĩ cũ; không cần xác nhận đã đến phòng |
| Tiếp nhận khám tiếp | Đang khám | Active / Active | Phòng rảnh, bác sĩ tiếp nhận bệnh nhân có mặt; dùng cùng phiếu/Visit, có thể chỉ định một dịch vụ tiếp theo sau khi tiếp nhận |
| Xác nhận chẩn đoán | Hoàn tất | Active / Active | Không còn dịch vụ chưa hoàn tất; lưu lựa chọn và mẫu Việt, công bố kết quả, mở bước quyết toán |
| Thu ngân xác nhận | Hoàn tất | Closed / Completed | Final hoặc NoPaymentRequired; ghi quyết toán và đóng cả hai trong một giao dịch |

Khóa quyền chuyển trạng thái tại backend; không dựa vào việc ẩn nút. Gọi số và bắt đầu khám là một lệnh nghiệp vụ. Công bố kết quả và hoàn tất khám cũng là một lệnh nghiệp vụ. Thông báo chỉ được phát sau giao dịch thành công. Nhiều lần gọi lại cùng một thao tác không tạo phiếu, chỉ định, kết quả hay sự kiện thông báo trùng.

Mã trạng thái đề xuất dùng chung backend/shared: `Waiting`, `InConsultation`, `InService`, `Completed`. Đây là trạng thái khám, không dùng thay `JourneyStep.Status` hoặc `Visit.Status`. Nhãn chung của `InService` là “Đang thực hiện dịch vụ”; “Đang lấy mẫu” có thể là nội dung hướng dẫn cho loại xét nghiệm phù hợp. Đổi nhãn sau khi nhận PRD không làm đổi quy tắc chuyển trạng thái.

### Dữ liệu đề xuất

- `Visit`: thêm `ClinicLocationId`, `ExamStatus`, thời điểm hoàn tất khám và số lần tiếp nhận khám; giữ `DoctorId` cố định của lượt khám. Lưu snapshot thông tin trên phiếu tại tiếp nhận để chỉnh profile không viết lại lịch sử. Ghi tác giả thực tế của từng sự kiện.
- Phân công: một liên kết bác sĩ → phòng, một lựa chọn bác sĩ hoạt động trên phòng. Tài khoản `Active` chỉ có nghĩa được phép sử dụng, không đồng nghĩa là bác sĩ trực phòng. Bác sĩ được chọn phải thuộc phòng, có vai trò Doctor, tài khoản dùng được và phạm vi khoa tương ứng.
- `RegistrationRequest`: giữ Description nguyên văn, thêm SourceLanguage và PreferredDepartmentId tùy chọn. Tách khoa mong muốn khỏi khoa/phạm vi xử lý Reception; không dùng lựa chọn của bệnh nhân làm quyền truy cập.
- `AssistanceRequest`: giữ ngữ cảnh Visit/Request/Step tùy chọn, thêm SourceLanguage; phạm vi xử lý thuộc Reception nhưng vẫn lưu địa điểm xảy ra vấn đề. Hỗ trợ tại khu dịch vụ không được biến mất khỏi danh sách tiếp nhận.
- Dịch theo yêu cầu: lưu/cached bản dịch gắn loại hồ sơ, ID, phiên bản/hash nội dung, ngôn ngữ nguồn/đích, trạng thái, thời điểm. Không dùng một cache công khai cho mô tả nhạy cảm.
- `DoctorOrder`: tham chiếu dịch vụ và snapshot nơi thực hiện khi xác nhận; tiến độ NotCompleted/Completed, người xác nhận và thời điểm hoàn tất. Tối đa một order NotCompleted/Visit. Cùng dịch vụ có thể được chỉ định lại ở lần khám tiếp theo sau khi order trước đã xong; chống bản ghi trùng do retry cùng lệnh.
- `ExaminationTicket`: thêm ngày cấp theo Asia/Ho_Chi_Minh, phòng và số nguyên thứ tự; unique theo phòng/ngày/số. Bộ đếm phòng/ngày tăng trong giao dịch; không dùng `MAX+1` ngoài khóa. Ngày đổi không đổi phiếu cũ; giữ mã H- cũ như định danh lịch sử, không đánh lại số hồi tố.
- `ClinicalRecord`, `SymptomCatalog`, `DiagnosisCatalog`, `ClinicalSymptom`, `ClinicalDiagnosis`: lưu lựa chọn cấu trúc, nội dung Việt đã xác nhận, tác giả, thời điểm và phiên bản mẫu. Có thể dùng phân loại Symptom/Sign trong danh mục triệu chứng để hỗ trợ cả dấu hiệu mà không cần thêm bảng độc lập.
- Session/presence: thêm LastSeenAt hoặc bảng hiện diện riêng, không suy ra online từ `ExpiresAt` hay tổng tài khoản. Không ghi nhịp hiện diện qua khóa ghi nghiệp vụ toàn cục hiện tại.
- Ràng buộc database: một Visit Active/Patient, một yêu cầu pending/Patient theo trạng thái đã chuẩn hóa, một Journey và phiếu/Visit, một bác sĩ hoạt động/phòng, một Visit InConsultation/phòng và một order NotCompleted/Visit. Dùng unique index có điều kiện khi phù hợp; kiểm tra lại toàn bộ điều kiện trong giao dịch để xử lý cạnh tranh và retry.

## 5. Các gói triển khai

### P0 — Cố định hợp đồng triển khai và khảo sát dữ liệu

**Đầu ra:** ma trận PRD → AD → dữ liệu/API → UI → kiểm thử; sơ đồ trạng thái mới; danh sách API giữ/thay/ngừng dùng; cách xử lý hồ sơ cũ.

Áp dụng các quyết định tại mục 7, định nghĩa DTO/lệnh/trạng thái và báo cáo dữ liệu cũ trước migration. Lưu PRD cũ làm baseline; không dùng bảng truy vết cũ để tuyên bố đáp ứng yêu cầu mới. Không yêu cầu người dùng chốt lại sáu quyết định; chờ bản viết lại chỉ để kiểm tra sự nhất quán tài liệu. Các dữ liệu đầu vào còn thiếu ở mục 7 không chặn thiết kế schema, API hoặc UI.

### P1 — Phòng khám, bác sĩ và nền dữ liệu

**Phụ thuộc:** P0. **Tệp chính:** `Domain/Entities.cs`, `Infrastructure/HospitalDb.cs`, `HospitalCatalog.cs`, `Seed.cs`, `Migrations/`, `Administration/AdminEndpoints.cs`, `Identity/Access.cs`, `packages/shared/src/types.ts`, `apps/web/src/Admin.tsx`.

Thêm mô hình phòng/phân công, bốn trạng thái khám, số phiếu phòng/ngày và schema danh mục lâm sàng; cập nhật Admin chọn đúng một bác sĩ hoạt động. Theo cách áp dụng ở mục 7, chặn đổi bác sĩ/phòng hoặc phân công lại người đang phụ trách khi còn Visit Active liên quan. Đọc danh sách phòng/bác sĩ từ database sau migration; roster JSON chỉ làm nguồn nhập ban đầu và đối chiếu, không ghi đè lựa chọn quản trị khi restart. Không chọn hồ sơ roster chưa có thông tin đăng nhập làm người đang hoạt động.

**Nghiệm thu:** một bác sĩ thuộc một phòng; hai thao tác quản trị đồng thời không tạo hai bác sĩ hoạt động; đổi phân công khi còn Visit Active bị chặn; bác sĩ sai phòng không đọc/nhận ca; tài khoản bị khóa không nhận bệnh nhân; cập nhật roster không đổi cấu hình/lịch sử. Khóa tài khoản bảo mật vẫn có hiệu lực, không tự chuyển Visit sang bác sĩ khác.

### P2 — Tiếp nhận trực tiếp và Journey hoạt động ngay

**Phụ thuộc:** P1. **Tệp chính:** `Reception/ReceptionEndpoints.cs`, `Reception/QrService.cs`, `Journeys/Workflow.cs`, `Identity/IdentityEndpoints.cs`; web `HospitalEntry.tsx`, `PatientReception.tsx`, `StaffReception.tsx`, `PatientJourney.tsx`, `App.tsx`; mobile `Auth.tsx`, `Reception.tsx`, `Journey.tsx`, `App.tsx`; shared types/config.

Thêm kiểm tra chặn trùng cả khi gửi yêu cầu và khi xác nhận, tính theo Patient qua mọi phiên đã xác định. Form gồm liên hệ, khoa mong muốn và mô tả; lưu ngôn ngữ lúc gửi. Tạo Visit/Journey Active/phiếu/quyền Guest cùng giao dịch; phiếu tăng theo phòng/ngày từ 001, in lại và khám tiếp giữ số. Reception chọn phòng, hệ thống ghi bác sĩ hoạt động của phòng vào Visit. Phòng vẫn nhận thêm bệnh nhân chờ khi bác sĩ đang khám. Request đang chờ trả về requestId; Visit đang hoạt động trả về visitId để UI mở hồ sơ hiện có thay vì chỉ báo lỗi chung.

Loại phụ thuộc vào QR để kích hoạt; giữ Entry và khôi phục đã xác minh. Gỡ lịch hẹn, đối thoại bổ sung và trường Requests khỏi luồng mới theo phương án thu gọn. Link truy cập phiếu cũ chỉ tiếp tục hồ sơ sau kiểm tra quyền. Bổ sung tra cứu phục hồi bằng số phiếu kèm ngày/phòng hoặc thông tin phù hợp, vì số 001 có thể lặp ở các phòng/ngày khác nhau.

Loại `/api/auth/link-claim`, `/api/auth/convert`, `LinkAccount`/`LinkAccountScreen`, lời mời và đường điều hướng liên kết trên web/mobile. Client cũ gọi API liên kết nhận lỗi chức năng đã ngừng (đề xuất 410), không tạo claim hay thay quyền sở hữu. Đăng ký/login không tái sử dụng PatientId hoặc chuyển grant của Guest; giữ dữ liệu Guest phía máy chủ và nhánh khôi phục. Khi đổi phiên đăng nhập, xóa dữ liệu nhạy cảm trong bộ nhớ và dừng âm thanh của phiên trước. Không giữ một luồng tự liên kết ẩn trong nút Đăng ký. Giữ các bảng lịch sử liên kết trong đợt migration đầu, nhưng ngừng sử dụng để tạo liên kết mới.

**Nghiệm thu:** với từng Patient của Account hoặc Guest, gửi đồng thời vẫn chỉ có một yêu cầu chờ; hai nhân viên xác nhận không tạo hai Visit Active; cấp số đồng thời không trùng và qua ngày giữ phiếu cũ; tải lại/mở app khác với quyền hợp lệ còn cùng Journey; Guest hết phiên phục hồi được. Account mới không thấy dữ liệu Guest; API/UI liên kết đã bị vô hiệu; đổi phiên không hiện lại dữ liệu người trước. Không khẳng định nhận diện được cùng một người tạo hai danh tính độc lập.

### P3 — Luồng bác sĩ, dịch vụ, chẩn đoán và quyết toán

**Phụ thuộc:** P2 và danh mục P1. **Tệp chính:** `Journeys/JourneyEndpoints.cs`, `Journeys/Workflow.cs`, `Content/ContentEndpoints.cs`, `Identity/Access.cs`; web `StaffClinical.tsx`, `StaffContent.tsx`, `Admin.tsx`, `PatientRecords.tsx`; mobile `Journey.tsx`, `Records.tsx`; shared types.

Tách giao diện làm việc theo vai trò: bác sĩ có danh sách Chờ khám đủ điều kiện và ca Đang khám; Service có danh sách chỉ định Chưa hoàn tất/Hoàn tất; Cashier chỉ thấy Visit đủ điều kiện quyết toán. Bác sĩ có thể chọn bất kỳ người sẵn sàng, không tự động bắt buộc FIFO.

Thay thao tác progress/queue tổng quát bằng lệnh nghiệp vụ tiếp nhận khám, xác nhận chỉ định, hoàn tất dịch vụ và hoàn tất chẩn đoán. Có màn hình xem trước đúng một dịch vụ. Chỉ tạo order khi Visit InConsultation và chưa có order NotCompleted; chặn cập nhật/hủy sau commit, kể cả gọi trực tiếp endpoint cũ. Sau chỉ định, chuyển InService và nhả ca; dịch vụ hoàn tất chuyển Waiting, đích về phòng cũ và tự xuất hiện trong danh sách chờ bác sĩ cũ. Không thêm nút Đã quay lại phòng. Bác sĩ phải tiếp nhận khám lại trước khi được chỉ định dịch vụ tiếp theo.

Giữ lịch sử các vòng khám/dịch vụ bằng các bước/sự kiện riêng. Hoàn tất một vòng consultation để chuyển tới dịch vụ không được tự đặt trạng thái khám toàn Visit là Completed. Không để bước consultation cũ InProgress giữ sai đích Journey sau khi đã chỉ định. Khi order hoàn tất, bước quay lại trở thành bước hiện tại; chỉ lệnh bác sĩ tiếp nhận mới chuyển InConsultation.

Thêm quản trị danh mục triệu chứng/dấu hiệu/chẩn đoán và mẫu Việt; bác sĩ chọn → xem trước → chỉnh lựa chọn hoặc hủy → xác nhận. Một giao dịch lưu kết quả, hoàn tất khám, cập nhật Journey và công bố. Patient/Guest được xem kết quả khi khám Hoàn tất dù Visit vẫn Active; không xem bản chưa xác nhận. Không lưu kết quả xét nghiệm/chụp chiếu.

Chặn Final/NoPaymentRequired nếu chưa hoàn tất khám hoặc còn dịch vụ; đóng Visit và Journey cùng lúc. Gỡ bước nhà thuốc khỏi Journey mới. Cập nhật đường đọc nội dung và narration để không dùng endpoint cũ công bố sớm hoặc tiến độ Completed cũ bỏ qua chẩn đoán.

**Nghiệm thu:** không dịch vụ, một dịch vụ và nhiều dịch vụ tuần tự đều hoàn thành đúng; hai tab cùng nhận hai bệnh nhân trong một phòng chỉ một lệnh thành công; lúc A InService bác sĩ nhận được B; A hoàn tất dịch vụ trở lại Waiting nhưng không tự chiếm ca B. Chỉ định thứ hai khi dịch vụ chưa xong hoặc chưa tiếp nhận khám lại bị chặn; sửa/hủy/bỏ qua bị từ chối; kết quả chỉ xuất hiện sau xác nhận; quyết toán sớm bị chặn; thanh toán riêng lẻ không đóng Visit; cả hai outcome cuối đóng Journey.

### P4 — Dịch mô tả khi mở chi tiết và hỗ trợ do Reception xử lý

**Phụ thuộc:** P2; có thể tách thành gói độc lập với phần lớn P3 sau khi DTO được thống nhất. **Tệp chính:** `Content/TranslationService.cs`, `Content/LocalizedResponseFilter.cs`, `Reception/ReceptionEndpoints.cs`, `Support/SupportEndpoints.cs`; web `StaffReception.tsx`, `StaffSupport.tsx`, `PatientRecords.tsx`, `App.tsx`; mobile `Reception.tsx`, `Records.tsx`; shared DTO.

Mở rộng hợp đồng dịch để có nguồn/đích; giữ đường dịch nội dung bệnh viện từ Việt riêng với dịch mô tả bệnh nhân sang Việt. Gọi dịch sau xác thực quyền trong endpoint chi tiết, không dịch hàng loạt danh sách hoặc lúc bệnh nhân gửi. Không đưa Description vào bộ filter dịch tự động toàn cục.

UI chi tiết hiển thị bản gốc và bản Việt tham khảo; nếu lỗi dịch vẫn đọc bản gốc, có trạng thái và thử lại. SourceLanguage gắn với nội dung lúc nhập, không lấy ngôn ngữ profile hiện tại để diễn giải lại hồ sơ cũ. Thay đổi mô tả làm hết hiệu lực bản dịch cũ. Hàm `Check.Text` hiện trim nội dung: cần validation riêng để giữ nguyên văn mô tả theo FR-REG-03.

Thêm `GET /api/assistance/{id}` có kiểm tra quyền; danh sách trả metadata cần thiết. Gỡ quyền xử lý hỗ trợ của Service; bảo đảm mọi ngữ cảnh được chuyển tới Reception có thẩm quyền. Trạng thái hỗ trợ vẫn có thể dùng Open/Acknowledged/Resolved nội bộ với nhãn Chờ xử lý/Đang xử lý/Đã xử lý.

**Nghiệm thu:** mở list không gọi dịch; staff đúng quyền mở detail mới dịch; staff khác khoa/role không lấy được bản gốc hoặc bản dịch; đổi ngôn ngữ bệnh nhân không sửa mô tả cũ; lỗi provider không mất yêu cầu; hỗ trợ trước Journey vẫn lưu và được xử lý.

### P5 — Thuyết minh, cập nhật nhanh và Dashboard trực tuyến

**Phụ thuộc:** sự kiện/trạng thái P3 và DTO P4. **Tệp chính:** web/mobile runtime, Journey, `components.tsx`, `useRouteSpeech.ts`, `HospitalMap.tsx`; backend `SupportEndpoints.cs`, `AdminDashboard.cs`, `Identity/Access.cs`, `Program.cs`; web `AdminDashboard.tsx`; shared locales/i18n/types.

Chuẩn hóa sự kiện gọi khám với ID, Visit, lần khám, số phiếu, phòng và phiên bản nội dung. TTS có bật/tắt, tự phát mặc định khi được phép, nghe lại và văn bản. Chống phát trùng theo sự kiện, không theo mọi lần polling hoặc mọi `Visit.Version`. Dừng tiếng cũ khi đổi bệnh nhân, bước, tuyến hoặc ngôn ngữ; tránh Journey và bản đồ đọc chồng nhau.

**Đề xuất tối giản:** trước tiên polling riêng luồng gọi khám khoảng 1 giây khi màn hình/ứng dụng foreground, refresh sau thao tác và reconnect; các dữ liệu ít đổi giữ chu kỳ dài hơn. Đo thời gian từ commit đến hiển thị ở 20 người dùng để đáp ứng ≤3 giây. Nếu không đạt mới cân nhắc kênh push/SSE/SignalR; không coi giảm chu kỳ là bằng chứng đã đạt. Không mặc nhiên cam kết gọi nền khi app đã đóng.

Presence đề xuất: heartbeat 15 giây khi đang sử dụng, TTL 60 giây, Dashboard refresh 5 giây; đây là cấu hình kỹ thuật có thể điều chỉnh sau đo tải. Đếm Account theo UserAccountId qua nhiều phiên/tab, Guest theo phiên hợp lệ; bỏ phiên revoked/expired, logout hoặc quá TTL. Đổi phiên trên cùng client phải ngừng heartbeat của phiên trước. Không gộp một Guest và Account độc lập bằng tên/liên hệ; không tuyên bố đếm người thực duy nhất khi không có định danh chung. Dashboard giữ thống kê Visit hiện có và thêm số online có thời điểm cập nhật.

Đồng bộ bốn ngôn ngữ chính, nhãn lỗi, mẫu gọi số và giọng đọc. Không xóa dữ liệu ko/ru đã lưu; có chính sách chuyển lựa chọn cũ và fallback rõ ràng.

**Nghiệm thu:** gọi đúng số/phòng/ngôn ngữ, một lần cho một sự kiện, tắt tự phát vẫn nghe lại được; web bị chặn autoplay vẫn dùng văn bản/nút phát; mất mạng/reconnect không phát nội dung cũ; online không đồng nghĩa phiên chưa hết hạn, nhiều tab Account chỉ tính một người; logout/TTL được phản ánh.

### P6 — Bản đồ, tài liệu và phát hành

**Phụ thuộc:** P3/P5. Giữ thuật toán tuyến và bản đồ hiện tại; đích mặc định theo bước Journey, cập nhật đích làm hết hiệu lực tuyến/âm thanh cũ, phát hướng dẫn sau khi tính tuyến thành công. Với vị trí phòng chưa biết khu/tầng, giữ thông báo chưa có tuyến, không tự suy ra tọa độ.

RTLS thật, định vị theo thời gian thực, phát trước điểm rẽ và tự đổi tuyến theo vị trí là phần thiết kế mục tiêu. Tài liệu cần mô tả hợp đồng nguồn vị trí và trạng thái unavailable/stale; bản đồ dùng vị trí thủ công hiện tại phải được mô tả là khả năng demo. Không bỏ cách chọn vị trí hiện có khi chưa có nguồn thay thế. Nếu cần mô phỏng RTLS để trình bày, tách thành hạng mục tùy chọn và ghi rõ mô phỏng.

Cập nhật `TRACEABILITY.md/.csv` cho đúng 18 UC còn lại, PRD trích xuất có nguồn/phiên bản, `API.md/openapi.json`, `DECISIONS.md`, README/demo, hướng dẫn ngôn ngữ/phòng khám/bản đồ. Sequence ưu tiên theo mã bản đã đọc: UC-03, UC-07, UC-08, UC-10, UC-12; thêm UC-09/17 nếu cần. Nhận ERD/Use Case/Activity từ trợ lý tài liệu rồi kiểm tra với hợp đồng triển khai; không ghi đè tài liệu đang được viết lại.

## 6. Chuyển đổi dữ liệu và tương thích

1. Trước migration, tạo báo cáo read-only: Patient có nhiều Visit Active/yêu cầu chờ; phòng có nhiều ca InProgress; Visit có nhiều order chưa xong; Journey PendingActivation; bác sĩ đa phòng hoặc chưa có phòng; Visit đã quyết toán sớm; dịch vụ Skipped/Cancelled; kết quả publish sớm; Journey nhà thuốc còn mở; lịch sử đã liên kết Guest; locale ko/ru. Giữ bản sao database và cấu hình/khóa truy cập cần thiết.
2. Áp dụng schema bổ sung trước, chưa xóa bảng/cột lịch sử. Backfill phòng từ snapshot bước khám khi khớp duy nhất; hồ sơ không xác định được cần đối chiếu, không đoán theo tên/phòng gần nhất. Không lấy lịch roster cũ làm ca trực hiện tại.
3. Chuyển PendingActivation sang Active cho Visit đang hoạt động đủ dữ liệu, bảo toàn ID phiếu/Visit/Journey/grant. Lưu dấu chuyển đổi, không tạo thông báo gọi khám giả. Visit lịch sử đã đóng không bị mở lại.
4. Không tự suy `ExamStatus=Completed` chỉ vì `SummaryVersion` đã publish hoặc bước Consultation cũ đã Completed: hai thao tác trước đây độc lập. Dữ liệu không ánh xạ chắc chắn phải có danh sách xử lý/chốt chuyển đổi trước khi bật luồng mới.
5. Giữ nguyên chỉ định cũ đã Cancelled/Skipped và lịch sử công bố; không đổi chúng thành Completed để vượt điều kiện mới. Visit cũ chưa xong cần phương án chuyển đổi riêng có audit. Không tự đóng Visit chỉ vì đã có quyết toán sớm trong dữ liệu cũ.
6. Chỉ bật unique constraint sau khi đã xử lý dữ liệu vi phạm; không xóa request/Visit để làm migration chạy qua. Danh mục chẩn đoán mới không được gán tự động từ văn bản cũ; giữ nội dung cũ dưới dạng lịch sử có nguồn gốc.
7. Triển khai backend/web/mobile đồng bộ hoặc có phiên bản hợp đồng chuyển tiếp. API cũ sửa/hủy chỉ định, complete-guidance và publish độc lập phải được chặn/đổi hợp đồng an toàn; không để client cũ lách quy tắc mới. Deep link cũ vẫn kiểm tra quyền.
8. Thử nâng cấp trên database bản sao và trên database mới; kiểm tra số lượng bản ghi, IDs, quyền Guest/tài khoản và lịch sử. Rollback bằng bản sao đã kiểm chứng hoặc migration ngược đã chứng minh không mất dữ liệu; không downgrade mù sau khi đã ghi dữ liệu nghiệp vụ mới.

9. Dữ liệu đã liên kết Guest trước đây giữ nguyên quyền sở hữu hiện tại; không tự tách lại. Claim liên kết còn hiệu lực cũng không được dùng sau khi API convert ngừng hoạt động. `RecoveryClaim` và `AccessGrant` của Guest vẫn hoạt động. Dữ liệu cũ thiếu snapshot thông tin trên phiếu được đánh dấu nguồn legacy, không tuyên bố đã tái tạo chính xác thông tin tại ngày tiếp nhận.
10. Với Visit cũ có nhiều dịch vụ đang mở hoặc nhiều ca cùng phòng, không hủy chỉ định để ép về quy tắc mới. Phát hiện và giải quyết trước cutover; có thể hoàn thành các lượt này bằng phiên bản cũ trước khi nâng cấp. Chưa giải quyết được thì chưa bật constraint/luồng mới trên database đó. Database demo mới vẫn kiểm thử được luồng mới độc lập.

## 7. Quyết định đã chốt và cách áp dụng

| Mã | Quyết định người dùng | Áp dụng trong kế hoạch |
|---|---|---|
| QD-01 | Đồng ý chỉ một bệnh nhân Đang khám/phòng | Chặn nhận người thứ hai; vẫn nhận hàng chờ; chỉ định hoặc hoàn tất khám nhả ca |
| QD-02 | Không cho đổi bác sĩ | Giữ bác sĩ của Visit và phòng quay lại. Cách áp dụng đề xuất: khóa đổi bác sĩ hoạt động/phân công khi phòng còn Visit Active, chỉ đổi khi các lượt đã kết thúc; không xây dựng bàn giao |
| QD-03 | Dịch vụ xong quay về phòng cũ, phiếu Chờ khám và xuất hiện trong danh sách chờ; có trạng thái riêng khi đi dịch vụ | Thêm InService; tự chuyển Waiting và đích về phòng cũ khi dịch vụ xong. Tên chung đề xuất “Đang thực hiện dịch vụ”; “Đang lấy mẫu” dùng cho hướng dẫn xét nghiệm phù hợp |
| QD-04 | Làm một dịch vụ một lần | Một service mỗi lần xác nhận, một order chưa xong/Visit; khám lại rồi mới chỉ định tiếp |
| QD-05 | Đồng ý cấp số theo phòng/ngày | Bắt đầu 001 mỗi ngày theo giờ Việt Nam; in lại/khám tiếp giữ số; gọi kèm phòng |
| QD-06 | Bỏ liên kết Guest vì phức tạp và khác thông tin hồ sơ | Bỏ UI/API chuyển đổi/gộp, tách Account/Guest; giữ khôi phục Guest, không tự gộp theo liên hệ và không xóa lịch sử cũ |

QD-02 ghi riêng cách áp dụng phạm vi khóa do câu trả lời người dùng là “không cho đổi”; đây không phải lời xác nhận chi tiết về thời điểm mở khóa. Tương tự nhãn InService là đề xuất diễn đạt bao quát các loại dịch vụ. Khi nhận PRD viết lại, đối chiếu hai điểm này; chúng không chặn lập kế hoạch, và thay nhãn không ảnh hưởng thiết kế trạng thái.

### Dữ liệu đầu vào và lựa chọn kỹ thuật

- Danh mục triệu chứng/chẩn đoán và mẫu Việt: xây CRUD và cơ chế lưu lựa chọn trước; dùng fixture có nhãn demo cho test. Cần dữ liệu được cung cấp/xác nhận trước nghiệm thu nội dung, không cần chờ để viết schema/UI. Không suy chẩn đoán từ mô tả bệnh nhân.
- Dịch tự do: triển khai hợp đồng và provider giả lập cho test; kiểm tra cấu hình provider thật trước nghiệm thu dịch văn bản bất kỳ. Không đọc/in khóa bí mật ra báo cáo.
- Ngôn ngữ: lấy vi/en/zh/ja theo PRD làm bốn lựa chọn chính; giữ dữ liệu ko/ru cũ và fallback, không tự xóa lịch sử. Việc thu giao diện về bốn ngôn ngữ là phương án bám PRD, không phải một trong sáu câu trả lời vừa chốt.
- Booking ngoài, trao đổi bổ sung theo mẫu và bước nhà thuốc sau Visit: rút khỏi luồng mới theo phạm vi PRD; giữ dữ liệu lịch sử. Thanh toán dịch vụ riêng lẻ nếu còn endpoint thì không được đóng Visit.
- Polling/heartbeat/TTL, schema vật lý, mã lỗi và migration: người triển khai chọn theo phương án ở các mục trên và kiểm chứng bằng test, không cần hỏi lại người dùng về từng thông số.
- Nhận diện: một Visit Active được bảo đảm theo Patient của hệ thống. Sau khi bỏ liên kết, không thể tự biết Account và Guest có cùng là một người; không bổ sung một cơ chế gộp ngầm để giải quyết việc này.

## 8. Kiểm thử và điều kiện hoàn thành

Các bài kiểm thử cũ đang khẳng định kích hoạt QR, sửa/hủy chỉ định, quyết toán sớm, sáu ngôn ngữ và Journey nhà thuốc. Cần thay expected behavior theo PRD mới, giữ các ca hồi quy về quyền, lưu dữ liệu, idempotency, phiên và lỗi âm thanh.

| Phạm vi | Các ca bắt buộc |
|---|---|
| API và dữ liệu | Gửi/xác nhận đồng thời; số phiếu phòng/ngày; một ca Đang khám/phòng; chặn đổi bác sĩ; InService không ở hàng chờ; hoàn tất dịch vụ tự quay lại; nhiều vòng dịch vụ tuần tự; chỉ định bất biến; chẩn đoán + hoàn tất nguyên tử; cả hai outcome đóng Visit/Journey |
| Quyền | Patient không tự hoàn tất chuyên môn; Doctor sai phòng/không hoạt động bị chặn; Service chỉ hoàn tất dịch vụ được giao và không xử lý hỗ trợ; Admin không tự xem/công bố kết quả bệnh nhân; Guest chỉ thấy hồ sơ có grant |
| Dịch | Không dịch list/submit; dịch detail sau kiểm tra quyền; giữ nguyên văn; nguồn/đích đúng; cache hết hiệu lực khi sửa; timeout/provider lỗi có fallback; không rò mô tả vào log |
| Web và mobile | Entry giữ ngôn ngữ; yêu cầu → Journey không quét kích hoạt; bốn trạng thái khám; gọi số; kết quả trước quyết toán; hỗ trợ trước Journey; khôi phục Guest; không còn UI liên kết; Account đăng ký mới không nhận dữ liệu Guest; đổi ngôn ngữ không mất tiến độ |
| Âm thanh và bản đồ | Tự phát/bật/tắt/nghe lại; chặn autoplay; chống phát trùng; hủy âm thanh cũ; tuyến thay đổi; thiếu vị trí/giọng; văn bản luôn dùng được |
| Presence và hiệu năng | Nhiều tab/thiết bị cùng Account; đổi phiên ngừng heartbeat cũ; không gộp Account/Guest độc lập theo tên; logout/expiry/TTL/background; Dashboard không đếm tổng tài khoản; 20 người dùng, đo thao tác thường và độ trễ gọi khám |
| Migration | Database mới và bản sao dữ liệu cũ; giữ ID/lịch sử; phát hiện xung đột; không tự đóng/mở lại lượt; rehearsal rollback |

Tận dụng `tests/api/api.test.mjs`, `tests/api/performance.mjs`, `tests/translation/`, `tests/catalog/`, `tests/browser/`, `tests/android/` và các unit test narration/map/language. Bổ sung test nghiệp vụ tại nơi thực sự có thay đổi; không cần chạy lại các kiểm thử LAN/bootstrap trong mỗi gói nếu không sửa chúng.

Chạy từ `codes/`: `npm run typecheck`, `npm run lint`, `npm run build`, `dotnet build -c Release --no-restore`; tiếp theo API acceptance với database riêng, browser E2E và các test unit/translation/catalog bị ảnh hưởng. Với mobile, kiểm chứng build Android và chạy luồng mới trên giả lập/thiết bị theo hướng dẫn hiện có. Không dùng database đang demo cho test tạo dữ liệu.

Hoàn thành khi 18 UC còn lại được truy vết đúng phạm vi mới và QD-01..06, các luồng nghiệp vụ bắt buộc chạy thống nhất trên web/mobile, migration được kiểm chứng và các giới hạn RTLS được ghi rõ. Phần phân tích này là rà soát tài liệu/mã nguồn; chưa chạy ứng dụng hoặc kiểm thử để khẳng định hệ thống đã đáp ứng PRD mới.

## 9. Checklist triển khai theo đợt thay đổi

Mỗi dòng là một đợt thay đổi có thể review riêng. Các checkbox dưới đây đều chưa thực hiện; việc hoàn thành kế hoạch không đồng nghĩa hoàn thành chức năng. Đường dẫn backend ở mục 5 tính từ `codes/backend/Hospital.Api/`; web/mobile/shared tính từ `codes/`.

| Thứ tự | Gói | Việc cần làm | Phụ thuộc | Điều kiện kết thúc đợt |
|---|---|---|---|---|
| 01 | P0 | Cố định bảng chuyển trạng thái, DTO và lệnh ở dưới; lập báo cáo dữ liệu legacy; đối chiếu test nào đang giữ nghiệp vụ cũ | Không | Có hợp đồng đủ rõ và danh sách xung đột dữ liệu; không cần PRD trình bày hoàn chỉnh |
| 02 | P1 | Schema bổ sung, migration/backfill, phân công phòng/bác sĩ, bộ đếm phiếu, Admin quản lý phân công; shared types | 01 | Database mới chạy được; database bản sao phát hiện đúng trường hợp không thể tự chuyển; quyền/ràng buộc được test |
| 03 | P2a | Bỏ link-claim/convert và mọi UI liên kết; đăng ký/login độc lập, giữ khôi phục Guest | 01 | Client cũ không liên kết được; đổi phiên không lộ dữ liệu; Guest vẫn phục hồi được |
| 04 | P2b | Tiếp nhận một yêu cầu, tạo Journey Active, cấp số phòng/ngày, lưu phòng/bác sĩ và snapshot; sửa web/mobile | 02, 03 | Tiếp nhận/in lại/retry đồng thời đúng; không cần QR kích hoạt |
| 05 | P3a | Hàng chờ theo phòng, một ca đang khám, chỉ định một dịch vụ, hoàn tất dịch vụ và tự quay lại hàng chờ | 04 | Chạy được nhiều vòng khám → dịch vụ → khám lại; không đổi phòng/bác sĩ/phiếu |
| 06 | P3b | CRUD danh mục, chọn triệu chứng/chẩn đoán, preview, hoàn tất khám + công bố; quyết toán đóng Visit/Journey | 05 | Luồng không dịch vụ và luồng dịch vụ đều kết thúc được; kết quả xem trước quyết toán |
| 07 | P4 | Dịch mô tả ở chi tiết, UI gốc/bản Việt; hỗ trợ chỉ Reception, trước và trong Journey | 04 | Quyền, cache, timeout và hỗ trợ trước Visit đều được kiểm tra |
| 08 | P5a | Tự phát Journey/gọi số/chỉ đường, điều khiển âm thanh, đồng bộ bốn ngôn ngữ, cập nhật gọi khám nhanh | 05, 06, 07 | Không phát trùng/cũ, có fallback; đo độ trễ ≤3 giây trong điều kiện kiểm thử |
| 09 | P5b | Presence heartbeat, TTL, bộ đếm online và Dashboard | 03, 04 | Đếm đúng danh tính hợp lệ; nhiều tab không cộng trùng Account; test logout/TTL |
| 10 | P6 | Hồi quy web/Android, thử nâng cấp/khôi phục, kiểm thử tải, nhận PRD mới và cập nhật truy vết/API/demo | Các gói trên | Đủ nghiệm thu, giới hạn RTLS rõ ràng, có artifact build và hướng dẫn nâng cấp/rollback |

### Checklist hợp đồng và API

Đây là hợp đồng đề xuất cho implementation, chưa phải endpoint đã có. Tên cuối có thể thay đổi nhưng phải giữ điều kiện và tính nguyên tử.

- [ ] `POST /api/requests`: giữ đường dẫn; lưu mô tả/ngôn ngữ nguồn; kiểm tra Patient chưa có request pending/Visit Active. Khi gặp hồ sơ hiện có, phản hồi định danh để client tiếp tục hồ sơ đó.
- [ ] `POST /api/requests/{id}/confirm`: giữ đường dẫn; tạo Visit Active, ExamStatus Waiting, Journey Active, phiếu phòng/ngày, snapshot và grant trong một giao dịch. Tiếp nhận phòng/bác sĩ phải được đọc lại trong giao dịch để không đụng thao tác đổi phân công đồng thời.
- [ ] `GET /api/clinics/{id}/waiting-list` và `POST /api/visits/{id}/accept-examination`: danh sách chỉ Visit Active + ExamStatus Waiting của phòng được phép; lệnh nhận kiểm tra đúng bác sĩ và không còn InConsultation khác, tăng số lần tiếp nhận và tạo sự kiện gọi. Hai tab cạnh tranh nhận ca chỉ một lệnh thành công.
- [ ] `POST /api/visits/{id}/orders`: một ServiceId; kiểm tra InConsultation, version và không có order mở; xác nhận bất biến, chuyển InService, cập nhật bước/đích Journey và nhả ca cùng giao dịch. Màn hình preview phải hiển thị dịch vụ/địa điểm đã được xác định từ cấu hình; nếu cấu hình đổi trước xác nhận thì yêu cầu xem lại.
- [ ] `POST /api/visits/{id}/orders/{orderId}/complete`: chỉ Service đúng phạm vi; hoàn tất order, chuyển ExamStatus Waiting, mở bước quay lại phòng gốc và tạo cập nhật cùng giao dịch. Không tạo Visit/phiếu hoặc tự bắt đầu khám.
- [ ] `GET /api/clinical-catalogs`, nhóm quản trị catalog và `POST /api/visits/{id}/clinical-preview`: đọc danh mục hợp lệ, tạo mẫu Việt trên server từ lựa chọn; preview không công bố. Ràng buộc preview với phiên bản mẫu/danh mục và lựa chọn đã kiểm tra.
- [ ] `POST /api/visits/{id}/complete-examination`: đúng bác sĩ, InConsultation, không còn order mở; kiểm tra lại lựa chọn/phiên bản preview; lưu kết quả đã xác nhận + ExamStatus Completed + bước quyết toán trong một giao dịch. Hủy trên form không gọi lệnh này.
- [ ] `POST /api/visits/{id}/settlement`: giữ đường dẫn; Final/NoPaymentRequired chỉ hợp lệ khi ExamStatus Completed và dịch vụ xong; kết thúc Visit/Journey nguyên tử, không dựa vào quyết toán đã ghi sớm.
- [ ] `GET /api/assistance/{id}`: thêm đọc chi tiết sau kiểm tra quyền và dịch sang Việt theo ngữ cảnh; kiểm tra quyền tương tự cho chi tiết request. Không cho Service xử lý hỗ trợ.
- [ ] `POST /api/presence/heartbeat` và phần online trong Dashboard: dùng phiên được xác thực; không tin UserId/role do client truyền, không đưa heartbeat qua khóa lệnh nghiệp vụ toàn cục.
- [ ] Ngừng API liên kết Guest; chặn API sửa/hủy order và mọi đường progress/queue/publish cũ có thể bỏ qua quy tắc. Không chỉ xóa nút hoặc đổi tên endpoint mà để hành vi cũ còn gọi được.

Mọi lệnh nghiệp vụ ghi dữ liệu dùng version/concurrency và Idempotency-Key theo cơ chế hiện có; lỗi cạnh tranh trả mã nghiệp vụ rõ ràng để client tải lại. DTO Visit cần có ExamStatus, ClinicLocationId, DoctorId, ticket có phòng/ngày/số, currentStep và khả năng thao tác do backend tính. Backend luôn kiểm tra lại quyền/điều kiện dù client báo nút khả dụng.

### Checklist giao diện

- [ ] Bệnh nhân web/mobile: một form tiếp nhận và yêu cầu hiện có; chuyển thẳng tới Journey khi được xác nhận; hiển thị bốn trạng thái, đích và số phiếu rõ ràng; không còn nút kích hoạt/liên kết/hoàn tất nhà thuốc.
- [ ] Reception: danh sách yêu cầu → chi tiết gốc/bản dịch → xác minh → chọn phòng → xác nhận/in lại; tìm phiếu phục hồi theo đủ ngữ cảnh; khu xử lý hỗ trợ riêng.
- [ ] Doctor: danh sách chờ và một ca đang khám; nút Tiếp nhận theo điều kiện; form một dịch vụ với bước xem trước; form danh mục chẩn đoán với xem trước/xác nhận; không có sửa/hủy order đã xác nhận.
- [ ] Service: danh sách chỉ định được giao, hai trạng thái Chưa hoàn tất/Hoàn tất và xác nhận; không có nhập kết quả chuyên môn hoặc xử lý hỗ trợ.
- [ ] Cashier: danh sách đủ điều kiện, hai lựa chọn quyết toán cuối/không cần thanh toán; không có hành động đóng sớm.
- [ ] Admin: phân công theo phòng, chọn bác sĩ hoạt động có guard, danh mục triệu chứng/chẩn đoán, nội dung và Dashboard online; không tự công bố nội dung khám.

### Kịch bản nghiệm thu xuyên suốt

1. Guest A chọn ngôn ngữ, gửi yêu cầu; Reception tiếp nhận vào phòng 101, cấp số 001 và mở Journey ngay. Account B được cấp số 002 cùng phòng, vẫn ở hàng chờ.
2. Bác sĩ tiếp nhận A; thử nhận B đồng thời bị chặn. A ở Đang khám, nhận lời gọi đúng số và phòng.
3. Bác sĩ chỉ định một xét nghiệm cho A. A sang Đang thực hiện dịch vụ, đích là phòng xét nghiệm, không còn trong hàng chờ khám. Bác sĩ nhận B được.
4. Nhân viên dịch vụ hoàn tất xét nghiệm A. A trở lại Chờ khám, xuất hiện trong danh sách bác sĩ, đích về phòng 101 và giữ số 001. B vẫn Đang khám; hệ thống không tự nhận A hoặc kết thúc ca B.
5. Bác sĩ hoàn tất chẩn đoán B rồi tiếp nhận lại A. Có thể chỉ định thêm đúng một dịch vụ cho A và lặp lại vòng trên; không cho tạo dịch vụ tiếp khi A chưa được tiếp nhận khám lại.
6. Bác sĩ xác nhận chẩn đoán A. A xem kết quả ngay khi Visit chưa quyết toán. Thu ngân xác nhận Final hoặc NoPaymentRequired; Visit Closed và Journey Completed.
7. Guest A đăng ký một tài khoản độc lập: tài khoản không có lịch sử Guest A. Reception vẫn có thể cấp quyền khôi phục lượt Guest cũ sau xác minh; không gộp, không đổi thông tin phiếu.
8. Chạy lại các bước có retry, hai tab, mất mạng và refresh. Không tạo trùng phiếu/order/kết quả, không phát lại lời gọi cũ, không tự chuyển bác sĩ. Thử qua ngày để kiểm tra dãy số mới và phiếu cũ.

### Điểm bắt đầu khi được yêu cầu triển khai mã

Thực hiện đợt 01 rồi 02 và 03; sau đó hoàn thành luồng tiếp nhận ở đợt 04. Đầu ra đầu tiên có thể chạy để review là Admin chọn bác sĩ theo phòng → bệnh nhân gửi yêu cầu → Reception xác nhận → Journey Active với số phòng/ngày, đồng thời không còn liên kết Guest. Không triển khai RTLS thật, thay framework hoặc làm lại giao diện toàn bộ trong đợt này.
