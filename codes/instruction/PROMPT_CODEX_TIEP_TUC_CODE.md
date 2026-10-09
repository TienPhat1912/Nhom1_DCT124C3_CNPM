# Prompt: Codex tiếp quản và hoàn thiện code sau Antigravity

Bạn là coding agent tiếp quản dự án **Multilingual Hospital Visit Narration and Guidance System**. Tôi đã giao Antigravity triển khai toàn bộ dự án, nhưng hiện Antigravity hết quota tuần trên tất cả mô hình và phải dừng. Repository có thể đang ở trạng thái làm dở, gồm code đã commit, thay đổi chưa commit, file mới, test chưa hoàn thiện hoặc cấu hình chưa chạy được.

**Yêu cầu hiện tại: trực tiếp tiếp tục code, sửa lỗi, tích hợp và kiểm thử đến khi có bản demo chạy xuyên suốt theo PRD.** Yêu cầu này thay thế phạm vi “chỉ audit, chưa sửa code” trong prompt kiểm tra trước, nếu có. Khảo sát là bước đầu để tiếp quản; sau đó phải thực hiện các thay đổi cần thiết trong cùng quá trình làm việc.

## 1. Nguồn yêu cầu và phạm vi

Đọc các đầu vào được cung cấp hoặc có trong repo:

1. `PRD_v3.docx`: bản PRD đã chỉnh có Version 4.1 bên trong. Nếu tôi cung cấp bản cập nhật rõ ràng hơn, dùng bản đó và ghi tên/version thực tế. Đọc cả nội dung bảng, yêu cầu, quy tắc nghiệp vụ và đặc tả use case.
2. `AGENT_PROMPT_FE_CICD_BE_DEMO.md`, nếu có: yêu cầu triển khai ban đầu đã giao Antigravity.
3. Hướng dẫn repository áp dụng như `AGENTS.md`, README, API contract, scripts, lockfile, migration, seed và workflow.
4. Checklist, implementation plan, task notes, walkthrough hoặc báo cáo audit hiện có, chẳng hạn `docs/audit/codex-review.md`. Chỉ dùng những tệp thực sự truy cập được. Không giả định bạn đã đọc lịch sử trò chuyện riêng của Antigravity.

Tuân thủ các chỉ dẫn hệ thống và hướng dẫn repository áp dụng. Dùng yêu cầu hiện tại và PRD làm căn cứ về sản phẩm; dùng code và kết quả chạy để xác định tiến độ thực tế. Dấu “Done” trong checklist hoặc lời khẳng định của agent trước chưa đủ chứng minh một chức năng hoạt động.

Mục tiêu vẫn là:

- **FE hoàn chỉnh:** patient web bằng React.js, patient app bằng React Native và web cho các vai trò nội bộ trong PRD.
- **CI/CD thực thi được:** kiểm tra, build, artifact, đường triển khai web/API demo và build/phân phối mobile phù hợp với môi trường được cấp.
- **BE tối thiểu nhưng chạy thật:** API, dữ liệu lưu bền vững, auth/phân quyền và các quy tắc cần để FE demo đúng nghiệp vụ. Tích hợp bệnh viện bên ngoài có thể dùng adapter mô phỏng được ghi rõ.

Giữ stack và cấu trúc đang hoạt động. Không tạo dự án mới, thay framework/DB hoặc viết lại toàn bộ chỉ vì tiếp quản từ agent khác. Nếu một phần chưa tồn tại, bổ sung theo hướng đơn giản và nhất quán với repo. Các lựa chọn mặc định trong prompt ban đầu không phải lý do phá bỏ một nền tảng phù hợp đã có.

Nếu thiếu tài liệu phụ hoặc báo cáo audit, tự khảo sát và tiếp tục. Nếu thiếu PRD, vẫn xử lý lỗi build/test và các phần đã có đặc tả đáng tin cậy; chỉ yêu cầu bổ sung PRD cho quyết định nghiệp vụ thực sự chưa xác định được, không tự dựng yêu cầu.

## 2. Tiếp quản an toàn và xác định điểm đang dở

Trước khi sửa:

