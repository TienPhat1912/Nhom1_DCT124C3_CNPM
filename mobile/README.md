# Mobile App: Chương Trình Thuyết Minh Tự Động Đa Ngôn Ngữ
## (Multilingual Automated Audio Guide Mobile Application)

> **Môn học:** Công nghệ Phần mềm (Software Engineering - SE)\
> **Đơn vị:** Đại học Sài Gòn (SGU) - Lớp DCT124C3 - Nhóm 01\
> **Phụ trách:** Senior React Native Developer\
> **Phiên bản:** 1.0.0 (Bản Demo Đánh Giá Giữa Kỳ - Tuần 7)

---

## 1. Giới Thiệu & Mục Tiêu

Ứng dụng **Mobile Audio Guide** giúp du khách trong và ngoài nước tham quan các địa điểm văn hóa, lịch sử tại Thành phố Hồ Chí Minh và nghe bài thuyết minh tự động bằng nhiều ngôn ngữ: **Tiếng Việt, English, 日本語 (Tiếng Nhật), 中文 (Tiếng Trung)**.

### Mục tiêu phiên bản Giữa kỳ (Tuần 7):
- Toàn bộ flow ứng dụng chạy mượt mà độc lập với Mock API.
- Đầy đủ 8 màn hình và luồng điều hướng chuẩn React Navigation.
- Chuyển đổi linh hoạt 4 ngôn ngữ: đồng bộ tức thì giữa **Giao diện Text UI**, **Nội dung mô tả địa điểm** và **Tệp âm thanh thuyết minh**.
- Trình phát Audio Player độc lập, tái sử dụng (Play, Pause, Tua 10s, Seekbar, Thời lượng, Trạng thái lỗi/buffering).
- Đã sẵn sàng kiến trúc toạ độ và công thức Haversine để tích hợp GPS tự động kích hoạt vào Tuần 8.

---

## 2. Công Nghệ Sử Dụng

- **Framework:** React Native (Expo SDK 51)
- **Ngôn ngữ:** TypeScript (Chế độ Strict Type, không sử dụng `any` tùy tiện)
- **Điều hướng:** React Navigation v6 (Native Stack Navigator)
- **Phát âm thanh:** Expo AV (`expo-av` Sound Engine)
- **Quản lý trạng thái:** React Context API (`AuthContext`, `LanguageContext`, `FavoritesContext`)
- **Đa ngôn ngữ (i18n):** Hệ thống từ điển JSON độc lập, dễ mở rộng thêm ngôn ngữ mới
- **Kiểm thử (Testing):** Jest + ts-jest (100% Pass)
- **Thiết kế UI:** Modern Clean Design, tuân thủ chuẩn touch-target cho thiết bị di động

---

## 3. Cấu Trúc Thư Mục Dự Án

