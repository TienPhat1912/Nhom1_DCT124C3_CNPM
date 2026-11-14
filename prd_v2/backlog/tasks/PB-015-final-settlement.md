# PB-015 Quyết toán cuối và đóng Visit cùng Journey

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — triển khai/test local hoàn tất; chờ review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Thu ngân |
| Ưu tiên | P0 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-014](./PB-014-complete-examination.md) |
| Đối chiếu kế hoạch | P3b |
| Branch gợi ý | `feat/pb-015-final-settlement` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Danh sách Visit đủ điều kiện, hai outcome Final/NoPaymentRequired và giao dịch đóng Visit/Journey.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Journeys/JourneyEndpoints.cs, Workflow.cs; apps/web/src/StaffClinical.tsx; tests/api/.

## Tiêu chí chấp nhận

- [x] Không ghi quyết toán cuối trước khi khám Completed và dịch vụ xong; quyền Cashier đúng phạm vi.
- [x] Final và NoPaymentRequired đều đóng Visit/Journey cùng giao dịch; payment riêng lẻ nếu còn hỗ trợ không đóng Visit.
- [x] Journey mới không có bước nhà thuốc chờ bệnh nhân bấm hoàn tất; API complete-guidance/pharmacy cũ không làm sai quy tắc. Không tự chuyển dữ liệu legacy thành đã hoàn tất.

## Kiểm chứng bắt buộc

API premature settlement, both outcomes, duplicate/rollback, old endpoint bypass; browser Cashier và Patient đọc trạng thái.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không tính hóa đơn, thanh toán online hoặc bảo hiểm.

## Phối hợp và phụ thuộc

Workflow.cs dùng chung; đây là gói chốt cuối vòng nghiệp vụ trước UI Journey tổng thể.

PB-014 đã merge qua PR #28 (`aa1eb1e`); task card PB-014 còn ghi trạng thái local cũ.
Hợp đồng và cách chạy: [PB-015 — quyết toán cuối](../../../codes/docs/requirements/PB-015-FINAL-SETTLEMENT.md).

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai trên `feat/pb-015-final-settlement`, base `aa1eb1e` (PB-014 PR #28).
Chưa mở PR hoặc merge; không đánh Done trước review và merge theo quy ước backlog.
File plan tạm đã được xóa theo yêu cầu người dùng; giữ tài liệu hợp đồng và kiểm thử.

- Backend `FinalSettlements`: queue lọc trước phân trang, POST input nghiêm ngặt,
  predicate chung cho list/capability/command; kiểm tra quyền trước replay và trong
  transaction. Hai outcome đóng Visit/Journey/Settlement cùng audit/notification/receipt.
- Giữ version, revision, replay/rollback; WorkRevision và phiếu không đổi khi quyết toán.
  API đọc trả thời điểm đóng UTC. Không có migration hoặc package mới.
- Chặn settlement/pharmacy/complete-guidance legacy cho V2 trước receipt; Intermediate
  và tiến độ chuyên môn không tự đóng dữ liệu đã quyết toán sớm. Giữ lịch sử nhà thuốc.
- Workspace Cashier riêng, hai outcome, review lại sau conflict, empty/error/pagination;
  Patient thấy Closed/Completed qua polling. Nhãn sáu locale đang dùng.
- [API tests](../../../codes/tests/api/final-settlement.test.mjs),
  [browser tests](../../../codes/tests/browser/final-settlement.spec.ts),
  [runner fixture local](../../../codes/tests/final-settlement/run.ps1).
  CI native có phase PB-015; OpenAPI/API.md đã cập nhật endpoint thật.

### Kiểm chứng local ngày 14/11/2026

Các lệnh chạy từ `codes/`; SQL local `.\SQLEXPRESS`, Windows authentication,
database fixture mới riêng mỗi suite, giữ fixture sau chạy; không ghi database demo/online.

| Lệnh/kịch bản | Kết quả |
|---|---|
| `tests/final-settlement/run.ps1 -SqlServer '.\SQLEXPRESS' -Regression -Capture` | PASS; API PB-015 6/6, browser desktop/Pixel 7 viewport 2/2 |
| API hồi quy PB-014/013/012/011/010/008 | PASS 4/4, 7/7, 6/6, 6/6, 5/5, 7/7 |
| API legacy với V2 tắt | PASS 24/24, gồm quyết toán sớm/Intermediate/nhà thuốc lịch sử và endpoint V2 bị tắt |
| Lượt chốt runner `-Capture` | PASS; API 6/6, browser 2/2; thêm thiếu ClinicalRecord, Pharmacy bất nhất, scope khi Visit còn Active và hai Cashier khác nhau cạnh tranh |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS; web/mobile/shared/contracts; build cảnh báo chunk lớn hơn 500 kB |
| `npm run test:languages:unit` | PASS 3/3 |
| `dotnet build backend/Hospital.Api/Hospital.Api.csproj -c Release --no-restore` | PASS, 0 warning/error |
| `dotnet-ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build` | PASS, không thay model |
| `git diff --check`, parser PowerShell, OpenAPI references | PASS |

Fixture lượt chốt `HospitalAcceptance_1794654198825`; lượt hồi quy bắt đầu từ
`HospitalAcceptance_1794653984144`, mỗi suite dùng database mới. Ảnh synthetic trong
`codes/artifacts/chromium-{desktop,mobile}-pb015-{Final,NoPaymentRequired,patient}.png`;
đã xem ảnh mobile Cashier/Patient, không thấy lỗi bố cục. Runner dừng process và
khôi phục env sau chạy. Artifact/log/credential không đưa vào commit.

Các lần chạy đầu sửa lỗi fixture (SQL instance mặc định, tên bảng, profile Guest,
parse UUID/JSON của sqlcmd Windows) và điều hướng browser từ Overview sang Journey.
Đã chạy lại đạt. Sandbox cần escalation cho SQL/browser/child process. Không chạy
toàn bộ GitHub CI, browser legacy đầy đủ, Android hoặc migration upgrade regression
trong phiên này; không thay schema/mobile. `dotnet-ef` dùng tool global sẵn trên máy.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-015, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

