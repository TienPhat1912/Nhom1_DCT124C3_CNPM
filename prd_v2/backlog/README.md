# Product backlog chỉnh sửa dự án theo PRD mới

Ngày tạo: 11/11/2026. Backlog gồm **34 task**, mỗi task là một đơn vị công việc có đầu ra và tiêu chí để review trong một PR. Trạng thái thực tế nằm trong từng file task. Ngày 14/11/2026 bổ sung PB-033/034 và mở rộng PB-026 theo yêu cầu thiết kế bản đồ và mô phỏng RTLS; chi tiết nằm trong [PB-033](tasks/PB-033-map-layout.md), [PB-034](tasks/PB-034-rtls-simulation.md) và [PB-026](tasks/PB-026-route-narration.md). Việc lập kế hoạch này chỉ cập nhật tài liệu local, chưa tạo Issue/branch/PR mới.

[Kế hoạch chính](../PRD-REVISION-PLAN.md) được giữ nguyên để đối chiếu nghiệp vụ, thứ tự tổng thể và chuyển đổi dữ liệu. Backlog này chia nhỏ kế hoạch thành công việc cho thành viên nhận làm. Các quyết định mới của người dùng ưu tiên hơn PRD/sơ đồ cũ.

## Chọn và nhận task

1. Chọn task có trạng thái **Ready**, chưa có người nhận. Nếu task đang Backlog, kiểm tra tất cả PR phụ thuộc đã merge thì chuyển Ready.
2. Mở file riêng của task, điền Người nhận và chuyển **In progress**. Thông báo mã task trong kênh nhóm đang dùng hoặc tự nhận Issue tương ứng nếu nhóm đưa backlog lên GitHub.
3. Chỉ một người làm chủ mỗi task. Trước khi nhận, kiểm tra trạng thái mới nhất trên nhánh tích hợp; không tự nhận cùng task trên hai bản local rồi bắt đầu độc lập.
4. Tạo branch riêng từ nhánh tích hợp mới nhất, làm đúng phạm vi và test của task.
5. Push branch, mở PR với mã task; chuyển **In review**, điền PR/Reviewer. Sau review và merge mới chuyển **Done**.

Có thể copy nguyên nội dung file task thành GitHub Issue. Sau khi chuyển lên Issues, chọn **một nơi làm nguồn trạng thái chính**: Issues hoặc file task, và ghi lựa chọn ở đây; không duy trì hai bảng trạng thái mâu thuẫn. Mặc định hiện tại dùng các file task. Người nhận/PR/trạng thái nằm trong từng file, không nhân đôi ở bảng mục lục dưới.

**Task không có phụ thuộc:** PB-001 (hợp đồng), PB-002 (khảo sát dữ liệu), PB-003 (bỏ liên kết Guest) và PB-033 (thiết kế bản đồ). Kiểm tra trạng thái/người nhận trong file trước khi nhận; PB-001 và PB-003 cần thống nhất khi cùng chạm shared types/nhãn.

## Quy ước chia task

- Một task thường tương ứng một branch và một PR; task chỉ thêm API/schema vẫn phải có hợp đồng và kiểm thử sử dụng được, không phải file khung hoặc TODO.
- Task theo luồng người dùng bao gồm API/UI/test cần thiết trong phạm vi ghi rõ. Web và mobile được tách khi mỗi phần có thể review độc lập trên cùng API đã merge.
- **P0:** nền tảng/nghiệp vụ cốt lõi hoặc điều kiện phát hành. **P1:** chức năng hỗ trợ vẫn thuộc phạm vi phải hoàn thành. P1 không có nghĩa được bỏ; ưu tiên không thay thế phụ thuộc.
- **S:** phạm vi hẹp; **M:** vài thành phần liên quan. Đây là cỡ việc tương đối, không phải cam kết số ngày. Nếu một task thực tế quá lớn, tách thành task con có ID/phụ thuộc/tiêu chí riêng trước khi làm.
- **Backlog:** chưa sẵn sàng vì phụ thuộc. **Ready:** đủ điều kiện nhận. **In progress:** đang làm. **In review:** có PR chờ review. **Done:** đủ tiêu chí và đã merge. Nếu gặp vướng mắc, ghi lý do/việc cần tháo gỡ trong task, không đánh Done.
- Task phụ thuộc không cần đợi toàn bộ dự án; chỉ đợi những PR ghi trong cột phụ thuộc. Có thể thiết kế trước, nhưng không merge code dựa vào API/migration chưa có.
- Sáu quyết định đã chốt: một ca Đang khám/phòng; không chuyển bác sĩ giữa lượt; dịch vụ xong tự về hàng chờ phòng cũ; một dịch vụ một lần; phiếu theo phòng/ngày; bỏ liên kết Guest, giữ khôi phục.
- Nhãn chung đề xuất là **Đang thực hiện dịch vụ**, không dùng “Đang lấy mẫu” cho mọi dịch vụ. Phạm vi khóa đổi bác sĩ khi còn Visit Active là cách áp dụng được ghi tại mục 7 kế hoạch; đối chiếu bản PRD viết lại trong PB-001.