```text
mobile/
├── __tests__/                  # Bộ kiểm thử Unit & Integration Tests
│   ├── formatters.test.ts      # Kiểm thử format thời lượng mm:ss
│   ├── geoUtils.test.ts        # Kiểm thử công thức Haversine & Geofence GPS
│   ├── i18n.test.ts            # Kiểm thử dịch ngôn ngữ & fallback
│   ├── mockService.test.ts     # Kiểm thử toàn bộ API endpoints
│   └── validators.test.ts      # Kiểm thử biểu mẫu form đăng nhập/đăng ký
├── src/
│   ├── assets/                 # Logo, icons, hình ảnh
│   ├── components/             # Reusable UI Components
│   │   ├── AudioPlayer.tsx     # Bộ phát âm thanh độc lập với Seekbar & Tua 10s
│   │   ├── Button.tsx          # Nút bấm chuẩn hóa touch target
│   │   ├── EmptyState.tsx      # Giao diện khi không có dữ liệu
│   │   ├── ErrorMessage.tsx    # Giao diện báo lỗi kèm nút Retry
│   │   ├── Header.tsx          # Thanh tiêu đề chuẩn hóa với nút đổi ngôn ngữ nhanh
│   │   ├── Input.tsx           # Ô nhập liệu có validation & ẩn hiện mật khẩu
│   │   ├── LoadingIndicator.tsx# Vòng xoay tải dữ liệu với text đa ngôn ngữ
│   │   ├── LocationCard.tsx    # Card địa điểm hiển thị ảnh, tên, khoảng cách
│   │   └── SearchBar.tsx       # Thanh tìm kiếm kết hợp chip lọc danh mục
│   ├── constants/              # Bảng màu, typography, layout, tham số GPS
│   │   ├── colors.ts
│   │   ├── config.ts
│   │   ├── layout.ts
│   │   └── typography.ts
│   ├── contexts/               # Quản lý state toàn cục qua React Context
│   │   ├── AuthContext.tsx     # Quản lý phiên đăng nhập, tài khoản người dùng
│   │   ├── FavoritesContext.tsx# Danh sách địa điểm đã yêu thích
│   │   └── LanguageContext.tsx # Quản lý ngôn ngữ và hàm dịch t()
│   ├── hooks/                  # Custom hooks trừu tượng hóa nghiệp vụ
│   │   ├── useAudioPlayer.ts   # Vòng đời phát âm thanh, tua, bắt lỗi
│   │   ├── useDistance.ts      # Tính khoảng cách toạ độ người dùng & Geofence
│   │   └── useLocations.ts     # Tải danh sách, tìm kiếm, lọc theo chuyên mục
│   ├── i18n/                   # Hệ thống bản địa hóa (Localization)
│   │   ├── index.ts            # Quản lý từ điển & hàm translate()
│   │   └── locales/
│   │       ├── vi.json         # Tiếng Việt (Mặc định)
│   │       ├── en.json         # English
│   │       ├── ja.json         # 日本語
│   │       └── zh.json         # 中文
│   ├── navigation/             # Luồng điều hướng React Navigation
│   │   ├── AppNavigator.tsx    # Stack Navigator định tuyến toàn app
│   │   └── types.ts            # Type-safe navigation parameters
│   ├── screens/                # 8 Màn hình chức năng hoàn chỉnh
│   │   ├── SplashScreen.tsx    # Splash screen tự động chuyển trang
│   │   ├── LoginScreen.tsx     # Đăng nhập với nút Demo Login 1-click
│   │   ├── RegisterScreen.tsx  # Đăng ký tài khoản mới với validation
│   │   ├── HomeScreen.tsx      # Danh sách địa điểm, tìm kiếm, featured
│   │   ├── LocationDetailScreen.tsx # Chi tiết địa điểm + Audio Player
│   │   ├── LanguageScreen.tsx  # Chọn ngôn ngữ (VI, EN, JA, ZH)
│   │   ├── MapScreen.tsx       # Bản đồ & mô phỏng Geofence tuần 8
│   │   └── FavoritesScreen.tsx # Danh sách địa điểm đã lưu
│   ├── services/               # Tầng dữ liệu & kết nối API
│   │   ├── api/
│   │   │   ├── apiClient.ts    # Client HTTP chuẩn hóa cho REST API
│   │   │   ├── authService.ts  # Dịch vụ xác thực
│   │   │   └── locationService.ts # Dịch vụ địa điểm & âm thanh
│   │   ├── mockData/           # Dữ liệu mẫu giàu nội dung (Sài Gòn landmarks)
│   │   │   ├── audioGuides.ts
│   │   │   ├── locations.ts
│   │   │   └── users.ts
│   │   └── mockService.ts      # Giả lập đầy đủ API có độ trễ thực tế
│   ├── types/                  # Định nghĩa TypeScript toàn bộ hệ thống
│   └── utils/                  # Tiện ích toán học toạ độ & định dạng
│       ├── formatters.ts
│       ├── geoUtils.ts
│       └── validators.ts
├── App.tsx                     # Entry point tích hợp Context Providers
├── API_SPECIFICATION.md        # Đặc tả REST API bàn giao cho đội Backend
├── ROADMAP_WEEK_8_11.md        # Lộ trình kỹ thuật các tuần tiếp theo
├── package.json
└── tsconfig.json
```

---

## 4. Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Yêu cầu môi trường:
- Node.js version 18 trở lên (khuyến nghị v20+)
- npm version 9+

### Bước 1: Mở thư mục Mobile và cài đặt dependencies
```bash
cd "d:\bao cao\CNPM\mobile"
npm install
```

### Bước 2: Chạy ứng dụng

#### Lựa chọn A: Xem trực tiếp trên trình duyệt Web (Khuyến nghị cho chấm điểm nhanh)
```bash
npm run web
```
Trình duyệt sẽ tự động mở giao diện ứng dụng tại `http://localhost:8081`. Bạn có thể bật chế độ **Device Emulation (F12 -> Responsive / iPhone 14)** trên Chrome để trải nghiệm giao diện điện thoại chân thực nhất.

#### Lựa chọn B: Chạy trên điện thoại thật (Android hoặc iOS)
1. Cài đặt app **Expo Go** trên Google Play Store (Android) hoặc Apple App Store (iOS).
2. Chạy lệnh:
```bash
npm start
```
3. Quét mã QR hiển thị trên Terminal bằng ứng dụng Expo Go (Android) hoặc Camera (iOS). Ứng dụng sẽ nạp trực tiếp vào điện thoại mà không cần cáp nối.

#### Lựa chọn C: Chạy trên Android Emulator
```bash
npm run android
```

---

## 5. Kịch Bản Demo Nhanh Cho Hội Đồng Chấm Điểm (1-Click Walkthrough)

