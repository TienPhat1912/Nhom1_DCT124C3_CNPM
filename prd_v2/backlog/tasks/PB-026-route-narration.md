# PB-026 Chỉ đường và thuyết minh từng chặng theo vị trí mô phỏng

| Trường | Giá trị |
|---|---|
| Trạng thái | Implemented local — đã tích hợp, chờ gate APK/thiết bị và reviewer/merge |
| Người nhận | Codex (tích hợp và kiểm chứng local ngày 15/11/2026) |
| Reviewer | Chưa phân công |
| Nhóm | Bản đồ |
| Ưu tiên | P1 |
| Cỡ việc | M |
| Phụ thuộc cần merge | [PB-024](./PB-024-web-narration.md), [PB-025](./PB-025-mobile-narration.md), [PB-034](./PB-034-rtls-simulation.md) |
| Đối chiếu kế hoạch | P5a / P6 |
| Branch gợi ý | `feat/pb-026-route-narration` |
| PR | Chưa mở |

## Kết quả cần bàn giao

Tích hợp bản đồ PB-033 và nguồn vị trí mô phỏng PB-034 với đích Journey và TTS web/mobile. Chu kỳ: nhận vị trí → tính tuyến → đọc hướng dẫn → di chuyển khoảng 5 giây tới trước điểm chuyển hướng → dừng tối thiểu 1 giây và đọc hướng dẫn mới → lặp đến đích. Chi tiết chu kỳ và ngoại lệ nằm ngay trong task này; hợp đồng nguồn vị trí nằm trong [PB-034](./PB-034-rtls-simulation.md).

Phạm vi được mở rộng theo yêu cầu người dùng ngày 14/11/2026; thay thế giới hạn cũ về không mô phỏng RTLS/hướng dẫn theo vị trí. RTLS thật vẫn là mục tiêu tương lai.

## Chu kỳ mô phỏng và thuyết minh

Mặc định khi mở chỉ đường, chọn chế độ mô phỏng và nhận vị trí ban đầu từ một điểm demo hợp lệ đã cấu hình, ví dụ sảnh/cổng. Người trình bày được đổi điểm xuất phát. Vị trí chỉ tồn tại trong phiên mô phỏng; mở phiên mới trở về điểm mặc định, không dùng vị trí của người dùng trước. Chế độ thủ công vẫn có thể chọn riêng.

1. **Nhận vị trí:** nguồn mô phỏng trả tọa độ, tòa, tầng, thời điểm cập nhật và trạng thái khả dụng. Nếu thiếu vị trí hoặc đích hợp lệ, hiển thị lý do và chờ, không tự chạy.
2. **Tính tuyến:** tìm đường từ vị trí hiện tại đến đích Journey, sinh danh sách chặng và điểm hướng dẫn. Phát hướng dẫn đầu, ví dụ “Đi thẳng dọc hành lang đến ngã rẽ bên phải”.
3. **Di chuyển:** sau khi hướng dẫn kết thúc, marker di chuyển liên tục dọc đường đi của chặng trong khoảng **5 giây**, dừng ngay trước điểm chuyển hướng. Thời gian này là tốc độ trình diễn cho mỗi chặng, không phải ước lượng thời gian đi bộ thật; chặng dài và ngắn có thể cùng mất 5 giây. Chặng cuối cũng áp dụng quy tắc này.
4. **Dừng và cập nhật:** giữ marker tại điểm hướng dẫn ít nhất **1 giây** để người xem nhận biết; nguồn mô phỏng vẫn gửi trạng thái vị trí mới, không bị coi là mất tín hiệu do đang đứng yên. Đây là bước cập nhật vị trí mô phỏng, không phải đo/nhận diện bằng cảm biến.
5. **Hướng dẫn mới:** phát “Rẽ phải, sau đó đi thẳng đến thang máy…” hoặc lời nhắc đổi tầng/tòa. Tiếp tục khi cả thời gian dừng tối thiểu và câu đọc đã kết thúc. Nếu tắt tự phát/tắt tiếng, chỉ chờ thời gian dừng; vẫn có nội dung chữ và nút nghe lại. Nếu trình duyệt chặn tự phát, hiển thị thao tác bật âm thanh nhưng không khóa mô phỏng.
6. **Lặp lại:** thực hiện thao tác rẽ rồi di chuyển chặng tiếp. Đổi tầng bằng một bước chuyển có nhãn rõ, không vẽ marker bay xuyên tầng; tự mở tầng/tòa đang đứng. Đến đích thì dừng, thông báo đến nơi đúng một lần và không tự hoàn tất khám/dịch vụ/Journey.

Ví dụ: đọc “Đi thẳng đến ngã rẽ” → đi 5 giây → dừng tối thiểu 1 giây, đọc “Rẽ phải…” → đi 5 giây → dừng, đọc “Đi thang máy lên tầng 2…” → chuyển tầng → tiếp tục đến đích.

