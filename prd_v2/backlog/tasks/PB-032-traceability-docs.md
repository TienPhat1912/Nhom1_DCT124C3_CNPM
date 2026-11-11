# PB-032 Đồng bộ tài liệu kỹ thuật và 18 Use Case

| Trường | Giá trị |
|---|---|
| Trạng thái | Backlog |
| Người nhận | Chưa nhận |
| Reviewer | Chưa phân công |
| Nhóm | Tài liệu |
| Ưu tiên | P1 |
| Cỡ việc | S |
| Phụ thuộc cần merge | [PB-031](./PB-031-acceptance-release.md) |
| Đối chiếu kế hoạch | P6 |
| Branch gợi ý | `feat/pb-032-traceability-docs` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Nhận PRD/sơ đồ trợ lý tài liệu đã sửa; đối chiếu chức năng thực tế, cập nhật truy vết/API/hướng dẫn demo.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: docs/requirements/TRACEABILITY.md, TRACEABILITY.csv; docs/architecture/API.md, openapi.json, DECISIONS.md; README và docs/guides/.

## Tiêu chí chấp nhận

- [ ] 18 UC còn lại và QD-01..06 có ánh xạ API/UI/test; map theo tên nếu PRD đánh số lại; loại liên kết Guest khỏi phạm vi mới.
- [ ] Tài liệu không còn hướng dẫn kích hoạt QR, chỉ định song song/sửa hủy, tự hoàn tất nhà thuốc hoặc đổi bác sĩ giữa lượt.
- [ ] Ghi RTLS là mục tiêu, phạm vi bốn ngôn ngữ, cách nâng cấp/khôi phục và bằng chứng nghiệm thu thực tế; không ghi đè PRD đang do trợ lý khác biên soạn.

## Kiểm chứng bắt buộc

Kiểm tra link, tên endpoint, chạy thử hướng dẫn demo với bản build đã nghiệm thu; không cần thêm test cho văn bản.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Giữ PRD-REVISION-PLAN.md làm tài liệu đối chiếu; không sửa PRD DOCX hoặc vẽ lại sơ đồ nếu chưa nằm trong công việc được giao.

## Phối hợp và phụ thuộc

Một người tổng hợp tài liệu sau merge chức năng; đối chiếu đúng phiên bản PRD nhận từ người dùng.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-032, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

