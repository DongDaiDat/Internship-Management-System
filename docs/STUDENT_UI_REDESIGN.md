# Rà soát giao diện sinh viên

## Bố cục

Giao diện sinh viên sử dụng thanh bên và thanh đầu trang xanh đậm, điểm nhấn cam, nền xanh nhạt và thẻ trắng theo ảnh cổng Phenikaa do người dùng cung cấp. Các mục có URL riêng, tải lại và truy cập trực tiếp được:

| URL trong `/workspace/student/` | Nội dung |
| --- | --- |
| `overview` | Bốn chỉ số, việc cần xử lý và thông tin kỳ thực tập |
| `profile` | Nhận diện sinh viên, thông tin học vụ và cập nhật email liên hệ |
| `registration` | Đăng ký thực tập |
| `applications` | Trạng thái và lịch sử đăng ký |
| `reports` | Chọn tuần hoặc báo cáo cuối, chỉ mở một vùng nội dung |
| `documents` | Tệp báo cáo và minh chứng |
| `results` | Điểm tổng kết đã chốt hoặc trạng thái chờ |

Thanh tìm kiếm lọc chức năng trong không gian sinh viên. Điện thoại dùng menu trượt và danh sách tuần cuộn ngang. Hồ sơ học vụ chỉ đọc; email liên hệ được chỉnh riêng, không đổi email đăng nhập.

## Luồng báo cáo

- Hiển thị hạn nộp, trạng thái, nhận xét và nội dung đã gửi.
- Khóa nhập khi quá hạn, chưa đến ngày bắt đầu, đã được duyệt hoặc đã chốt điểm theo dữ liệu API; backend vẫn kiểm tra mọi thao tác.
- Cảnh báo nội dung chưa lưu khi đổi tuần, đổi kỳ, bấm liên kết hoặc tải lại trang.
- Giữ nguyên các API và dữ liệu tài khoản demo. Không thay đổi hạn nộp để làm đẹp dữ liệu minh họa.

## Kiểm tra

`frontend/tests/student-redesign-browser.cjs` kiểm tra 7 trang thật ở 1440, 1024 và 390 px, menu điện thoại, tìm kiếm, truy cập trực tiếp và không tràn ngang. Phần tương tác báo cáo dùng dữ liệu chặn tại trình duyệt để kiểm tra 12 tuần, lưu nội dung, cảnh báo chưa lưu, báo cáo đã duyệt, báo cáo cuối, điểm và trạng thái trống mà không sửa dữ liệu demo.

Ảnh và kết quả lưu trong `.local/student-redesign/`. Bộ `upgrade-browser.cjs` kiểm tra hồi quy giao diện các vai trò còn lại. Chạy thêm `npm test`, `npm run typecheck`, `npm run lint` và `npm run build` trong frontend.
