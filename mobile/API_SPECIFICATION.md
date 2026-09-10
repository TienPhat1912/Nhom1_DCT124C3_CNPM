# Đặc Tả Kỹ Thuật API (REST API Contract) - Mobile Module

Tài liệu này được lập bởi **Senior Mobile Developer** nhằm cung cấp cho thành viên phụ trách **Backend / API** của đề tài "Chương trình thuyết minh tự động đa ngôn ngữ".

Hiện tại, Mobile đang sử dụng tầng **Mock Service** (`src/services/mockService.ts`) với cấu trúc dữ liệu và interface giống hệt đặc tả dưới đây. Khi Backend hoàn thiện các API này, Mobile chỉ cần chuyển đổi cờ cấu hình `USE_MOCK_API = false` trong `src/constants/config.ts` mà không phải viết lại logic UI.

---

## 1. Cấu Trúc Phản Hồi Chung (Standard Response Format)

### Thành công:
```json
{
  "success": true,
  "data": { ... },
  "message": "Thông điệp (tùy chọn)"
}
```

### Thất bại:
```json
{
  "success": false,
  "message": "Nội dung thông báo lỗi cho người dùng",
  "code": "ERROR_CODE_STRING"
}
```

---

## 2. Danh Sách Endpoints Cần Thiết

### 2.1. Xác Thực (Authentication)

#### `POST /auth/login`
Đăng nhập người dùng.
- **Request Body:**
```json
{
  "email": "tourist@example.com",
  "password": "password123"
}
```
- **Response Data:**
```json
{
  "user": {
    "id": "user-001",
    "name": "Khách Du Lịch Demo",
    "email": "tourist@example.com",
    "avatarUrl": "https://example.com/avatar.jpg",
    "createdAt": "2026-01-15T08:00:00Z"
  },
  "token": "jwt-token-string-abc123xyz"
}
```

#### `POST /auth/register`
Đăng ký tài khoản mới.
- **Request Body:**
```json
{
  "name": "Nguyễn Văn A",
  "email": "nguyenvana@gmail.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```
- **Response Data:**
Giống `POST /auth/login`.

---

### 2.2. Địa Điểm Tham Quan (Locations)

#### `GET /locations`
Lấy danh sách các địa điểm tham quan du lịch.
- **Query Parameters:**
  - `category` (tùy chọn): `all`, `monument`, `market`, `museum`, `park`, `culture`.
  - `q` (tùy chọn): Từ khóa tìm kiếm (theo tên hoặc địa chỉ).
- **Response Data:**
```json
[
  {
    "id": "loc-001",
    "name": {
      "vi": "Nhà Thờ Đức Bà Sài Gòn",
      "en": "Notre-Dame Cathedral Basilica of Saigon",
      "ja": "サイゴン大教会（聖母マリア教会）",
      "zh": "西贡圣母圣殿主教座堂（红教堂）"
    },
    "shortDescription": {
      "vi": "Kiệt tác kiến trúc cổ kính phong cách Romanesque giữa lòng thành phố.",
      "en": "Historic Romanesque architectural masterpiece in the heart of downtown.",
      "ja": "ホーチミン市中心部に佇む歴史ある美しいネオ・ロマネスク様式の教会。",
      "zh": "位于市中心极具历史底蕴的罗马式建筑杰作。"
    },
    "description": {
      "vi": "Nhà thờ Chính tòa Đức Bà Sài Gòn được khởi công xây dựng vào năm 1877...",
      "en": "Constructed between 1877 and 1880...",
      "ja": "1877年に着工し、1880年に完成した歴史的建造物...",
      "zh": "建于1877年至1880年间..."
    },
    "address": "01 Công Xã Paris, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    "category": "monument",
    "imageUrl": "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
    "galleryImages": [
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800"
    ],
    "coordinate": {
      "latitude": 10.77978,
      "longitude": 106.69902
    },
    "openingHours": "08:00 - 17:30 (Hằng ngày)",
    "admissionFee": {
      "vi": "Miễn phí",
      "en": "Free Entry",
      "ja": "入場無料",
      "zh": "免费入场"
    },
    "isFeatured": true,
    "audioGuideId": "audio-001"
  }
]
```

#### `GET /locations/:id`
Lấy chi tiết một địa điểm theo ID.
- **Response Data:** Một object `Location` giống cấu trúc trên.

---

### 2.3. Bài Thuyết Minh Âm Thanh (Audio Guides)

#### `GET /locations/:id/audio?lang=:languageCode`
Lấy thông tin file âm thanh thuyết minh và bản ghi lời đọc (transcript) theo ngôn ngữ.
- **Query Parameters:** `lang` (`vi`, `en`, `ja`, `zh`). Mặc định là `vi`.
- **Response Data:**
```json
{
  "audioGuide": {
    "id": "audio-001",
    "locationId": "loc-001"
  },
  "currentTrack": {
    "language": "vi",
    "title": "Thuyết minh Nhà thờ Đức Bà Sài Gòn",
    "narratorName": "Lê Hương Giang",
    "audioUrl": "https://cdn.example.com/audio/notre-dame-vi.mp3",
    "durationSeconds": 372,
    "transcriptText": "Chào mừng quý khách đến với Nhà thờ Chính tòa Đức Bà Sài Gòn..."
  }
}
```

---

### 2.4. Địa Điểm Yêu Thích (Favorites)

#### `POST /favorites/toggle`
Thêm hoặc bỏ yêu thích địa điểm (Header `Authorization: Bearer <token>`).
- **Request Body:**
```json
{
  "locationId": "loc-001"
}
```
- **Response Data:**
```json
{
  "isFavorite": true
}
```

#### `GET /favorites`
Lấy danh sách mã địa điểm yêu thích của người dùng đang đăng nhập.
- **Response Data:**
```json
["loc-001", "loc-003"]
```