## Danh sách task

Đường dẫn mã nguồn trong các task tính từ `codes/`. Các mã PB ổn định để đặt branch/PR và tham chiếu trong review.

| Task | Kết quả | Ưu tiên / cỡ | Phụ thuộc cần merge | Gói kế hoạch |
|---|---|---|---|---|
| [PB-001](tasks/PB-001-contracts.md) | Chốt hợp đồng trạng thái, DTO và lỗi nghiệp vụ | P0 / S | Không — có thể nhận ngay | P0 |
| [PB-002](tasks/PB-002-legacy-audit.md) | Tạo báo cáo dữ liệu cũ trước nâng cấp | P0 / S | Không — có thể nhận ngay | P0 / mục 6 |
| [PB-003](tasks/PB-003-remove-guest-link.md) | Bỏ liên kết Guest với tài khoản trên API, web và mobile | P0 / M | Không — có thể nhận ngay | P2a / QD-06 |
| [PB-004](tasks/PB-004-core-schema.md) | Bổ sung schema phòng, trạng thái khám và snapshot | P0 / M | PB-001, PB-002 | P1 |
| [PB-005](tasks/PB-005-clinic-assignment.md) | Quản trị bác sĩ đang hoạt động theo phòng | P0 / M | PB-004 | P1 / QD-02 |
| [PB-006](tasks/PB-006-registration-request.md) | Tối giản yêu cầu tiếp nhận trên API và web bệnh nhân | P0 / M | PB-003, PB-004 | P2b |
| [PB-007](tasks/PB-007-ticket-number.md) | Cấp số phiếu an toàn theo phòng và ngày | P0 / S | PB-004 | P1–P2 / QD-05 |
| [PB-008](tasks/PB-008-confirm-reception.md) | Xác nhận tiếp nhận và mở Journey ngay trên web | P0 / M | PB-005, PB-006, PB-007 | P2b |
| [PB-009](tasks/PB-009-mobile-reception.md) | Đồng bộ tiếp nhận và kích hoạt Journey trên mobile | P0 / M | PB-003, PB-008 | P2b |
| [PB-010](tasks/PB-010-doctor-accept.md) | Danh sách chờ và tiếp nhận một bệnh nhân vào khám | P0 / M | PB-008 | P3a / QD-01 |
| [PB-011](tasks/PB-011-single-order.md) | Chỉ định đúng một dịch vụ và khóa sau xác nhận | P0 / M | PB-010 | P3a / QD-04 |
| [PB-012](tasks/PB-012-service-return.md) | Hoàn tất dịch vụ và tự trở lại hàng chờ phòng cũ | P0 / M | PB-011 | P3a / QD-03 |
| [PB-013](tasks/PB-013-clinical-catalog.md) | Danh mục triệu chứng, dấu hiệu, chẩn đoán và mẫu Việt | P0 / M | PB-004, PB-005 | P1 / P3b |
| [PB-014](tasks/PB-014-complete-examination.md) | Chẩn đoán từ danh mục và xác nhận kết thúc khám | P0 / M | PB-012, PB-013 | P3b |
| [PB-015](tasks/PB-015-final-settlement.md) | Quyết toán cuối và đóng Visit cùng Journey | P0 / M | PB-014 | P3b |
| [PB-016](tasks/PB-016-patient-results.md) | Xem kết quả và khuyến nghị trên web và mobile | P0 / M | PB-009, PB-014 | P3b |
| [PB-017](tasks/PB-017-translation-provider.md) | Dịch văn bản có ngôn ngữ nguồn và đích | P1 / M | PB-001 | P4 |
| [PB-018](tasks/PB-018-request-translation.md) | Dịch mô tả khi Reception mở chi tiết tiếp nhận | P1 / S | PB-008, PB-017 | P4 |
| [PB-019](tasks/PB-019-assistance.md) | Reception xử lý hỗ trợ và xem bản dịch chi tiết | P1 / M | PB-008, PB-009, PB-017 | P4 |
| [PB-020](tasks/PB-020-guest-recovery.md) | Tra cứu và khôi phục lượt Guest bằng phiếu | P0 / M | PB-003, PB-008, PB-009 | P2b / UC-15 cũ |
| [PB-021](tasks/PB-021-web-journey.md) | Hoàn thiện Journey bốn trạng thái trên web | P0 / M | PB-012, PB-015 | P3 / QD-03 |
| [PB-022](tasks/PB-022-mobile-journey.md) | Hoàn thiện Journey bốn trạng thái trên mobile | P0 / M | PB-009, PB-012, PB-015 | P3 / QD-03 |
| [PB-023](tasks/PB-023-event-delivery.md) | Cập nhật gọi khám nhanh và sự kiện không trùng | P1 / M | PB-010, PB-012, PB-014, PB-015 | P5a |
| [PB-024](tasks/PB-024-web-narration.md) | Tự phát hướng dẫn và gọi số trên web | P1 / M | PB-018, PB-019, PB-021, PB-023 | P5a |
| [PB-025](tasks/PB-025-mobile-narration.md) | Tự phát hướng dẫn và gọi số trên mobile | P1 / M | PB-019, PB-022, PB-023 | P5a |
| [PB-026](tasks/PB-026-route-narration.md) | Chỉ đường và thuyết minh từng chặng theo vị trí mô phỏng | P1 / M | PB-024, PB-025, PB-034 | P5a / P6 mở rộng |
| [PB-027](tasks/PB-027-four-languages.md) | Rà soát bốn ngôn ngữ cho toàn bộ luồng mới | P1 / S | PB-016, PB-018, PB-019, PB-020, PB-026, PB-029 | P5a |
| [PB-028](tasks/PB-028-presence-api.md) | Heartbeat và API thống kê trực tuyến | P1 / M | PB-001, PB-003, PB-004 | P5b |
| [PB-029](tasks/PB-029-presence-clients.md) | Heartbeat web/mobile và thẻ online trên Dashboard | P1 / M | PB-021, PB-022, PB-028 | P5b |
| [PB-030](tasks/PB-030-migration-rehearsal.md) | Kiểm chứng nâng cấp và phương án khôi phục dữ liệu | P0 / M | PB-002, PB-005, PB-007, PB-013, PB-015, PB-020, PB-028 | P6 / mục 6 |
| [PB-031](tasks/PB-031-acceptance-release.md) | Nghiệm thu tích hợp, hiệu năng và bản build | P0 / M | PB-016, PB-018, PB-019, PB-020, PB-027, PB-029, PB-030 | P6 |
| [PB-032](tasks/PB-032-traceability-docs.md) | Đồng bộ tài liệu kỹ thuật và 18 Use Case | P1 / S | PB-031 | P6 |
| [PB-033](tasks/PB-033-map-layout.md) | Thiết kế lại bản đồ và mạng đường đi các tầng, các tòa | P1 / M | Không — có thể nhận ngay | Bản đồ mở rộng 14/11/2026 |
| [PB-034](tasks/PB-034-rtls-simulation.md) | Mô phỏng vị trí RTLS và di chuyển theo chặng | P1 / M | PB-033 | Mô phỏng mở rộng 14/11/2026 |

