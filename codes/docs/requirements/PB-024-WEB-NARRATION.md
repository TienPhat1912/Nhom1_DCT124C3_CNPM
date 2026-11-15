# PB-024 — Hướng dẫn và gọi số trên web

## Hành vi bàn giao

Màn hình hành trình tự phát mặc định, có checkbox tắt/bật và nút Nghe để nghe lại.
Tắt tự phát dừng cả request đang chờ và âm thanh; nút Nghe vẫn hoạt động.
Số đọc khớp số hiển thị trên thẻ hàng chờ: lượt khám V2 dùng số phiếu, luồng cũ
dùng số hàng chờ của bước nếu có. Phòng lấy từ snapshot của bước hiện hành.
Lời gọi vào khám chỉ được xác định khi trạng thái khám là `InConsultation`;
luồng hàng chờ dùng `queueStatus: Called`. Không coi mọi notification là gọi số.

`useVisitEvents.ts` đọc hợp đồng PB-023 trong lúc màn hình hành trình đang được
mount và tab hiển thị. Một request tại một thời điểm, khoảng nghỉ theo
`pollAfterMs` giới hạn 1–10 giây; lỗi dùng khoảng nghỉ 5 giây. Cursor giữ nguyên
chuỗi opaque. `invalidCursor` dẫn đến bootstrap lại. Đổi Visit/phiên và unmount
hủy request, timer và listener. Ẩn tab dừng polling nhanh, bỏ cursor; trở lại
foreground bootstrap trạng thái hiện hành. Polling Visit 5 giây sẵn có là đường dự phòng.

Trạng thái mới hoặc sự kiện mới chưa hết hạn yêu cầu tải lại Visit được dịch theo
ngôn ngữ hiện tại. Không đọc trực tiếp guidance tiếng Việt từ lịch sử sự kiện.
Sự kiện stale/hết hạn/khác Visit không tự kích hoạt phát lịch sử. Không phát lại
vì cùng event ID, polling hoặc chỉ thay `Visit.Version`. Khóa nội dung gồm phiên,
Visit, bước, nội dung/revision/ngôn ngữ, phòng, số phiếu và trạng thái vận hành;
chuyển trạng thái mới có thể phát lại, kể cả trở về một trạng thái từng có trước đó.

`useSpeech.ts` dùng chung cho các nút Nghe hiện hữu. Mỗi lần đổi ngữ cảnh hoặc
ngôn ngữ tăng generation, hủy request và tiếng cũ. Callback/request đến muộn
không sửa trạng thái hay phát tiếng cho ngữ cảnh mới. Sự kiện hết phiên cũng
dừng âm thanh. Giữ tham chiếu utterance trong thời gian phát.

Giọng đọc khớp ngôn ngữ **thực tế** của response, gồm fallback tiếng Việt.
Chờ tối đa 750 ms cho danh sách giọng được nạp; nếu không có giọng phù hợp thì
hiện lỗi và văn bản. Có xử lý lỗi `speak`, `onerror` và trường hợp engine im lặng
không bắt đầu trong 2,5 giây. Nội dung đã tải được giữ trong ngữ cảnh hiện tại
để lần nhấn Nghe lại gọi `speak` ngay trong thao tác của người dùng. Giao diện
luôn giữ hướng dẫn gốc trên màn hình, đồng thời hiện đầy đủ văn bản của lời đọc.

## Kiểm chứng

Chạy từ `codes/` trên Windows bằng `npm.cmd` nếu PowerShell chặn `npm.ps1`:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:narration:web
npm.cmd run test:narration:unit
npm.cmd run test:languages:unit
npx.cmd playwright test --config playwright.journey.config.ts
```

Browser suite PB-024 dùng API/speech mock, chạy cả desktop và viewport Pixel 7.
Bao phủ auto/manual/dedup, bật/tắt, sự kiện lặp/stale/hết hạn, tải giọng chậm,
hủy khi đổi bước/Visit/ngôn ngữ, request và callback cũ, logout, thiếu giọng,
autoplay bị từ chối/im lặng, exception đồng bộ, lỗi API và thử lại, foreground
và cleanup khi rời màn hình. Fixture không ghi database hoặc gọi dịch vụ ngoài.

Ca đo độ trễ lấy mốc cập nhật trạng thái đã commit trong **API mock**, chờ trạng
thái mới hiển thị qua polling thật của trình duyệt; ngưỡng 3.500 ms, số đo được
đính kèm report dưới tên `commit-to-display-ms`. Đây là bằng chứng vòng đời
polling/render local, không phải phép đo SQL commit hoặc SLA production.
Ảnh desktop/mobile: `artifacts/*-pb024-narration.png`.

Kết quả local 15/11/2026: 26/26 ca PB-024 trong lượt chạy toàn bộ, 2/2 ca bổ sung
cho số hàng chờ dịch vụ/luồng cũ, 2/2 ca chạy lại xác nhận hàng chờ cũ không gọi
khám V2 trước bác sĩ tiếp nhận; 12/12 ca hồi quy PB-021, 10/10 unit narration
và 3/3 unit ngôn ngữ đạt. Ca chờ giọng/hủy được chạy lặp thêm 6/6 lần trên hai
viewport. Typecheck, lint, build và kiểm tra định dạng các file mới đạt.
Vite build có cảnh báo chunk lớn hơn 500 kB. Mẫu độ trễ ở lượt chạy toàn bộ:
1.359–1.360 ms trên desktop/mobile, với API mock và polling foreground 1 giây.

## Giới hạn và nghiệm thu âm thanh thật

Probe Chrome headless local ngày 15/11/2026: có Web Speech API nhưng
`speechSynthesis.getVoices()` trả danh sách rỗng. Các ca mock xác minh hành vi
và ngôn ngữ, chưa xác nhận chất lượng/phát âm hoặc âm thanh tại loa thật.

Trước nghiệm thu phát hành, dùng trình duyệt có cài giọng phù hợp và loa:

1. Mở Visit của đúng bệnh nhân; kiểm tra số phiếu, phòng và hướng dẫn đọc tự động.
2. Bật trạng thái gọi vào khám; kiểm tra một lời gọi mới, không lặp khi polling.
3. Tắt tự phát, chuyển bước rồi nhấn Nghe; xác nhận nghe lại và nút dừng.
4. Đổi ngôn ngữ (bao gồm fallback), đổi Visit, ẩn tab và đăng xuất khi đang đọc;
   xác nhận tiếng cũ dừng và không đọc sai người.
5. Với autoplay bị trình duyệt chặn, xác nhận văn bản/lỗi hiện rõ và nhấn Nghe
   phục hồi sau thao tác người dùng. Kiểm tra riêng trên trình duyệt mục tiêu.

Không có migration, không thay nghiệp vụ hoặc authentication ngoài cleanup
âm thanh. Review, PR và merge là bước bàn giao riêng theo quy ước backlog;
không đánh Done chỉ dựa trên mã nguồn và kiểm thử local.
