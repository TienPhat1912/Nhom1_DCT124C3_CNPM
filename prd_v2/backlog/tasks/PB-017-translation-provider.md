# PB-017 Dịch văn bản có ngôn ngữ nguồn và đích

| Trường | Giá trị |
|---|---|
| Trạng thái | In progress — provider/test local hoàn tất; chờ review/PR |
| Người nhận | Codex (theo yêu cầu người dùng) |
| Reviewer | Chưa phân công |
| Nhóm | Dịch và hỗ trợ |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-001](./PB-001-contracts.md) |
| Đối chiếu kế hoạch | P4 |
| Branch gợi ý | `feat/pb-017-translation-provider` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Mở rộng hợp đồng dịch cho nguồn bất kỳ trong phạm vi ngôn ngữ hỗ trợ sang Việt, giữ đường dịch Việt sang ngôn ngữ bệnh nhân.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: backend/Hospital.Api/Content/TranslationService.cs; tests/translation/; docs/guides/LANGUAGES.md.

## Tiêu chí chấp nhận

- [x] Hợp đồng tách bản gốc, bản dịch, nguồn/đích, trạng thái fallback; không trả bản gốc với nhãn đã dịch.
- [x] Cache phân biệt nguồn/đích/phiên bản và ngữ cảnh hồ sơ; timeout/retry không ghi nội dung nhạy cảm vào log.
- [x] Có provider giả lập cho test và cấu hình provider thật; không đưa việc dịch mô tả vào response filter chung.

## Kiểm chứng bắt buộc

Translation tests với vi→en, en/zh/ja→vi, vi→vi, timeout, cache invalidation và cô lập ngữ cảnh; hồi quy nội dung bệnh viện.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không dịch ngay khi submit/list; tích hợp chi tiết request/assistance ở PB-018/019.

## Phối hợp và phụ thuộc

TranslationService dùng chung; merge trước các task tích hợp.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

Triển khai trên `feat/pb-017-translation-provider`, tiếp từ `665a29a` đã có PB-015/016.
Dependency PB-001 đã merge PR #12 (`adaeaa3`), dù task card còn trạng thái local cũ.
Chưa mở PR hoặc merge; không đánh Done trước review và merge.

- [Hợp đồng, ví dụ gọi và cấu hình PB-017](../../../codes/docs/requirements/PB-017-TRANSLATION-PROVIDER.md).
- Thêm TranslationInput/TextTranslation và overload ITranslationService có nguồn,
  đích, sourceVersion, context do server cung cấp. Original giữ nguyên whitespace;
  Translated/NotRequired/Unavailable khớp DescriptionTranslationV2 khi target vi.
- Scoped cache hash theo loại/ID/trường, version, nội dung, nguồn/đích và provider
  identity/CacheVersion; không giữ original/context dạng rõ trong cache key.
  Cache chỉ giữ bản dịch thành công, có single-flight, timeout toàn lệnh và retry
  giới hạn cho lỗi tạm thời. Log chỉ loại lỗi; cancellation được truyền đúng.
- Dùng chung HTTP Azure helper với đường dịch bệnh viện hiện có; giữ dictionary,
  original, fallback nhóm và narration/contentKey. Không thêm endpoint hay đưa
  Description vào filter; tích hợp request/assistance tiếp tục ở PB-018/019.
- [ScopedTranslationChecks](../../../codes/tests/translation/ScopedTranslationChecks.cs)
  dùng HTTP provider giả, được gọi bởi `npm run test:translation` và CI hiện có.
  Không migration/package mới; key thật không có trong source/client/test.

### Kiểm chứng local ngày 14/11/2026

| Lệnh/kịch bản từ codes/ | Kết quả |
|---|---|
| `npm run test:translation` | PASS: vi→en, en/zh/ja/ko/ru→vi, vi→vi, canonical locale, raw original, DTO, cache hit/concurrency/context/version/source/target, timeout/retry/cancellation và log privacy |
| Failure matrix | PASS: HTTP 400/401/403/429/503, network, timeout, response sai/empty/wrong language, echo/echo-trim, endpoint không hợp lệ; retry sau lỗi thành công |
| Hồi quy translation/filter | PASS: sáu locale, dictionary/provider cache, chỉnh nguồn, quyền trước dịch, original và narration binding/fallback nguyên nhóm |
| `dotnet build -c Release --no-restore` | PASS, 0 warning/error |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS; cảnh báo chunk web lớn hơn 500 kB |
| `dotnet-ef migrations has-pending-model-changes --project backend/Hospital.Api --configuration Release --no-build` | PASS, model không thay đổi |
| `scripts/deploy/publish-azure.ps1` | PASS; chỉ tạo release local, không deploy |
| `scripts/test/ci-native.ps1 -SqlServer '.\SQLEXPRESS'` | PASS toàn bộ phase SQL/migration/API/browser/provider của script CI; browser mặc định 46/46 và các suite PB-005/006/008/010–016 đều đạt |
| Hiệu năng 10.000 steps, 20 người dùng đồng thời | PASS, 620 request không lỗi; p95 từng nhóm dưới 2.000 ms |
| `git diff --check`, liên kết tài liệu | PASS |

Acceptance dùng SQL `.\SQLEXPRESS` Windows authentication, database fixture riêng
`HospitalAcceptance_1794657147055` và các database migration/phase riêng do script
ghi lại; translation migration fixture `HospitalAcceptanceMigration_1794657210530`.
Giữ fixture và khôi phục env/dừng process theo runner. Log/artifact ở codes/artifacts
không đưa vào commit. Không ghi database demo/online.

Chưa kiểm tra Azure live bằng credential thật hoặc chất lượng dịch thực tế; tests
provider không gọi mạng. Script CI chạy local với SQL Express, không đồng nhất môi
trường GitHub Actions/LocalDB. Kết quả local không phải xác nhận CI remote đã xanh.
Tích hợp authorization tại các endpoint detail thuộc PB-018/019, chưa thực hiện ở đây.

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-017, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

