# NHẬT KÝ KIỂM THỬ – TIN HỌC 12 PWA

**Môi trường:** Node.js v22.16.0; Python 3.13; Chromium/Playwright có sẵn nhưng điều hướng tới `localhost` và `file://` bị chặn bởi chính sách môi trường (`ERR_BLOCKED_BY_ADMINISTRATOR`).

| Test ID | Nội dung | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|
| T01 | `node --check script.js` | Không có lỗi cú pháp | Không có lỗi | PASS |
| T02 | `node --check sw.js` | Không có lỗi cú pháp | Không có lỗi | PASS |
| T03 | Đọc và xác thực `questions.json` | JSON hợp lệ, schema đúng | 26 câu, không lỗi schema | PASS |
| T04 | Đếm loại câu | 20 câu mới gồm 12 ABCD + 8 Đúng/Sai | Đúng 12 + 8 | PASS |
| T05 | Phân bổ chủ đề câu mới | 10 Mạng + 10 CSDL | Đúng 10 + 10 | PASS |
| T06 | Phân bổ độ khó | 6 Nhận biết, 8 Thông hiểu, 6 Vận dụng | Đúng 6/8/6 | PASS |
| T07 | Kiểm tra ID và đáp án | ID duy nhất, đủ 4 phương án/4 nhận định, đáp án đúng kiểu | Không trùng ID; tất cả hợp lệ | PASS |
| T08 | Đọc Central Directory và giải nén `word/document.xml` của DOCX mẫu | Lấy được XML nội dung | Đã lấy được XML 12.930 ký tự; có dấu mốc Câu 1 và Câu 6 | PASS |
| T09 | Parser văn bản trích xuất từ DOCX mẫu | Nhận đủ 6 câu, 5 ABCD + 1 Đúng/Sai | Nhận đủ 6; đáp án B, C, B, B, B và Đ/S/Đ/Đ | PASS |
| T10 | Parser phương án cùng dòng | Nhận đủ A–D, giữ đúng chỉ số đáp án | Nhận 1 câu, đáp án C (index 2) | PASS |
| T11 | Parser đáp án Đúng/Sai tổng hợp | Đọc a-Đ, b-S, c-Đ, d-S | Nhận đúng true/false từng ý | PASS |
| T12 | Câu ABCD thiếu đáp án | Không tự mặc định A | Parser chặn và báo thiếu đáp án | PASS |
| T13 | Câu Đúng/Sai thiếu nhận định | Không tự tạo nhận định hoặc đáp án | Parser chặn và báo thiếu đủ a–d | PASS |
| T14 | Thang điểm Đúng/Sai | 0/4, 1/4, 2/4, 3/4, 4/4 tương ứng 0; 0,1; 0,25; 0,5; 1 | Đúng toàn bộ | PASS |
| T15 | Kết quả toàn bộ đáp án đúng/sai | Điểm cuối 10/0 | 10/10 và 0/10 | PASS |
| T16 | Payload dạng HTML trong đề nhập | Không được thực thi; render dưới dạng văn bản | Parser giữ chuỗi; renderer dùng textContent, không còn innerHTML trong script | PASS (kiểm tra mã nguồn) |
| T17 | Service Worker install/activate/cache/offline fallback | Precache, dọn cache đúng namespace, fallback navigation, bỏ qua POST/cross-origin | Unit mock test đạt các nhánh | PASS (mock, không phải browser thật) |
| T18 | Mở ứng dụng trong Chromium/Playwright | DOM render, nút bấm và tương tác chạy | Không truy cập được localhost/file do `ERR_BLOCKED_BY_ADMINISTRATOR` | BLOCKED |
| T19 | Nạp DOCX bằng giao diện browser | Đọc, preview, xác nhận, lưu localStorage | Chưa chạy được giao diện browser | BLOCKED |
| T20 | Cài đặt PWA Android/iOS | Có thể thêm vào màn hình chính | Chưa có thiết bị kiểm thử | NOT TESTED |
| T21 | Chế độ máy bay thực tế | Mở ứng dụng, làm bài, chấm điểm khi mất mạng | Chưa chạy trên browser/điện thoại | NOT TESTED |
| T22 | GitHub Pages | Deploy dưới repository subpath, không lỗi 404 | Chưa có repository/đường dẫn triển khai | NOT TESTED |

## Cách chạy lại

Tại thư mục gốc dự án:

```bash
sh tests/run_tests.sh
```

`PASS` ở T17 là mô phỏng Service Worker bằng Node.js, không thay thế kiểm thử Service Worker trong Chrome/Safari. T18–T22 phải được thực hiện trước khi nghiệm thu ngoại tuyến.


## Bổ sung kiểm thử khung dán nội dung đề thi
- Đã thêm vùng dán văn bản lớn hơn trong tab “Dán văn bản”.
- Có nút “Chèn sẵn nội dung 26 câu”, nút xóa và liên kết tải TXT.
- Tệp `Noi_Dung_De_Thi_26_Cau.txt` được đưa vào precache Service Worker.
- Parser nhận diện toàn bộ 26/26 câu: 17 ABCD + 9 Đúng/Sai; không có lỗi.
- Test Service Worker xác nhận tệp TXT có trong precache cache v4.
- Tổng bộ test `sh tests/run_tests.sh`: EXIT 0.