1. **Khởi động:**
   - Khi mở app, `SplashScreen` hiển thị logo và tên ứng dụng trong 1.8 giây, sau đó tự chuyển sang `LoginScreen`.
2. **Đăng nhập siêu tốc (Không cần gõ phím):**
   - Tại màn hình đăng nhập, bấm nút **"Đăng nhập bản Demo (1-Click)"** để vào thẳng `HomeScreen`.
   - Hoặc có thể thử gõ sai định dạng email để thấy hệ thống bắt lỗi (validation).
3. **Trải nghiệm Home Screen:**
   - Xem banner địa điểm nổi bật (`Featured`).
   - Gõ từ khóa tìm kiếm (ví dụ: `"Đức Bà"`, `"Bến Thành"`) vào thanh tìm kiếm.
   - Bấm vào các chip danh mục: Di tích, Chợ, Bảo tàng, Văn hóa.
   - Kéo vuốt xuống để trải nghiệm hiệu ứng **Pull-to-Refresh**.
4. **Trải nghiệm Đa Ngôn Ngữ (Tính năng cốt lõi):**
   - Bấm vào biểu tượng lá cờ ngôn ngữ ở góc trên bên phải Header.
   - Chọn **English (Tiếng Anh)** hoặc **日本語 (Tiếng Nhật)** hoặc **中文 (Tiếng Trung)**.
   - Quay lại màn hình: Toàn bộ text UI tự động chuyển ngữ ngay tức khắc.
5. **Trải nghiệm Chi Tiết Địa Điểm & Trình Phát Âm Thanh:**
   - Chọn địa điểm **Nhà Thờ Đức Bà Sài Gòn**.
   - Nội dung bài viết hiển thị theo ngôn ngữ bạn vừa chọn.
   - Tại mục **Bài thuyết minh**: Bấm nút **Play** to tròn ở giữa.
   - Thử tính năng: Tua nhanh **+10s**, tua lùi **-10s**, chạm tay vào thanh tiến trình **Seekbar** để tua đến đoạn bất kỳ.
   - Bấm mở rộng **"Bản ghi lời đọc (Transcript)"** để theo dõi nội dung văn bản tương ứng với giọng đọc.
   - Bấm icon Trái tim để thêm vào danh sách Yêu thích.
6. **Mô phỏng GPS & Kích hoạt tự động (Chuẩn bị cho Tuần 8):**
   - Bấm nút **"Bản đồ"** trên Header hoặc nút **"Xem trên bản đồ"** trong trang chi tiết.
   - Màn hình hiển thị khoảng cách thực tế từ toạ độ người dùng (Quận 1) đến các địa danh.
   - Bấm nút **"Đến gần"** cạnh một địa điểm: Hệ thống lập tức nhận diện bạn đã bước vào bán kính 50m và kích hoạt thông báo phát thuyết minh tự động!

---

## 6. Kiểm Thử (Testing & CI Readiness)

Ứng dụng được trang bị bộ kiểm thử tự động toàn diện:

### 1. Kiểm tra TypeScript (Type Check):
```bash
npm run typecheck
```
*Kết quả:* 0 errors, 100% code đúng chuẩn kiểu dữ liệu TypeScript.

### 2. Chạy bộ kiểm thử tự động (Jest Unit Tests):
```bash
npm test
```
*Kết quả:* 5 test suites bao phủ toàn bộ:
- `geoUtils.test.ts`: Kiểm thử công thức Haversine và nhận diện Geofence 50m.
- `formatters.test.ts`: Kiểm thử format thời gian âm thanh `mm:ss`.
- `validators.test.ts`: Kiểm thử tính hợp lệ của email, password, họ tên.
- `i18n.test.ts`: Kiểm thử từ điển 4 ngôn ngữ và cơ chế fallback.
- `mockService.test.ts`: Kiểm thử toàn bộ các API lấy danh sách, chi tiết, âm thanh và đăng nhập.

---

## 7. Bàn Giao & Kết Nối Backend Tương Lai

- Xem chi tiết danh sách API mà đội ngũ Backend cần cung cấp tại: [`API_SPECIFICATION.md`](./API_SPECIFICATION.md).
- Xem kế hoạch phát triển các tuần 8 đến 11 tại: [`ROADMAP_WEEK_8_11.md`](./ROADMAP_WEEK_8_11.md).
- Khi Backend hoàn thành REST API, chỉ cần sửa cấu hình trong file `src/constants/config.ts`:
  ```typescript
  export const APP_CONFIG = {
    USE_MOCK_API: false, // Chuyển thành false để gọi trực tiếp REST API
    API_BASE_URL: 'https://api.your-backend-domain.com/v1',
    // ...
  };
  ```