Thứ tự riêng của bản đồ: **PB-033 → PB-034 → PB-026 → PB-027 → PB-031 → PB-032**. PB-026 đồng thời chờ PB-024/025. Theo quyết định ngày 14/11/2026, mô phỏng nằm trong phạm vi demo cần nghiệm thu của đợt này; RTLS thật vẫn là mục tiêu tương lai. Kế hoạch chính được giữ làm đối chiếu lịch sử, giới hạn cũ về mô phỏng được thay bằng các yêu cầu trực tiếp trong PB-033/034/026.

## Cách chia việc cho nhóm

Không gán sẵn người khi chưa biết danh sách thành viên. Có thể chọn theo sở trường:

| Nhóm việc | Task phù hợp | Điểm phối hợp |
|---|---|---|
| Backend và database | PB-001/002/004/007/017/023/028/030 | Hợp đồng DTO chung, EF migration và giao dịch |
| Web quản trị/nhân viên | PB-005/008/010/011/012/013/014/015/018 | Nhiều task chạm StaffClinical/Admin; làm nối tiếp theo phụ thuộc hoặc tách component |
| Bệnh nhân và tài khoản | PB-003/006/016/019/020/021 | Quyền Account/Guest, đổi phiên, form và trạng thái |
| Mobile | PB-009/022/025; phần mobile PB-016/019/020/026/029 | Chờ API merge; tránh nhiều người cùng sửa App/runtime |
| Thuyết minh, bản đồ, Dashboard | PB-024/026/027/029/033/034 | PB-033/034 làm trước tích hợp PB-026; ưu tiên âm thanh và vòng đời ứng dụng |
| Nghiệm thu và tài liệu | PB-031/032 | Mỗi PR vẫn tự test; nhóm này kiểm tra tích hợp cuối |

