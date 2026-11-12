# Chạy và build Android

Expo SDK 57.0.30, React 19.2.3, React Native 0.86.3. Phiên bản phụ thuộc nằm trong package-lock.json. Ứng dụng dùng cùng backend: không có dữ liệu khám hardcode trong client.

## Chạy với emulator

1. Cài Android Studio, Android SDK/build tools mà dự án Expo sinh ra yêu cầu, tạo emulator; JDK 17, Node 22.19.0.
2. Từ root: `npm ci`. Chạy SQL/API theo README; sau khi giả lập khởi động, chạy `adb reverse tcp:5280 tcp:5280` và `adb reverse tcp:5180 tcp:5180`. Backend mặc định trong app là `http://127.0.0.1:5280`, hoạt động qua adb reverse trên cả giả lập và điện thoại USB.
3. Copy `apps/mobile/.env.example` thành `.env` trong cùng thư mục. Giá trị mặc định tương ứng emulator và backend HTTP cục bộ.
4. `cd apps/mobile`, `npx expo run:android`. Lệnh sinh native project, build development app và khởi động Metro. Hoặc `npm run mobile` từ root và dùng Expo Go tương thích SDK đang cài, nếu hỗ trợ đủ module.

Trên thiết bị USB thật cũng dùng hai lệnh adb reverse trên, không cần mở SQL ra LAN. Expo development cần Metro kết nối được (USB reverse 8081 hoặc mạng phù hợp). Endpoint môi trường là địa chỉ công khai của backend, không chứa bí mật. Có thể chọn `http://10.0.2.2:5280` riêng cho giả lập bằng biến môi trường khi build.

## APK demo có JavaScript đóng gói

APK không nằm trong Git. Build theo lệnh dưới để tạo `artifacts/android/an-tam-demo.apk` và file `.sha256`, hoặc tải artifact `android-demo-apk` từ một lần GitHub Actions thành công. Bộ build cấu hình ARM64 + x86_64, Android 7.0/API 24 trở lên, target API 36. Kiểm tra chữ ký/manifest ghi vào `artifacts/android/android-build.json`. APK release demo được ký bằng debug keystore, không phải khóa phát hành cửa hàng.

Trên Windows, từ root:

```powershell
./scripts/build/build-android.ps1
node tests/android/verify-android.mjs
```

