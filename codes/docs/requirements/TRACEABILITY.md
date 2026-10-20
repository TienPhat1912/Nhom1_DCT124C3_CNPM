# Truy vết yêu cầu

[TRACEABILITY.csv](TRACEABILITY.csv) có 165 dòng riêng cho toàn bộ FR, NFR, 25 BR và 21 UC. Yêu cầu được trích từ PRD-extracted.txt; module/màn hình/API và bằng chứng được đối chiếu theo nhóm chức năng. Tham chiếu test không có nghĩa mọi nhánh của từng yêu cầu đều đã được tự động kiểm tra.

Tên/số UC lấy theo 21 đặc tả chi tiết của PRD; bảng tổng quan trong tài liệu có một số tham chiếu số UC lệch (ví dụ navigation/queue/history). Không dùng những số lệch đó để đổi nghiệp vụ.

## 21 use case

| UC | Chức năng | Màn hình | API | Bằng chứng |
|---|---|---|---|---|
| UC-01 | Authenticate/Register | Auth; Profile; LinkAccount (web/native) | `/api/auth/*; /api/external/link` | API 1,6,7,10,12,13; browser conversion; android-account cancellation/conversion/restart |
| UC-02 | Retrieve/confirm appointment | PatientReception/Reception; StaffReception | `/api/appointments*; /api/requests/{id}/booking` | API 11; provider-failure |
| UC-03 | Prepare walk-in | PatientReception/Reception; StaffReception | `/api/requests*; /api/reception/*` | API 1,11,13; browser reception; android-smoke walk-in |
| UC-04 | Follow Journey | PatientJourney/Journey; StaffClinical | `/api/visits/*; /api/tickets/redeem` | API 1,2,3,4,8,14; browser guest journey; android-smoke |
| UC-05 | Listen to narration | PatientJourney; PatientRecords; native Journey/Records | `/api/visits/{id}/narration; /api/requests/{id}/narration` | API 5; browser speech failure; provider-failure; android-smoke narration/text fallback |
| UC-06 | Navigate | PatientJourney directions; native DirectionsScreen | `/api/visits/{id}/navigation` | API 9; browser destination fallback; android-smoke directions |
| UC-07 | Manage orders | PatientJourney/Journey; StaffClinical | `/api/visits/*; /api/tickets/redeem` | API 1,2,3,4,8,14; browser guest journey; android-smoke |
| UC-08 | Structured reception instruction | PatientReception/Reception; StaffReception | `/api/requests*; /api/reception/*` | API 1,11,13; browser reception; android-smoke walk-in |
| UC-09 | Request assistance | HelpPanel/Help; StaffSupport | `/api/assistance*` | API 9; browser assistance; performance write; android-smoke assistance |
| UC-10 | View history | History; Results (web/native) | `/api/visits?offset=&limit=; /api/visits/{id}/content` | API 5,6,7,10,11; browser conversion; android-account retained history |
| UC-11 | Follow-up recommendation | StaffContent; PatientRecords/Records | `/api/visits/{id}/follow-ups; /api/appointments*` | API 11; source review (booking URL conditional) |
| UC-12 | Configure workflow/content | Admin | `/api/admin/*` | API 8,14,15; source review of remaining config forms |
| UC-13 | Hospital QR entry | HospitalEntry; Scanner; TicketPanel; native ScanTicket | `/api/entry; /api/reception/scan; /api/tickets/redeem` | API 1,10,12; browser reception/activation; android-smoke hguide link and denied camera |
| UC-14 | Confirm reception/ticket | PatientReception/Reception; StaffReception | `/api/requests*; /api/reception/*` | API 1,11,13; browser reception; android-smoke walk-in |
| UC-15 | Activate/resume Journey | PatientJourney/Journey; StaffClinical | `/api/visits/*; /api/tickets/redeem` | API 1,2,3,4,8,14; browser guest journey; android-smoke |
| UC-16 | Link guest to account | Auth; Profile; LinkAccount (web/native) | `/api/auth/*; /api/external/link` | API 1,6,7,10,12,13; browser conversion; android-account cancellation/conversion/restart |
| UC-17 | Consultation/service progress | PatientJourney/Journey; StaffClinical | `/api/visits/*; /api/tickets/redeem` | API 1,2,3,4,8,14; browser guest journey; android-smoke |
| UC-18 | Settlement/Visit closure | StaffClinical; PatientJourney/Journey | `/api/requests/{id}/confirm; /api/visits/*` | API 1,2,3,4,11,14; browser cashier; android-smoke pharmacy closure |
| UC-19 | Complete Journey | PatientJourney/Journey; StaffClinical | `/api/visits/*; /api/tickets/redeem` | API 1,2,3,4,8,14; browser guest journey; android-smoke |
| UC-20 | Publish doctor content | StaffContent; PatientRecords/Records | `/api/visits/{id}/drafts*; /content; /narration; /summaries/*` | API 5; browser private draft/publication |
| UC-21 | Review doctor content | StaffContent; PatientRecords/Records | `/api/visits/{id}/drafts*; /content; /narration; /summaries/*` | API 5; browser private draft/publication |

