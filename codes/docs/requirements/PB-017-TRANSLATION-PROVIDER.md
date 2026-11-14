# PB-017 — Provider dịch có nguồn, đích và ngữ cảnh

Base triển khai: `665a29a`, đã gồm PB-015/PB-016. Dependency hợp đồng PB-001 đã merge
PR #12 (`adaeaa3`). Task này cung cấp service dùng cho PB-018/019; chưa thêm endpoint,
không dịch khi submit/list và không thêm Description vào LocalizedResponseFilter.

## Hai hợp đồng trong ITranslationService

1. `Translate(IEnumerable<string>, language, ct)` giữ hợp đồng nội dung bệnh viện:
   nguồn luôn vi, dictionary/Azure sang ngôn ngữ Patient, TranslatedText có ngôn ngữ
   thực tế và fallback. LocalizedResponseFilter tiếp tục kiểm tra quyền trước dịch,
   giữ original, fallback nguyên nhóm và đồng nhất narration/contentKey.
2. `Translate(TranslationInput, ct)` là hợp đồng tường minh theo hồ sơ:

```csharp
// Sau khi endpoint đã xác thực Reception và phạm vi request:
var translation = await translator.Translate(new TranslationInput(
    request.Description, request.SourceLanguage!, "vi", request.Version,
    $"RegistrationRequest:{request.Id}:Description"), cancellationToken);
```

Context phải do server xây dựng từ loại hồ sơ/ID/trường, sau authorization. Không
nhận context hoặc sourceVersion tùy ý từ client; ngôn ngữ nguồn lấy từ nội dung đã
lưu, không suy từ profile/locale hiện tại. Service không tự cấp quyền truy cập hồ sơ.

Input giữ nguyên Original (không trim), nguồn/đích phải rõ và thuộc sáu ngôn ngữ
repository hỗ trợ, canonical hóa zh-Hans/zh-CN thành zh. SourceVersion nguyên dương,
Context không rỗng/tối đa 256 ký tự, Original tối đa 12.000 ký tự. V2 form vẫn dùng
phạm vi ngôn ngữ do hợp đồng tiếp nhận quy định; service giữ ko/ru cho dữ liệu cũ.

TextTranslation chỉ trả original/sourceLanguage/targetLanguage/sourceVersion/status/
translated/fallback, không trả Context hoặc credential. Khi target là vi, JSON khớp
DescriptionTranslationV2 đã chốt ở PB-001:

| Status | translated | fallback | Ý nghĩa |
|---|---|---|---|
| Translated | Chuỗi dịch có nội dung | false | Provider trả đúng ngôn ngữ đích |
| NotRequired | null | false | Cùng nguồn/đích (vi→vi) hoặc nội dung trống/chỉ khoảng trắng |
| Unavailable | null | true | Chưa cấu hình, timeout, provider lỗi hoặc response không hợp lệ |

Luôn giữ original để caller đọc được khi lỗi; không gán nguyên văn vào translated.
Response echo nguồn (kể cả chỉ bỏ khoảng trắng) không được coi là dịch thành công.
Hợp đồng này cũng hỗ trợ vi→en và các cặp khác trong tập ngôn ngữ đã hỗ trợ; không
đảo ngược dictionary Việt thành bộ dịch mô tả bệnh nhân vì có thể mơ hồ.

## Cache, timeout và quyền riêng tư

- Cache scoped chỉ giữ bản dịch trong RAM, dùng chung giới hạn 8 MiB hiện có.
  Key là hash JSON gồm loại hồ sơ/ID/trường qua Context, SourceVersion, hash nội dung
  nguyên văn, nguồn/đích, provider/endpoint và CacheVersion; không chứa ID/text rõ.
- Namespace cache scoped tách khỏi cache nội dung bệnh viện. Sửa mô tả, version,
  đổi hồ sơ/loại hồ sơ, nguồn/đích hoặc provider version không tái dùng bản dịch cũ.
  Không cache thất bại; lần retry rõ ràng sau đó có thể thành công.
- Single-flight tránh gọi provider trùng cho cùng nội dung/context khi thành công.
  Timeout bao gồm chờ gate, HTTP và khoảng nghỉ retry. Default 5 giây, clamp 1–10.
- Scoped MaxAttempts mặc định 2, clamp 1–3; chỉ retry lỗi mạng/408/429/5xx trong ngân
  sách timeout. RetryDelayMilliseconds mặc định 100, clamp 0–500. Không retry 400/401
  hoặc response sai JSON/ngôn ngữ; hết timeout trả Unavailable. Caller cancellation
  được truyền ra ngoài và giải phóng gate, không giả là provider lỗi.
- Log chỉ loại exception, không text, context, key, body provider hoặc message của
  exception. HTTP chỉ gửi văn bản và nguồn/đích, không gửi ID/version/Context.

## Provider thật và giả lập

Azure dùng POST `/translate?api-version=3.0&from=...&to=...`, chỉ định nguồn rõ và
ánh xạ zh→zh-Hans; xác thực ở server. Kiểm tra đủ số kết quả, đúng target và text
không rỗng. HTTPS bắt buộc ngoài loopback; endpoint không chứa credential/query/
fragment. Cấu hình key/region/endpoint theo [LANGUAGES.md](../guides/LANGUAGES.md)
và [Microsoft Translate API](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/v3/translate).

Các setting bổ sung: `Translation__CacheVersion`, `Translation__MaxAttempts`,
`Translation__RetryDelayMilliseconds`; `Translation__TimeoutSeconds` và
`Translation__CacheMinutes` giữ tên hiện có. Tăng CacheVersion khi đổi cấu hình/model
cần làm hết hiệu lực cache. Không có key Azure thì chỉ dictionary Việt→đích hoạt động;
mô tả en/zh/ja→vi trả Unavailable rõ ràng.

Provider test là HttpMessageHandler/IHttpClientFactory giả trong tests/translation,
không cần mạng hoặc key thật. Không có provider Simulation được bật trong sản phẩm.

## Kiểm chứng

```powershell
npm run test:translation
dotnet build -c Release --no-restore
npm run typecheck
npm run lint
```

Program.cs giữ toàn bộ hồi quy hospital translation; ScopedTranslationChecks.cs
kiểm tra hai chiều, vi→vi, raw original, cache/concurrency/version/context, retry/
timeout/cancellation, response sai/echo, DTO và log privacy. CI hiện có đã gọi
`npm run test:translation`, không cần thêm phase mới. Không migration/package mới.
Azure live vẫn cần môi trường có credential; fake provider không chứng minh chất
lượng dịch thực tế. Tích hợp và kiểm tra quyền tại chi tiết request/assistance
tiếp tục ở PB-018/019.
