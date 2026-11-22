# HƯỚNG DẪN CHẠY VÀ XUẤT BẢN

## Chạy thử trên máy tính

1. Giải nén ZIP.
2. Mở terminal tại thư mục có `index.html`.
3. Chạy `python -m http.server 8000`.
4. Truy cập `http://localhost:8000/`.
5. Kiểm tra tải ngân hàng câu hỏi và thử nạp đề.

Không mở trực tiếp bằng `file://` nếu muốn kiểm thử Service Worker. PWA cần HTTPS hoặc localhost.

## Xuất bản GitHub Pages

1. Tạo repository GitHub mới (Public nếu muốn công khai).
2. Upload **các tệp bên trong thư mục `WebPWA-Tin12`** vào root repository. `index.html` phải nằm ở root, không đặt thêm một thư mục con bao quanh.
3. Vào **Settings → Pages**.
4. Chọn **Deploy from a branch**, branch `main`, folder `/ (root)`, lưu cấu hình.
5. Mở URL GitHub Pages mà GitHub cung cấp. Đường dẫn repository dạng `https://username.github.io/repository-name/` được hỗ trợ nhờ các đường dẫn tương đối.
6. Khi đang online, tải lại trang và chờ Service Worker đăng ký, install, activate.
7. Kiểm tra trong DevTools → Application → Service Workers và Cache Storage.
8. Tắt mạng/bật chế độ máy bay, mở lại ứng dụng và làm bài.

## Cập nhật phiên bản

Khi cập nhật HTML/CSS/JS/JSON/icons, tăng giá trị `CACHE_NAME` trong `sw.js`, ví dụ `tin12-pwa-cache-v4`, rồi xuất bản lại. Không xóa cache thủ công trên mọi ứng dụng cùng origin; Service Worker mới chỉ xóa namespace cache `tin12-pwa-cache-*` của dự án.

## Cài đặt trên điện thoại

- Android: mở link bằng Chrome → menu ⋮ → Cài đặt ứng dụng/Thêm vào màn hình chính.
- iPhone: mở link bằng Safari → Chia sẻ → Thêm vào Màn hình chính.

Tên menu có thể thay đổi theo phiên bản trình duyệt. Sau khi cài, phải mở ứng dụng online ít nhất một lần để cache thiết yếu được tạo trước khi thử chế độ máy bay.