Sau PB-004, có thể nhận các luồng độc lập như phân công phòng (PB-005), yêu cầu tiếp nhận (PB-006), cấp số phiếu (PB-007), dịch thuật sau PB-001 (PB-017), presence (PB-028). Các task có EF migration phải phối hợp thứ tự merge, dù phần logic khác nhau.

## Hoàn thành một task

Một task chỉ Done khi:

- Đã đạt tất cả tiêu chí chấp nhận và hoàn thành các dependency; không còn TODO trên luồng thuộc task.
- Có xử lý lỗi/quyền/trạng thái rỗng hoặc cũ phù hợp; việc ẩn nút không thay kiểm tra backend.
- Test hành vi nghiệp vụ quan trọng nằm trong PR của task; không đợi PB-031 mới kiểm thử.
- Typecheck/lint/build và test liên quan đạt. PR tài liệu chỉ cần kiểm tra nội dung/link, không thêm test máy móc.
- PR có mô tả dễ hiểu, bằng chứng kiểm tra, ảnh/video nếu thay giao diện, ghi rõ phần chưa kiểm chứng.
- Migration/schema nếu có đã được thử trên database mới và fixture cũ liên quan; không xóa dữ liệu để làm test qua.
- Reviewer đã duyệt, các yêu cầu sửa đã xử lý và PR được merge. **Push branch hoặc mở PR chưa phải Done.**

Các lệnh phổ biến chạy từ `codes/`; chọn theo phạm vi:

| Thay đổi | Kiểm chứng tối thiểu phù hợp |
|---|---|
| Web/shared TypeScript | `npm run typecheck`, `npm run lint`, `npm run build` và browser test của task |
| Backend | Restore theo README nếu cần; `dotnet build -c Release --no-restore`; API tests với database riêng |
| Migration | Migration mới/cũ và kiểm tra dữ liệu/constraints trong fixture riêng; phối hợp PB-030 |
| Mobile | Typecheck, test logic liên quan và luồng trên giả lập/thiết bị; native build nếu thay ảnh hưởng build |
| TTS/bản đồ/ngôn ngữ | Các script `test:narration:unit`, `test:map:unit`, `test:languages:unit`, `test:translation` phù hợp với thay đổi |
| Tài liệu | Nội dung khớp chức năng và link tồn tại |