- Xác định thư mục repo, branch, commit và Git status; xem cả thay đổi staged, unstaged và file untracked thuộc dự án. Không chỉ đọc HEAD hoặc diff mới nhất.
- Bảo toàn phần việc hiện có. Không dùng `reset --hard`, `clean -fd`, restore hàng loạt, tự stash hoặc đổi branch làm mất ngữ cảnh. Được chỉnh sửa các file cần cho yêu cầu, nhưng không hoàn tác thay đổi không liên quan của tôi hoặc Antigravity.
- Nếu công cụ yêu cầu worktree/bản sao riêng, phải mang theo phần code chưa commit cần tiếp tục; không âm thầm làm trên một HEAD cũ thiếu tiến độ hiện tại. Nếu thấy file bị sửa đồng thời, tránh ghi đè và xác định mốc làm việc ổn định.
- Xem runtime/package manager/lockfile, lệnh cài/chạy/test/build, cấu hình môi trường, FE routes, API và DB. Chạy các kiểm tra nền phù hợp để biết lỗi nào đã tồn tại.
- Tìm phần nối chưa xong: imports/routes thiếu, endpoint chưa có, contract FE–BE lệch, migration chưa áp dụng, UI hard-code, TODO, handler rỗng, test skip và workflow sai đường dẫn. Đọc ngữ cảnh trước khi kết luận; không coi mọi TODO/mock đều là lỗi.

Lập bảng ngắn: **đã chạy được / có code nhưng chưa xác minh / đang lỗi hoặc làm dở / chưa triển khai / bị chặn bởi môi trường**. Nếu có kết quả audit, xác minh phát hiện còn đúng trên code hiện tại rồi đưa vào công việc sửa.

Thông báo ngắn điểm tiếp quản và thứ tự làm, sau đó bắt đầu code. Không dành toàn bộ lượt chỉ để viết báo cáo khảo sát hoặc hỏi lại “có muốn tiếp tục không”.

## 3. Cách triển khai tiếp

Ưu tiên theo phụ thuộc, thích nghi với tiến độ thực tế:

1. Khôi phục khả năng install/build/start; giải quyết lỗi nền khiến không kiểm tra được ứng dụng.
2. Hoàn thiện DB, migration/seed, auth, phân quyền, API contract và FE API client còn thiếu hoặc sai.
3. Làm một luồng chạy thật xuyên suốt: guest/walk-in hoặc appointment → tiếp nhận → phiếu khám → kích hoạt Journey.
4. Nối bác sĩ, dịch vụ, settlement, nhà thuốc, Published content, history và guest conversion.
5. Hoàn thiện các màn hình web/native còn thiếu, lỗi/recovery, đa ngôn ngữ và trải nghiệm sử dụng.
6. Hoàn thiện CI/CD, build mobile, local demo, tài liệu và bằng chứng nghiệm thu.

Đây là thứ tự ưu tiên, không phải quyền cắt bỏ phần còn lại. Khi một phần đã đạt thì giữ lại; tập trung vào khoảng trống thực tế. Sửa nguyên nhân của lỗi và cập nhật các lớp liên quan, không chỉ che lỗi ở UI.

Tự xử lý lựa chọn kỹ thuật nhỏ và công việc lập trình có thể hoàn tác. Chỉ hỏi khi có mâu thuẫn nghiệp vụ quan trọng, thiếu đầu vào thiết yếu, hoặc cần quyền/tài nguyên bên ngoài chưa được cấp. Tiếp tục phần độc lập khi một hạng mục bị chặn.

## 4. Các điều kiện nghiệp vụ phải giữ đúng

Đọc đầy đủ PRD; danh sách này nhấn mạnh những điểm dễ sai khi nối code đang dở:

1. Có hai kênh bệnh nhân: app và patient web; Guest là chế độ truy cập. Phân biệt QR bệnh viện, reception QR và ticket QR bằng purpose và kiểm tra server.
2. Mở QR bệnh viện, đăng nhập, chọn appointment hoặc gửi walk-in không tạo Visit. Reception xác nhận và phát hành phiếu mới tạo một Active Visit, một Pending Activation Journey và ticket trong thao tác nhất quán.
3. Retry, xác nhận đồng thời, in lại và quét lại không tạo Visit/Journey/ticket/step trùng. Ticket QR chỉ kích hoạt hoặc tiếp tục Journey đã tồn tại sau khi xác minh quyền.
4. Visit status, Journey status và step status là các trạng thái riêng theo PRD. Intermediate payment không đóng Visit. Chỉ đóng khi công việc bắt buộc đã được giải quyết và final settlement còn áp dụng, hoặc có no-payment-required hợp lệ. Settlement đến sớm hoặc công việc thay đổi phải được đánh giá lại.
5. Visit Closed có thể còn hướng dẫn nhà thuốc. Nếu còn nhà thuốc và Journey Pending Activation thì giữ pending đến khi được kích hoạt hợp lệ. Patient chỉ hoàn tất bước hướng dẫn nhà thuốc cuối đủ điều kiện; không xác nhận khám, xét nghiệm, thanh toán hoặc phát thuốc chính thức. Nếu không còn nhà thuốc, Journey hoàn tất tự động khi Visit đóng hợp lệ.
6. Doctor Order dùng mapping/dependency đã xác thực, giữ order–step links. Thiếu mapping phải bị từ chối trước commit; thay đổi order không reset sự kiện đã hoàn thành. Return consultation chờ đủ điều kiện dịch vụ.
7. Draft nội dung bác sĩ không lộ cho bệnh nhân. Chỉ bác sĩ có quyền Publish; quyền Administrator riêng lẻ không thay thế quyền đó. Published xem được ngay, độc lập với thanh toán, Journey và follow-up. Correction tạo version mới.
8. Bản dịch nội dung y tế phải được phê duyệt và gắn source version. TTS đọc đúng nội dung được phép; chẩn đoán/giải thích và dặn dò có playback riêng. Đổi version/ngôn ngữ xử lý audio cũ; provider lỗi vẫn đọc được text. Không tự sinh chẩn đoán hoặc dặn dò bằng AI.
9. Guest được lưu trên server trước đăng ký. Linking xác minh guest và tài khoản đích, giữ patient/Visit/Journey/content links, chống replay và quay lại ngữ cảnh. Cancel/failure giữ dữ liệu và valid guest access. Reload, hết session, đổi ngôn ngữ hoặc restart không làm mất hay tự hoàn tất tiến trình.
10. BE kiểm tra role, ownership/guest grant và staff scope cho từng tài nguyên. Ẩn nút ở FE hoặc biết Visit ID không phải quyền truy cập. Không cấp role nhân viên từ form đăng ký bệnh nhân.
11. Khuyến nghị tái khám không phải appointment đã đặt; lần tiếp nhận mới tạo Visit/Journey mới.

