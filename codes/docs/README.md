# Tài liệu dự án

| Cần tìm | Tài liệu |
|---|---|
| Deploy online và tự cập nhật từ GitHub, không dùng Docker | [Azure CI/CD](guides/AZURE_CD.md) |
| Bật/tắt demo, tự nhận IP LAN | [Hướng dẫn LAN](guides/LAN.md) |
| Demo theo từng vai trò | [Kịch bản demo](guides/DEMO.md) |
| Build, cài đặt, kiểm thử APK | [Android](guides/ANDROID.md) |
| Cách chia hệ thống, bảo mật và dữ liệu | [Quyết định thiết kế](architecture/DECISIONS.md) |
| Endpoint, request và response | [API](architecture/API.md), [OpenAPI](architecture/openapi.json) |
| Yêu cầu gốc và truy vết | [PRD](requirements/PRD-extracted.txt), [truy vết](requirements/TRACEABILITY.md), [CSV](requirements/TRACEABILITY.csv) |
| Sơ đồ chỉnh sửa được bằng draw.io | [PRD](diagrams/PRD-diagrams.drawio), [triển khai](diagrams/implementation.drawio) |
| Chạy lại kiểm thử, nơi lưu kết quả mới | [Kiểm thử](../tests/README.md) |
| File và báo cáo cũ được chuyển đi | [Chỉ mục lưu trữ](../archive/README.md) |

`guides/` dành cho người chạy demo; `architecture/` dành cho người phát triển; `requirements/` đối chiếu yêu cầu. Kết quả chạy mới được lưu trong `artifacts/` ở gốc. Báo cáo và ảnh của các lần bàn giao trước nằm trong `archive/docs/`, chỉ giữ cục bộ; không phải bằng chứng kiểm thử trên máy mới.

Các lệnh trong tài liệu được chạy từ thư mục gốc dự án, trừ khi có chỉ dẫn khác. Xem [README chính](../README.md) để cài đặt và tìm mã nguồn.

- [Sáu ngôn ngữ, nguồn tiếng Việt và cấu hình Azure Translator](guides/LANGUAGES.md).
- [PB-029: heartbeat client, thẻ Online, kiểm thử và gate Android](requirements/PB-029-PRESENCE-CLIENTS.md).