Xem [hướng dẫn kiểm thử](../../../codes/tests/README.md) và [README ứng dụng](../../../codes/README.md). Không test ghi dữ liệu trên database demo/online đang dùng. Lỗi môi trường hoặc kiểm chứng còn thiếu phải ghi trong PR; không ghi “đã pass” nếu chưa chạy.

## Quy trình branch và PR

Nhóm thống nhất một nhánh tích hợp làm base (ví dụ `main` hoặc `develop`). Không mặc định branch đang mở của thành viên là base đúng. Mỗi task bắt đầu từ bản mới nhất của nhánh tích hợp sau khi dependency đã merge.

Branch gợi ý: `feat/pb-010-doctor-accept`; task tài liệu có thể dùng `docs/pb-032-traceability`.

Tiêu đề PR: `[PB-010] Tiếp nhận một bệnh nhân vào khám theo phòng`.

Nội dung PR dùng [mẫu PR](PR-TEMPLATE.md). Commit và stage đúng file của task; không gom toàn bộ file chưa theo dõi trong workspace, PRD/sơ đồ người khác đang viết, `.env`, log hay artifact build vào PR.

Đẩy branch lên remote rồi mở PR vào nhánh tích hợp, liên kết Issue nếu có. Reviewer kiểm tra hành vi và test, không chỉ nhìn build thành công. Khi cần sửa, tiếp tục trên branch/PR hiện tại. Sau merge cập nhật file task/link PR trên nhánh tích hợp bằng thay đổi tài liệu nhỏ; không sửa kế hoạch chính chỉ để cập nhật trạng thái.

## Tránh xung đột và PR chưa hoàn chỉnh

- Các file dễ xung đột: `Entities.cs`, `HospitalDb.cs`, EF model snapshot, `Workflow.cs`, `StaffClinical.tsx`, `Admin.tsx`, web/mobile `App.tsx` và `runtime.tsx`, shared `types.ts`/`i18n.ts`.
- Ghi trong PR các file chung đã sửa. Hạn chế format/refactor toàn file khi task chỉ đổi một phần; có thể tách component/module mới trong phạm vi task để giảm xung đột.
- Một PR migration tại một thời điểm được chuẩn bị merge. Người làm migration tiếp theo lấy snapshot đã merge rồi sinh/review migration; không giải quyết conflict snapshot bằng chọn toàn bộ ours/theirs.
- Mỗi task UI phải thêm nhãn cần dùng và cập nhật API client/types; không trả việc đó cho task khác sau khi đánh Done.
- Mỗi PR giữ project build được và các luồng đang công bố có hành vi nhất quán. Chức năng nền chưa có UI không tự xuất hiện trong menu. Nếu phải thay luồng qua nhiều PR, PB-001 xác định cách cô lập luồng mới/cấu hình triển khai; không bật nửa luồng trên môi trường dùng chung.
- Nhánh tích hợp có thể chứa các bước chuẩn bị đã test nhưng chưa phải bản sẵn sàng phát hành. Chỉ bật toàn bộ luồng mới/nâng cấp dữ liệu thật sau điều kiện PB-030/031; việc các PR đã merge không tự cấp phép deploy.
- Nếu phát hiện lỗi vượt phạm vi task, tạo task bổ sung với tiêu chí/phụ thuộc cụ thể; không âm thầm mở rộng PR thành sửa toàn dự án.

## Đối chiếu và cập nhật backlog

[Kế hoạch chính](../PRD-REVISION-PLAN.md) giữ vai trò mô tả tổng thể. Mỗi card ghi gói P0–P6 hoặc QD liên quan để lần ngược lại yêu cầu.

PRD/sơ đồ đang được trợ lý khác chỉnh sửa. Nhận bản mới thì PB-001/PB-032 đối chiếu theo tên nghiệp vụ, không tự nhập lại chức năng liên kết Guest hoặc chỉ định song song do tài liệu cũ còn sót. Những sửa đổi nghiệp vụ thực sự mới phải được ghi rõ nguồn quyết định rồi mới cập nhật các task bị ảnh hưởng.

Trạng thái nhận việc, hoàn tất và PR được ghi trong từng task card. Kế hoạch bổ sung bản đồ/RTLS ngày 14/11/2026 chưa triển khai mã chức năng.