Phần nghiệp vụ nội bộ phải thực thi trên API và DB. Có thể mô phỏng external identity/appointment, queue/service/settlement provider, TTS/push qua adapter nếu cần cho demo, nhưng adapter phải đi qua cùng kiểm tra quyền, transaction và chuyển trạng thái. Ghi rõ phần được mô phỏng.

## 5. Tiêu chuẩn cho FE và BE demo

Bao phủ đủ nhóm FE trong PRD: FE-P01–P06 cho bệnh nhân; FE-R01 tiếp nhận; FE-D01 bác sĩ; FE-S01 dịch vụ; FE-C01 thu ngân; FE-A01 quản trị. Với bản PRD khác, dùng đúng mã và phạm vi của bản được giao.

- Hoàn thiện giao diện nhất quán, dễ đọc, responsive; loading/empty/error/retry/denied/session expiry; validation, focus/keyboard và text scaling phù hợp. Không để nút chỉ hiện toast thành công hoặc route không có nội dung.
- Journey phải làm rõ trạng thái hiện tại, việc tiếp theo, địa điểm và chờ/di chuyển; queue có thời điểm cập nhật. Listen/Navigate/Request Assistance nằm trong tối đa hai tương tác theo PRD.
- VI/EN bao phủ luồng chính, nội dung có fallback đúng PRD. Không để chú thích AI, JSON hay tên enum kỹ thuật lẫn vào trải nghiệm người dùng.
- FE dùng API thật cho luồng demo; xử lý double submit, stale data, conflict, reconnect/resume và session recovery. Không optimistic-complete thao tác lâm sàng, settlement hoặc Publish.
- React Native có UI và luồng native thực sự; web responsive/WebView toàn bộ không thay thế phần app. Xử lý camera permission, nhập mã thay thế, deep link, safe area, Back, app resume và API base URL đúng môi trường.
- BE có validation, lỗi nhất quán, transaction/idempotency cần thiết và DB lưu bền vững qua restart. Seed dùng dữ liệu tổng hợp, có thể chạy lại và không tự xóa DB mỗi lần startup.
- Dùng auth/storage của stack phù hợp, bảo vệ secret và token. Không thêm hệ thống hạ tầng lớn, thanh toán thật hoặc tích hợp ngoài phạm vi để làm BE demo phức tạp hơn cần thiết.

## 6. CI/CD và kiểm chứng

Hoàn thiện pipeline hiện có trước khi tạo cơ chế mới. Dùng đúng branch, runtime, package manager và lockfile thực tế.