## NFR và giới hạn kiểm chứng

| NFR | Kiểm chứng / giới hạn |
|---|---|
| NFR-USAB-01 | Journey places current status, next action, destination and wait/proceed together; browser and Android emulator screenshots. Physical-device matrix outstanding. |
| NFR-USAB-02 | Listen/Navigate/Help within two actions from Journey; guest beside sign-in/register; browser and android-smoke scenarios. |
| NFR-PERF-01 | tests/api/performance.mjs; artifacts/performance.json after a new run; 20 users, 10000 seeded steps, 620 measured requests, p95 per operation <=2000ms. Short local workload only. |
| NFR-PERF-02 | Configured 5-second timeout; tests/api/provider-failure.mjs checks Timeout and Unavailable at 1 second; unchanged local state. |
| NFR-SEC-01 | Access.cs ownership, guest grant, staff scope; API 1,5,7,9 and patient clinical-write denial. |
| NFR-SEC-02 | Opaque QR, hashed sessions, HttpOnly/SameSite, optional localhost HTTPS/Secure cookie. Local certificate is self-signed; no production deployment audit. |
| NFR-PRIV-01 | Minimal profile/request data; guest duration and optional account link displayed; source/browser review. |
| NFR-PRIV-02 | docs/architecture/API.md documents retention and source references. Demo retains data; production policy/purge approval remains outstanding. |
| NFR-SEC-03 | API 6,7,10: verified claims, replay denied, renewed sessions, unchanged IDs; browser and android-account conversion. |
| NFR-REL-01 | SQL persistence; API/browser reload and android-smoke SecureStore process restart reconstruct the same Journey. |
| NFR-REL-02 | CommandBus transaction/application lock + unique keys; API 1 parallel confirmations, API 2 duplicate event, API 13 payload-key conflict. |
| NFR-REL-03 | Resource hooks retain RAM data, stale time, sequence guard; browser offline completion refused then retry succeeds; observed native timeout/retry retains Journey (android-retry.json). |
| NFR-REL-04 | API 6,7 failed/cancelled conversion retains guest; cookie issued only after commit; browser conversion; android-account cancellation and successful conversion. |
| NFR-ACC-01 | Semantic labels/dialogs/keyboard controls and stop playback; browser desktop/mobile. Android Journey tested at 130% system font scale in Vietnamese. Formal screen-reader audit and physical-device matrix remain outstanding. |
| NFR-ACC-02 | Browser/provider narration failures retain text; android-smoke observes native playback state or readable audio error. Audible VI/EN voice quality remains unverified. |
| NFR-LOC-01 | Shared externalized vi/en UI; separate published templates/medical translations; browser Vietnamese patient/English doctor and native English/Vietnamese Journey. |
| NFR-LOC-02 | Browser language switch retains Visit URL; android-account EN-to-VI cold-start deep link retains Visit/Journey after conversion; saved language cannot overwrite the explicit link language. |
| NFR-LOC-03 | API 5: approved source revision required; stale narration 409 after correction; no auto medical translation. |
| NFR-LOC-04 | API 5 fallback to authorized source with language flag; UI original source/fallback labels. |
| NFR-MNT-01 | Admin forms + validated mapping DAG, versioned templates; API 8,14. Full configuration form matrix not automated. |
| NFR-MNT-02 | Single backend deployment, modules and centralized Workflow; Docker API build. |
| NFR-COMP-01 | Chromium desktop/Pixel 7 browser tests and Android API 36 emulator native tests. iOS, physical Android devices and Safari/Firefox remain unverified. |
| NFR-DEL-01 | Lockfiles, Docker builds, local Android APK with signature/manifest verification. GitHub workflow/APK job not yet run. |

Các số API tham chiếu thứ tự test trong tests/api/api.test.mjs. Chạy lại theo [hướng dẫn kiểm thử](../../tests/README.md), kết quả mới nằm trong artifacts/. Các tham chiếu kiểm chứng ở trên mô tả phạm vi và giới hạn đã ghi nhận; báo cáo cũ được lưu cục bộ theo [chỉ mục archive](../../archive/README.md), không đi kèm bản clone. Source web trong apps/web/src, native trong apps/mobile/src. Tích hợp thật chưa được tuyên bố hoàn tất.
