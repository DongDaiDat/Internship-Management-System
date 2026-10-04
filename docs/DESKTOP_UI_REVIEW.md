# Đồng bộ giao diện desktop

## Phạm vi

- Khung chung cho bảy vai trò: sidebar và topbar xanh đậm, tìm chức năng theo không gian hiện tại, tài khoản, breadcrumb, nền nhạt và điểm nhấn cam.
- Bảng nghiệp vụ: cỡ chữ 14 px, tiêu đề rõ, hàng gọn, viền nhẹ và phản hồi khi di chuột.
- Bộ lọc đợt có vùng riêng; biểu mẫu, nhóm trường, trạng thái và nút dùng khoảng cách thống nhất.
- Giảng viên và doanh nghiệp chọn một hồ sơ sinh viên để làm việc. Giữ nguyên nghiệp vụ, kiểm tra quyền và API; có cảnh báo khi đổi hồ sơ đang nhập và khóa bộ chọn khi đang gửi.
- Ưu tiên desktop 1440 và 1920 px. Không thay đổi tài khoản hoặc mật khẩu demo.

## Kiểm chứng

- `UPGRADE_DESKTOP_ONLY=1 node tests/upgrade-browser.cjs`: 22 trang theo vai trò ở hai độ rộng desktop; kiểm tra lỗi JavaScript, cảnh báo API, tràn ngang và chuyển sinh viên. Có thể giới hạn vai trò qua `UPGRADE_ROLES` (danh sách phân cách bằng dấu phẩy).
- `node tests/desktop-forms-browser.cjs`: mở tạo tài khoản, danh mục và đợt thực tập, kiểm tra hai độ rộng; không gửi biểu mẫu.
- Ảnh chụp lưu tại `.local/desktop-redesign/`.
- Chạy typecheck, lint, 11 kiểm thử frontend và production build.