Các giá trị 5 giây/chặng và 1 giây/dừng là mặc định cấu hình của demo, không nhân bản hằng số giữa web/mobile. Tốc độ cập nhật marker phải đủ mượt và không dùng 5 giây làm khoảng cách giữa hai lần phát vị trí.

## Trạng thái và ngoại lệ

- Các trạng thái điều khiển: chờ vị trí → tính tuyến → hướng dẫn → di chuyển → dừng tại điểm hướng dẫn → hướng dẫn tiếp → đến đích. Có nhánh tạm dừng, mất tín hiệu, không có tuyến và kết thúc.
- Điều khiển: bắt đầu/tiếp tục, tạm dừng, đặt lại, đổi điểm xuất phát; thao tác thử lệch tuyến và mất/khôi phục tín hiệu. Tạm dừng giữ tiến độ và dừng lời đọc; tiếp tục phát lại chỉ dẫn hiện tại rồi chạy tiếp, không nhân đôi timer.
- Có tín hiệu nhưng đứng yên khác với mất tín hiệu. Khi mất tín hiệu hoặc timestamp cũ vượt ngưỡng cấu hình, dừng chuyển động/hướng dẫn mới và hiển thị trạng thái. Khôi phục bằng vị trí mới hợp lệ rồi tính lại tuyến; không dịch chuyển bù quãng đường trong thời gian mất tín hiệu.
- Khi thử lệch tuyến, đặt marker vào một vị trí hợp lệ khác trên đồ thị và tính lại từ đó; không dùng vị trí ngoài hành lang để giả lập một tuyến hợp lệ.
- Journey đổi đích: hủy câu đọc và tiến độ tuyến cũ, giữ vị trí hiện tại, tính tuyến mới. Nếu đang giữa cạnh thì dùng điểm hiện tại trên cạnh làm điểm đầu tạm, không nhảy về điểm xuất phát.
- TTS Journey/gọi số và TTS bản đồ dùng chung bộ điều phối PB-024/025. Thông báo ưu tiên cao có thể ngắt dẫn đường: dừng chuyển động và chỉ tiếp tục sau khi trả quyền phát. Có timeout cấu hình cho TTS lỗi/không trả sự kiện kết thúc; dọn hàng đợi và cho phép tiếp tục bằng chữ, không chờ vô hạn.
- Đóng chỉ đường, đổi tài khoản/phiên hoặc đưa app/tab vào nền: dừng timer và lời đọc, không chạy ngầm. Trở lại cần tiếp tục rõ ràng; callback cũ không được cập nhật phiên mới. Chế độ thủ công không tự di chuyển marker.
- Tuyến bị chặn/không tồn tại, phòng chưa được ánh xạ hoặc đích bị hủy: dừng và báo lý do. Không tự tạo tọa độ cho phòng chưa ánh xạ.

## Phạm vi mã nguồn

Đường dẫn tính từ `codes/`: `packages/shared/src/routeNarration.ts`, `audioCoordinator.ts`, `deviceAudio.ts`, `positionSource.ts`; `apps/{web,mobile}/src/{useRouteNarration,routeSpeechAdapter,SimulationMap,usePositionDemo,useRouteSpeech}`; Journey narration và runtime của hai nền tảng. Danh sách hợp đồng và kiểm chứng: [bàn giao PB-026](../../../codes/docs/requirements/PB-026-ROUTE-NARRATION.md).

## Tiêu chí chấp nhận

Checklist dưới đây ghi kết quả mã nguồn và kiểm thử tự động local, gồm
component/adapter native với Expo Speech giả. Gate APK/âm thanh thiết bị thật
vẫn chưa đạt vì thiếu SDK 36; không dùng checklist này để bỏ qua quy ước Done.

