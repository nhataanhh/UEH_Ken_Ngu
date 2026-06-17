# Kén Ngủ V2 — Hệ thống đặt kén ngủ thông minh
Tài khoản : Admin - Mật khẩu : A@a123

Hệ thống đặt chỗ "kén ngủ" cho thư viện / phòng tự học, gồm **web app** (HTML/JS + Firebase Realtime Database) và **phần cứng ESP32** điều khiển 1 kén thật.

## Cấu trúc dự án

| File | Vai trò |
|------|---------|
| `index22.html` | Trang đăng nhập |
| `home.html` | Trang chủ (admin) |
| `booking.html` | Trang đặt kén cho người dùng |
| `dashboard.html` | Bảng điều khiển / thống kê (admin + người được cấp quyền) |
| `admin.html` | Quản lý tài khoản |
| `auth.js` | Cấu hình Firebase + xác thực, băm mật khẩu, cổng bảo vệ trang |
| `pods.js` | Cấu hình dùng chung: danh sách kén, khu vực, giá, thời gian giữ chỗ |
| `notify.js` | Thông báo pop-up |
| `esp32_ken_N1-01/` | Code Arduino cho mạch ESP32 (chỉ điều khiển kén **N1-01**) |

## Mô hình hoạt động

- **10 kén**: 2 khu (N1 thư viện, N2 phòng tự học), mỗi khu 5 kén.
- **Kén N1-01** = kén phần cứng thật, điều khiển bằng **ESP32** (cảm biến + servo + đèn giao thông) qua Firebase.
- **9 kén còn lại** = giả lập, check-in/check-out thủ công trên web.
- Trạng thái mỗi kén: `available` (xanh) → `reserved` (vàng, giữ chỗ 30s) → `busy` (đỏ, đang dùng, đếm ngược) → `available`.

## Công nghệ

- Firebase Realtime Database (SDK 8.10.1, dùng qua CDN — không cần build).
- Firebase Hosting (`kennguv.web.app`).
- ESP32 + thư viện **Firebase Arduino Client Library for ESP8266 and ESP32** (tác giả Mobizt).

## ⚙️ Hướng dẫn cấu hình (Dành cho người clone/fork project)

Nếu bạn tải project này về để sử dụng hoặc phát triển thêm, bạn cần thay đổi các thông tin kết nối dưới đây để liên kết với tài nguyên của riêng bạn:

**1. Cấu hình Firebase Database (Web)**
- Mở file `auth.js`.
- Tìm biến `KEN_FIREBASE_CONFIG` và thay đổi `databaseURL` sang đường dẫn Firebase Realtime Database của bạn.

**2. Cấu hình Telegram Bot (Nhận thông báo)**
- Mở file `ken-core.js`.
- Tìm biến `KEN_TELEGRAM`.
- Đổi `token` thành Token Bot của bạn (được cấp bởi BotFather).
- Đổi `chatId` thành ID nhóm hoặc cá nhân bạn muốn nhận thông báo.

**3. Cấu hình Mạch ESP32**
- Mở file `esp32_ken_N1-01/esp32_ken_N1-01.ino`.
- Cập nhật `WIFI_SSID` và `WIFI_PASSWORD` bằng thông tin WiFi nhà/phòng lab của bạn.
- Cập nhật `FIREBASE_HOST` và `FIREBASE_AUTH` tương ứng với Firebase của bạn (Lưu ý: phần host bỏ qua `https://` và dấu `/` ở cuối).

## Chạy / sửa giao diện

Đây là web tĩnh, **không cần cài đặt gì**. Mở thẳng file `.html` bằng trình duyệt, hoặc chạy server tĩnh:

```bash
# ví dụ dùng Python
python -m http.server 5500
```

Rồi mở `http://localhost:5500/index22.html`.

> Khi sửa `auth.js` / `pods.js`, nhớ tăng số version ở thẻ `<script src="pods.js?v=N">` trong các file HTML để trình duyệt nạp lại bản mới (tránh cache).

## Deploy

```bash
firebase deploy
```

(Cần được mời vào dự án Firebase `kennguv` mới deploy được.)

## ⚠️ Lưu ý

- File `esp32_ken_N1-01/esp32_ken_N1-01.ino` chứa SSID/mật khẩu WiFi — **không công khai repo** hoặc thay bằng placeholder trước khi public.
- Firebase rules đang để mở (`.read/.write = true`) cho bản demo — cần siết lại nếu dùng thật.
