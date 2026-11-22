# Web-App PWA ôn tập Tin học 12 – bản nâng cấp

## 1. Thành phần bàn giao

- `index.html`, `style.css`, `script.js`: giao diện và logic ứng dụng.
- `questions.json`: ngân hàng mặc định 26 câu.
- `questions_source_original_backup.json`: bản sao nguyên trạng `questions.json` có trong ZIP đầu vào, lưu để đối chiếu vì dữ liệu này không khớp đề Word mẫu.
- `question_metadata.json`: bảng nội bộ về chủ đề, độ khó và nguồn tham khảo cho 20 câu mới.
- `sw.js`, `manifest.json`, `icons/`: cấu hình PWA.
- `De_Thi_Mau_Tin12.docx`: đề mẫu nguồn.
- `tests/`: các kiểm tra tự động bằng Node.js.
- `BAO_CAO_KIEM_TOAN_VA_NGHIEM_THU.md`: báo cáo kiểm toán, sửa lỗi, giới hạn và đối chiếu Rubric.
- `TEST_REPORT.md`: nhật ký PASS / BLOCKED / NOT TESTED.
- `HUONG_DAN_XUAT_BAN.md`: hướng dẫn chạy và xuất bản.

## 2. Ngân hàng câu hỏi

`questions.json` dùng đúng schema mà `script.js` đọc:

- `multiple_choice`: `options` là mảng đúng 4 phần tử; `answer` là chỉ số 0–3.
- `true_false`: `items` gồm đúng 4 nhận định `a`, `b`, `c`, `d`; `answer` của từng nhận định là boolean.

Ngân hàng đang có 6 câu theo đề Word mẫu + 20 câu mới. Vì đề Word mẫu có 5 câu ABCD và 1 câu Đúng/Sai, tổng cuối là 17 ABCD + 9 Đúng/Sai. 20 câu mới được chia 12 ABCD + 8 Đúng/Sai; 10 câu Mạng + 10 câu CSDL; độ khó 6 Nhận biết + 8 Thông hiểu + 6 Vận dụng.

## 3. Chạy thử cục bộ

Yêu cầu: Node.js 18+ để chạy bộ test; trình duyệt hiện đại để chạy ứng dụng.

Tại thư mục chứa `index.html`:

```bash
python -m http.server 8000
```

Mở `http://localhost:8000/`. Service Worker có thể hoạt động trên localhost vì đây là secure context được trình duyệt cho phép.

## 4. Chạy kiểm tra tự động

```bash
sh tests/run_tests.sh
```

Bộ test kiểm tra cú pháp JavaScript, schema ngân hàng, parser trên văn bản đề mẫu, đọc cấu trúc ZIP của DOCX và mô phỏng vòng đời/cache của Service Worker. Đây không thay thế kiểm thử thực tế trong Chrome/Safari hoặc trên điện thoại.

## 5. Giới hạn đã biết

- Bộ đọc hỗ trợ `.docx`, không hỗ trợ `.doc` cũ hoặc đọc trực tiếp PDF nhị phân. Với PDF, người dùng sao chép văn bản rồi dán vào ứng dụng theo hướng dẫn STEM.
- Bộ đọc DOCX đọc `word/document.xml`; không cam kết lấy nội dung trong header/footer, comment, textbox hoặc hình ảnh OCR.
- DOCX giới hạn 12 MB, hỗ trợ ZIP Stored/Deflate; ZIP64 chưa được hỗ trợ.
- Nếu trình duyệt không có `DecompressionStream('deflate-raw')`, ứng dụng báo lỗi rõ ràng thay vì đoán nội dung.
- Parser chỉ nhập khi tất cả câu đều có cấu trúc và đáp án hợp lệ. Câu thiếu đáp án/thiếu nhận định sẽ bị chặn và hiển thị lỗi.
- Chưa thực hiện được kiểm thử giao diện trong trình duyệt, GitHub Pages và điện thoại trong môi trường hiện tại; xem `TEST_REPORT.md`.

## 6. Lưu ý khi cập nhật

Khi thay đổi tệp tĩnh cần được cache, tăng phiên bản `CACHE_NAME` trong `sw.js` (ví dụ `tin12-pwa-cache-v4`) để Service Worker cài cache mới. Không xóa hoặc đổi tên hai khóa localStorage mà ứng dụng đang dùng:
- `tin12_custom_exam`
- `tin12_custom_exam_title`


## Nạp nhanh ngân hàng 26 câu
Trong mục **Nạp đề → Dán văn bản**, nhấn **Chèn sẵn nội dung 26 câu** để đưa toàn bộ ngân hàng vào khung. Có thể chỉnh sửa nội dung rồi nhấn **Phân tích đề thi**. Tệp `Noi_Dung_De_Thi_26_Cau.txt` được precache cùng PWA để dùng ngoại tuyến sau khi cài đặt/cache thành công.