Script dùng JDK 17, SDK ở `ANDROID_HOME` hoặc `.local/android-sdk`, giới hạn hai worker. Khi workspace dài/có dấu cách, script tạo bản sao ở `D:\cnpm-android` (đổi bằng `-BuildDirectory`) và chỉ cập nhật thư mục có marker sở hữu khớp workspace. Gradle cache nằm ở `.gradle-cache` bên trong thư mục build ngắn; cache CMake `.cxx` không được sao chép vì chứa đường dẫn tuyệt đối. Không di chuyển source gốc. Nên dành ít nhất 20 GiB trống cho SDK/NDK/cache/image; lần build đầu phải tải Maven/Gradle. Cần SDK platform/build-tools 36, NDK 27.1.12297006, CMake 3.22.1; một số thư viện yêu cầu thêm build-tools 35. Công cụ lấy từ [Android Developers](https://developer.android.com/studio#command-line-tools-only). Trên máy ít RAM, dừng giả lập trong lúc build rồi mở lại để kiểm thử.

APK hiện tại mặc định gọi `http://127.0.0.1:5280`. Cài trên giả lập hoặc điện thoại USB đã bật USB debugging:

```powershell
adb reverse tcp:5280 tcp:5280
adb reverse tcp:5180 tcp:5180
adb install -r artifacts/android/an-tam-demo.apk
```

Endpoint là cấu hình công khai được đóng vào JavaScript khi build. Script không sao chép `.env` sang thư mục build; truyền `-ApiUrl`/`-WebUrl` hoặc biến môi trường `EXPO_PUBLIC_*` khi cần đổi, ví dụ `./scripts/build/build-android.ps1 -ApiUrl http://10.0.2.2:5280`. Với môi trường thật dùng URL HTTPS có chứng thư tin cậy. Mỗi lần thiết bị/giả lập khởi động lại cần thiết lập lại adb reverse.

Trên Linux/macOS hoặc workspace Windows có đường dẫn ngắn, có thể chạy Gradle trực tiếp:

```powershell
cd apps/mobile
npx expo prebuild --platform android --no-install
cd android
./gradlew.bat assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a,x86_64
```

APK Gradle trực tiếp ở `app/build/outputs/apk/release`; trên Linux/macOS dùng `./gradlew`. EAS `preview` trong eas.json cũng cấu hình APK nhưng cần tài khoản/credentials riêng; phiên này không gửi source lên EAS.

Job Android trong [workflow CI ở gốc repository](../../../.github/workflows/check.yml) sinh native project, build và lưu APK artifact khi được chạy trên GitHub. Chưa có bằng chứng job này đã chạy. Các thư mục native sinh ra được ignore, tái sinh từ Expo config và lockfile.

Config plugin `withLocalNetwork.cjs` chỉ cho phép HTTP tới localhost, 127.0.0.1 và 10.0.2.2; mọi địa chỉ khác yêu cầu HTTPS. Không bỏ qua kiểm tra chứng thư. Manifest tắt backup và loại quyền storage/overlay/microphone không dùng. [Cơ chế Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config) được kiểm tra trên tài nguyên thực trong APK, kể cả khi Gradle đổi tên file XML.

## Deep link và QR

Scheme: `hguide://entry?language=vi` hoặc `hguide://entry?ticket=<opaque-token>`. Native lưu context ticket qua màn hình xác thực; backend vẫn kiểm tra quyền trước khi mở Journey. `/entry` trên web hỗ trợ Android intent kèm web fallback; trình duyệt không hỗ trợ có lựa chọn mở app/web. QR trên phiếu dùng URL web với token trong fragment để tránh gửi token trong URL request/log.

Universal/App Links tự mở từ HTTPS trên mọi trình duyệt cần tên miền thật và association files khớp chữ ký app. Chưa có tên miền/chữ ký phát hành, nên phần này chưa được xác nhận trên thiết bị. Việc biết URI không cấp quyền vào hồ sơ.

## Kiểm chứng đã thực hiện và còn phải thực hiện

Báo cáo native mới được ghi vào `artifacts/android/android-smoke.json` và `artifacts/android/android-account.json` khi toàn bộ kịch bản tương ứng đạt. Báo cáo các lần chạy trước nằm trong `archive/docs/evidence/` trên máy đã dọn, xem [chỉ mục lưu trữ](../../archive/README.md). Cần chạy lại trên bản build đang dùng; Playwright mobile viewport hoặc build thành công không thay thế kiểm thử native. Thiết bị Android/iOS vật lý, camera quét QR thật và chất lượng giọng VI/EN vẫn cần nghiệm thu riêng.

Để chạy lại kiểm thử native, dùng AVD riêng tên `cnpm_api36` (Google APIs, API 36, x86_64), mở ở cổng 5556 và cài APK hiện tại. Demo API/SQL phải đang chạy, `.env` chứa mật khẩu demo do bootstrap tạo. Script mặc định tìm adb tại `.local/android-sdk/platform-tools/adb.exe`; có thể đặt `ADB_PATH` và `ANDROID_SERIAL` khi dùng đường dẫn khác. Chạy tuần tự từ root:

```powershell
node tests/android/verify-android.mjs
node tests/android/android-smoke.mjs
node tests/android/android-account.mjs
```

`android-smoke` tạo khách và hồ sơ tổng hợp mới, hoàn tất hành trình bằng UI native cùng hành động của nhân viên qua API thật. `android-account` tiếp tục đúng khách đó để kiểm tra không còn UI liên kết, đăng ký tài khoản độc lập không nhận lịch sử Guest, khôi phục Guest đã xác minh, khởi động lại, deep link VI và cỡ chữ 130%; luôn phục hồi cỡ chữ cũ sau test. Bộ test đặt kích thước giả lập 720×1280, density 240 và tắt animation; chỉ dùng AVD riêng vì các thiết lập này được giữ lại. Chạy với API/database kiểm thử riêng; không xóa app data hoặc database. SHA-256 của APK đang cài được so với file bàn giao trước khi chạy và ghi cùng báo cáo; ảnh chụp nằm trong `artifacts/android`.

Chạy native acceptance sau khi build/export đã kết thúc để giảm tranh chấp tài nguyên trên máy ít RAM. Các tích hợp ngoài bệnh viện vẫn là Simulation theo cấu hình demo.
