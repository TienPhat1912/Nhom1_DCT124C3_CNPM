# Ngôn ngữ và nội dung tiếng Việt

Ứng dụng hỗ trợ **Việt (`vi`), Anh (`en`), Trung giản thể (`zh`), Hàn (`ko`), Nhật (`ja`) và Nga (`ru`)** trên web và Android. Nhân viên nhập nội dung bệnh viện bằng tiếng Việt. API kiểm tra quyền truy cập, đọc bản gốc, dịch sang ngôn ngữ được chọn và trả văn bản cho giao diện/giọng đọc trên thiết bị.

## Chạy khi chưa có khóa dịch

Mặc định `TRANSLATION_PROVIDER=Dictionary`. Nhãn giao diện, danh mục khoa trên bản đồ, các điểm mốc và hướng dẫn mẫu có bản dịch đi kèm mã nguồn. Không cần tài khoản dịch để thử các nội dung này.

**Nội dung tự nhập chưa có trong từ điển cần Azure Translator.** Khi chưa cấu hình hoặc dịch vụ lỗi, API trả nguyên văn tiếng Việt, `language`/`contentLanguage=vi`, `fallback=true`. Giao diện báo đang dùng bản gốc; giọng đọc dùng ngôn ngữ của văn bản thực tế. Không dùng tiếng Anh làm ngôn ngữ thay thế cho Trung/Hàn/Nhật/Nga.

## Bật dịch nội dung tự nhập

Tạo tài nguyên Azure Translator, lấy key và region tại **Keys and Endpoint** theo [hướng dẫn REST của Microsoft](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/quickstart/rest-api). Điền vào `codes/.env` trên máy chạy API:

```dotenv
TRANSLATION_PROVIDER=Azure
TRANSLATION_KEY=YOUR_TRANSLATOR_KEY
TRANSLATION_REGION=YOUR_RESOURCE_REGION
TRANSLATION_ENDPOINT=https://api.cognitive.microsofttranslator.com
```

Không đưa key vào mã nguồn, `EXPO_PUBLIC_*`, `VITE_*`, trình duyệt hoặc commit. `.env` đã được Git bỏ qua. `region` cần khớp tài nguyên Azure; endpoint trên dùng Text Translation API v3, không phải URL của Speech API.

Tài nguyên Translator riêng loại **Global** có thể để trống region; tài nguyên theo vùng hoặc đa dịch vụ cần region tương ứng. Cấu hình trên dùng endpoint công khai toàn cầu. Nếu tài nguyên dùng private endpoint/VNet, cần cấu hình endpoint và mạng riêng theo tài liệu Azure trước khi bật.

Nếu chạy Docker, từ `codes/`:

```powershell
docker compose up -d --build api web
```

Nếu chạy source, khởi động lại bằng `scripts/dev/run-api.ps1` hoặc `scripts/dev/start-dev.ps1`; hai script đọc cấu hình dịch từ `.env`. Khi tự chạy `dotnet`, dùng các biến `Translation__Provider`, `Translation__Key`, `Translation__Region`, `Translation__Endpoint` tương ứng.

Chỉ nội dung bệnh viện cần dịch được gửi đến nhà cung cấp sau khi API kiểm tra quyền truy cập. Tên người, mã phòng, mã hồ sơ, dữ liệu định danh và bản gốc lồng trong `original` không được đưa vào danh sách trường dịch. Nhân viên cần tránh chèn thông tin định danh không cần thiết vào các đoạn hướng dẫn tự do. Bộ nhớ đệm bản dịch nằm trong RAM của API, tối đa 8 MiB, mặc định hết hạn sau 60 phút; không ghi bản dịch hoặc âm thanh xuống SQL. Log lỗi chỉ ghi loại lỗi, không ghi văn bản hay key.

## Dữ liệu và migration

- `Department`, `Location`, `HospitalService` chỉ lưu `NameVi`; bỏ cột `NameEn`.
- `GuidanceTemplate`, `HospitalRoute`, `SummaryVersion`, `FollowUpRecommendation`, `ReceptionMessage` có ràng buộc SQL `Language = 'vi'`.
- Tên người, mã nghiệp vụ, trạng thái kỹ thuật và ngôn ngữ ưa thích của bệnh nhân được giữ nguyên. Nội dung bệnh nhân tự khai không bị dịch rồi ghi đè.
- Bản gốc chuyên môn vẫn phải được bác sĩ xác nhận trước khi công bố. Bản dịch máy được ghi rõ trên giao diện và có thể xem lại bản gốc tiếng Việt. Luồng nhập bản dịch riêng và bảng `SummaryTranslation` được thay bằng dịch khi truy xuất.
- Snapshot điểm đến mới chỉ chứa tên tiếng Việt; migration loại bỏ `nameEn` khỏi snapshot cũ, giữ mã phòng/tầng/tòa.