- CI kiểm tra lint/typecheck, test có ý nghĩa, production build web/BE, checks mobile, integration/E2E với API/DB và Docker startup khi áp dụng.
- Không sửa test bằng cách bỏ assertion, skip phần đang lỗi, disable rule hàng loạt hoặc dùng `continue-on-error` để che lỗi. Test phải kiểm tra hành vi và guard nghiệp vụ.
- CD có artifact gắn commit, deploy artifact đã qua gate, kiểm tra cấu hình, migration/volume, health/smoke và cách rollback. Giữ secret ngoài repo/frontend; PR không tin cậy không được chạy với quyền deployment.
- Hoàn thiện đường chạy local bằng công cụ phù hợp, ưu tiên cơ chế hiện có. Nếu chưa có hosting được chỉ định, chuẩn bị Docker Compose/scripts/workflow/runbook; tiếp tục làm local demo dù chưa có credential bên ngoài.
- Deploy chỉ vào môi trường đã được chỉ định và cấp quyền. Không tự tạo dịch vụ tính phí, publish production hoặc phát hành app store. Thiếu host/secret phải báo blocked rõ ràng, không giả lập deployment thành công.
- Với mobile, xác minh native build khi có SDK/runner/credential. Android là mục tiêu demo đầu tiên nếu repo/chỉ dẫn hiện có chưa chốt khác. JS bundle/Expo Go không được báo là APK đã build; iOS chỉ ghi đã xác minh khi có bằng chứng.

Sau mỗi thay đổi có ý nghĩa, chạy kiểm tra đúng phạm vi; mở rộng khi cần xử lý rủi ro hoặc đáp ứng gate. Khi kết thúc, chạy các gate tổng thể phù hợp. Ít nhất xác minh:

1. Reception và ticket activation đúng thời điểm tạo Visit; retry/concurrency không nhân đôi dữ liệu.
2. Doctor/service/settlement/pharmacy hoạt động đúng quyền và điều kiện chuyển trạng thái.
3. Draft/Publish/correction/TTS fallback không lộ hoặc dùng nội dung sai version.
4. Guest conversion, ownership, session recovery và restart giữ đúng dữ liệu.
5. Web và app có các luồng tương ứng; CI/build/local demo có kết quả thực tế.

Đối chiếu NFR của PRD. Với NFR-PERF-01 hiện tại, chuẩn bị workload 20 người dùng đồng thời và 10.000 Journey steps, đo p95 request do ứng dụng sở hữu so với ngưỡng hai giây; ghi môi trường/dataset và đo provider latency riêng. Không kết luận đạt nếu chưa đo.

Phân biệt rõ: có code, đã kiểm tra local, CI đã chạy trên commit nào, native artifact đã tạo, và đã deploy/smoke test. Một lần CI xanh của commit cũ không xác minh thay đổi mới chưa commit.

## 7. Theo dõi tiến độ và bàn giao

Cập nhật một tài liệu tiến độ hiện có, hoặc tạo `docs/implementation-status.md` nếu chưa có nơi phù hợp. Giữ ngắn, ghi được điểm tiếp tục:

- Mốc code ban đầu và phần Antigravity để dở đã xác minh.
- Các yêu cầu/UC đã hoàn thiện, file liên quan và kiểm thử tương ứng.
- Lệnh thực tế đã chạy, kết quả, lỗi còn lại và blocker cụ thể.
- Quyết định kỹ thuật cần nhớ; việc tiếp theo theo thứ tự.

Không đọc lại toàn bộ repo/PRD sau mỗi bước nếu không có thay đổi liên quan; dùng checkpoint để tiếp tục nhất quán. Không tạo nhiều báo cáo trùng nội dung. Nếu gần hết ngữ cảnh hoặc phải dừng vì giới hạn môi trường, lưu checkpoint về file đang sửa, trạng thái build/test và bước tiếp theo; không ghi “hoàn thành” khi còn việc chưa làm.

Hoàn thiện README, config example không chứa secret, migration/seed, demo runbook và hướng dẫn CI/CD cần thiết. Các lệnh được ghi phải tồn tại và được xác minh trong phạm vi môi trường cho phép.

Tiêu chí kết thúc là bản demo chạy được và các khoảng trống trong phạm vi đã được xử lý, không phải chỉ có kế hoạch hoặc danh sách lỗi. Nếu có blocker ngoài quyền kiểm soát, hoàn tất mọi phần không bị chặn và nói rõ cần bổ sung gì để tiếp tục. Không tự commit/push/merge khi chưa được yêu cầu hoặc chưa có chỉ dẫn cho phép.

Trả lời cuối bằng tiếng Việt, gồm:

1. Đã tiếp quản từ trạng thái nào và đã hoàn thiện/sửa những gì ở FE, BE, CI/CD.
2. Cách chạy demo bằng các lệnh đã xác minh, cùng vị trí hướng dẫn tài khoản demo.
3. Build/test/luồng nào đã chạy thực sự và kết quả; artifact/URL thực tế nếu có.
4. Phần được mô phỏng, phần chưa xác minh, blocker hoặc lỗi còn lại và bước tiếp tục cụ thể.

**Hãy bắt đầu khảo sát ngắn repository hiện tại, sau đó trực tiếp tiếp tục code, chạy kiểm tra và sửa lỗi. Tôi đã yêu cầu bạn thực hiện công việc triển khai; không cần hỏi lại quyền bắt đầu sửa code trong phạm vi trên.**