- [x] Journey đổi từ phòng khám sang dịch vụ/về phòng cũ thì tuyến/âm thanh cũ hết hiệu lực; chỉ phát khi có tuyến hợp lệ.
- [x] TTS bản đồ và Journey không đọc chồng; tự phát tôn trọng lựa chọn tắt, vẫn nghe lại được.
- [x] Giữ chọn vị trí thủ công bên cạnh chế độ Mô phỏng RTLS; thiếu vị trí phòng thì báo chưa có tuyến, không tự tạo tọa độ hoặc hoàn tất khám.
- [x] Mở chỉ đường nhận điểm đầu từ nguồn mô phỏng, đích từ Journey và phát chỉ dẫn đầu; nguồn không khả dụng hoặc không có tuyến thì dừng và báo lý do.
- [x] Mỗi điểm hướng dẫn phát một lần theo phiên/tuyến/chặng. Chờ cả dừng tối thiểu 1 giây và câu đọc kết thúc mới cho bộ mô phỏng chạy tiếp; chỉ dẫn rẽ phát trước khi marker thực hiện rẽ. Đổi tầng/tòa có lời nhắc và đổi mặt bằng tương ứng.
- [x] Tắt tự phát/tắt tiếng vẫn có chỉ dẫn chữ và tiếp tục sau thời gian dừng; nghe lại không tạo chặng/timer mới. TTS lỗi/timeout hoặc tự phát bị chặn không khóa mô phỏng vô hạn; có thao tác bật âm thanh khi cần.
- [x] Thông báo Journey/gọi số ưu tiên cao ngắt lời đọc và dừng chuyển động; sau khi trả quyền phát, tiếp tục chỉ dẫn còn hiệu lực. Đổi đích giữa cạnh giữ vị trí hiện tại, hủy lời đọc/callback tuyến cũ rồi tính lại.
- [x] Pause/resume, mất/stale tín hiệu, lệch tuyến, đóng bản đồ, đổi phiên và nền/foreground tuân mục Trạng thái và ngoại lệ; không để audio/timer cũ chạy. Đến đích thông báo đúng một lần, không tự hoàn tất nghiệp vụ.

## Kiểm chứng bắt buộc

Map/narration unit và browser tests cho chu kỳ 5 giây/dừng tối thiểu 1 giây, câu đọc dài, muted/autoplay blocked/TTS timeout, ưu tiên gọi số, đổi đích giữa chặng, mất tín hiệu, đến đích và hủy phiên. Native kiểm tra cùng tầng/khác tầng/khác tòa, đổi đích, thiếu vị trí và nền/foreground; lưu ảnh/video demo và giới hạn môi trường.

Chạy thêm các kiểm tra build/typecheck/lint phù hợp với phần thay đổi theo [quy ước chung](../README.md#hoàn-thành-một-task). Ghi lệnh, kết quả và giới hạn môi trường trong PR. Test nghiệp vụ thuộc chính task này, không chuyển hết sang task nghiệm thu cuối.

## Ngoài phạm vi

Không tích hợp RTLS thật/cảm biến hoặc chạy vị trí nền. Thiết kế lại mặt bằng/đồ thị thuộc PB-033; nguồn vị trí và chuyển động mô phỏng thuộc PB-034. Task này tích hợp và điều phối chỉ đường/thuyết minh, không thay trạng thái khám khi tới nơi.

## Phối hợp và phụ thuộc

Dùng cơ chế điều phối âm thanh đã chốt PB-024/025 và hợp đồng sự kiện/tiếp tục của PB-034. Không phụ thuộc vòng: PB-034 được kiểm thử độc lập, PB-026 là bên tích hợp cuối.

Có thể đọc, thiết kế hoặc mở draft PR trước khi dependency merge; chỉ coi Ready và merge khi đã có các dependency, không tham chiếu mã chưa tồn tại. Nếu cần đổi hợp đồng chung, cập nhật hợp đồng và trao đổi với người nhận task phụ thuộc trước khi viết phần còn lại.

## Bàn giao

- [ ] Hoàn tất tiêu chí ở trên và quy ước Done.
- [ ] PR ghi mã PB-026, mô tả hành vi trước/sau, kiểm chứng và migration nếu có.
- [ ] Reviewer đã kiểm tra; xử lý hết yêu cầu sửa.
- [ ] PR được merge; cập nhật trạng thái Done, người nhận và link PR trong file này.

Nguồn đối chiếu: [kế hoạch chính](../../PRD-REVISION-PLAN.md), [backlog và quy trình làm việc](../README.md). Không thay đổi sáu quyết định nghiệp vụ hoặc sửa kế hoạch chính trong PR này nếu chỉ nhằm hoàn thành task.

## Bàn giao local ngày 15/11/2026

Đã nối nguồn PB-034 và chặng/mặt bằng PB-033 với Web Speech/Expo Speech,
Journey priority và UI thật. Bỏ bộ điều khiển thử tiếp tục chặng. Có kiểm thử
timeout, muted, callback cũ, đổi đích giữa cạnh, pause/loss/background,
đổi ngôn ngữ giữ vị trí và không tự hoàn tất nghiệp vụ.

Lệnh, kết quả và giới hạn ghi tại [bàn giao PB-026](../../../codes/docs/requirements/PB-026-ROUTE-NARRATION.md).
Kết quả cuối: 15/15 route unit, 104/104 hồi quy logic/native trên Node 22,
28/28 browser bản đồ, 104/104 Application production/API/SQL local;
typecheck, lint, web build và Expo Android export đạt. Các bộ có phần giao nhau.
Chưa có APK mới do thiếu Android SDK platform 36; còn kiểm chứng AVD/thiết bị,
reviewer duyệt và merge. Không đánh dấu Done hoặc xác nhận dependency đã merge
khi chưa có bằng chứng.