Migration `VietnameseSource` chạy trong transaction. Các mẫu tiếng nước ngoài chỉ được thay bằng mẫu tiếng Việt khi khớp **key, revision và category**; liên kết tin nhắn tiếp nhận được chuyển sang mẫu nguồn. Các tuyến đường cũ cần có tuyến tiếng Việt tương ứng.

**Migration dừng và rollback** nếu còn tóm tắt khám, khuyến nghị tái khám hoặc mẫu/tuyến/tin nhắn tiếng nước ngoài không có bản gốc tiếng Việt tương ứng. Cần rà soát và chuyển nội dung đó sang tiếng Việt trước khi chạy lại; không được chỉ đổi nhãn `Language` mà giữ nguyên văn bản nước ngoài. Trước khi áp dụng vào database đang dùng, sao lưu để giữ lịch sử các cột/bảng bản dịch sẽ được loại bỏ. Các bài kiểm thử dùng database `HospitalAcceptance_*` riêng; việc kiểm thử không tự migrate database demo đang sử dụng.

## Hợp đồng API

Chọn ngôn ngữ bằng `?language=ja` hoặc header `X-Hospital-Language: ja`; tham số truy vấn ưu tiên hơn header. Yêu cầu narration dùng `language` trong body. Mã ngoài danh sách được trả `422 languageUnsupported`; nội dung nhân viên có language khác `vi` được trả `422 sourceLanguageRequired`.

Các tên hiển thị dùng `name`, `departmentName`; `nameVi`/`departmentNameVi` vẫn là bản gốc. `nameEn` trong một số response là alias tương thích trả tên gốc, **không còn là cột SQL hoặc bản dịch tiếng Anh**. Client mới dùng `displayName`/trường tên đã dịch. `emergency` là hướng dẫn khẩn cấp đã được chọn ngôn ngữ.

Nhóm nội dung trả `requestedLanguage`, `translationStatus` (`source`, `translated`, `unavailable`) và `fallback`. Một tóm tắt khám được dịch cùng nhóm: nếu một trường không dịch được, toàn bộ nhóm dùng tiếng Việt để tránh đọc lẫn ngôn ngữ. `original` luôn giữ bản gốc.

Narration dùng chính bản dịch của các trường hiển thị. Client gửi cả `sourceRevision` và `contentKey`; nếu bản nguồn hoặc bản dịch đã thay đổi, API trả `409 sourceChanged` để tải lại trước khi phát. Tên giọng đọc: `vi-VN`, `en-US`, `zh-CN`, `ko-KR`, `ja-JP`, `ru-RU`. Máy cần cài giọng tương ứng; thiếu giọng thì báo lỗi âm thanh và tiếp tục hiển thị văn bản.

## Kiểm thử

PB-017 bổ sung overload `ITranslationService.Translate(TranslationInput, ct)` cho
nguồn/đích tường minh và cache theo hồ sơ/version. Nguồn khác Việt sang Việt dùng
Azure sau authorization; không tự dịch Description qua response filter. Khi lỗi,
`translated=null`, `status=Unavailable`, `fallback=true`, original giữ nguyên văn.
Vi→vi trả NotRequired. Cấu hình scoped retry bằng `Translation__MaxAttempts` (mặc định
2), `Translation__RetryDelayMilliseconds` (100 ms); timeout là ngân sách toàn lệnh.
`Translation__CacheVersion` làm hết hiệu lực scoped cache khi đổi model/provider.
Các setting này dùng tên cấu hình .NET trực tiếp, không thêm tên dotenv mới vào loader.
Chi tiết, ví dụ tích hợp và giới hạn: [PB-017](../requirements/PB-017-TRANSLATION-PROVIDER.md).

Chạy từ `codes/`:

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:languages:unit
npm run test:narration:unit
npm run test:translation
npx playwright test --config playwright.languages.config.ts
powershell -ExecutionPolicy Bypass -File scripts/test/test-api.ps1
```

`test:translation` dùng HTTP provider giả lập để kiểm tra cache, sửa nội dung, lỗi HTTP/timeout/response sai, quyền truy cập và tính đồng nhất giữa hiển thị–thuyết minh. Không gọi Azure hay cần key. API acceptance kiểm tra sáu ngôn ngữ, database chỉ có nguồn tiếng Việt và từ chối đọc hồ sơ người khác. Khả năng dịch của tài khoản Azure thật cần được thử lại sau khi bạn cấu hình key.
