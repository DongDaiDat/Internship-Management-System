# Rà soát giao diện và tài khoản demo — 16/09/2026

## Giao diện

- Thống nhất xanh navy–cam ở đăng nhập, ứng dụng thật và demo; loại màu tím cũ ở link, badge, focus và nút lọc.
- Thẻ dùng padding 24 px desktop, 16 px mobile; các khối cách nhau 24 px, nhóm biểu mẫu 16 px, nhãn–ô nhập 8 px. Loại margin thừa khi khối cha đã có grid gap.
- Ô nhập/chọn/tệp cao 44 px; nút phân trang thống nhất, trạng thái vô hiệu hóa rõ ràng. Bảng rộng cuộn bên trong trên điện thoại.
- Bỏ footer lặp của demo; giữ một khung giao diện chung.

## Tài khoản demo local

Ứng dụng: `http://localhost:3000`. Bảy vai trò chính dùng email theo bảng bên dưới. Thông tin mật khẩu và bốn tài khoản sinh viên theo kịch bản được ghi trong `backend/.local/DEMO_ACCOUNTS.md`, không đưa vào Git.

| Vai trò | Email |
|---|---|
| Admin | admin@phenikaa-demo.local |
| Trưởng khoa | facultymanager@phenikaa-demo.local |
| Điều phối viên | internshipcoordinator@phenikaa-demo.local |
| Giảng viên | facultymentor@phenikaa-demo.local |
| Sinh viên | student@phenikaa-demo.local |
| Đại diện doanh nghiệp | company@phenikaa-demo.local |
| Hướng dẫn doanh nghiệp | companysupervisor@phenikaa-demo.local |

Demo có hồ sơ chờ cấp tài khoản, đợt mở đăng ký, hồ sơ chờ duyệt, yêu cầu ngoại lệ, báo cáo tuần và trường hợp đủ điểm để chốt. Bảy tài khoản chính đã bỏ bước đổi mật khẩu để vào kiểm thử ngay. Tài khoản tạo qua nghiệp vụ vẫn bắt đổi mật khẩu lần đầu.

`backend/scripts/prepare-demo-handover.cjs` chỉ chạy local, dùng danh sách tài khoản demo được định danh sẵn, ghi mật khẩu vào tài liệu local, không in ra console. Chạy lại sẽ phục hồi mật khẩu bảy actor và thu hồi phiên demo cũ; giữ tiến độ kịch bản đã tạo. Không chạy script khi người khác đang kiểm thử demo.

## Kiểm tra

- `node tests/visual-polish-browser.cjs` (frontend): đăng nhập đủ 11 tài khoản; mở form tài khoản và đợt; kiểm tra palette, focus, margin nhãn và tràn trang; chụp đăng nhập/demo ở 1440/1024/390.
- `node tests/upgrade-browser.cjs`: kiểm tra 22 trang của bảy vai trò ở cả ba kích thước; menu điện thoại, lỗi JS/API và thao tác sai quyền.
- `npm run lint`, `npm run typecheck`, `npm run build` tại frontend.
- Ảnh ở `.local/final-ui` và `.local/upgrade-screenshots`.

Khi build trong Docker development, dừng frontend trước để tránh Next dev và Next build ghi đồng thời vào `.next`; build xong dùng `docker compose start frontend`.
