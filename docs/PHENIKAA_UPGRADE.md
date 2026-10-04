# Nâng cấp tài khoản, học vụ và giao diện Phenikaa

## Sử dụng

- Mở `http://localhost:3000`; chọn không gian làm việc nếu tài khoản có nhiều vai trò.
- Admin: Tài khoản, Chờ cấp tài khoản, Danh mục đào tạo. Mật khẩu được sinh bằng bộ sinh ngẫu nhiên bảo mật, chỉ lưu bản băm. Reset thu hồi phiên cũ. Kết quả cấp chỉ ở bộ nhớ trang; tải CSV và bàn giao kín trước khi rời trang.
- Điều phối: hồ sơ/import/doanh nghiệp trong khoa; tạo, sửa bản nháp, công bố và vận hành đợt mình phụ trách.
- Trưởng khoa: duyệt đăng ký/ngoại lệ, chọn giảng viên ban đầu, chuyển điều phối trong khoa, chốt điểm và xem kết quả khoa.
- Giảng viên, sinh viên, đại diện và người hướng dẫn doanh nghiệp giữ phạm vi hồ sơ/phân công hiện có.

Các URL `/workspace/{vai-tro}/{chuc-nang}` hỗ trợ tải lại và truy cập trực tiếp. `/demo` dùng chung khung sidebar, dữ liệu minh họa độc lập.

## Danh mục và dữ liệu cũ

Migration `202609160001_academic_structure` bổ sung quan hệ nullable, không suy đoán khoa từ MSV và không xóa dữ liệu cũ. Chạy `npm run db:seed-academic` sau migration (môi trường Docker dev tự chạy).

Migration `202609160002_import_department` giữ khoa gốc của lô import. Lô xem trước cũ không có khoa cần tải lại để kiểm tra; không tự chuyển lô sang khoa mới khi cán bộ đổi khoa.

- Ba khoa: Khoa học máy tính; Hệ thống thông tin; Trí tuệ nhân tạo và Khoa học dữ liệu.
- Tám ngành, mười chương trình; Ngành và Chương trình là hai bảng riêng. Nguồn đối chiếu: [tuyển sinh 2026](https://psc.phenikaa-uni.edu.vn/vi/post/tin-tuc/tuyen-sinh-2026), [đội ngũ khoa](https://psc.phenikaa-uni.edu.vn/vi/page/doi-ngu-can-bo-giang-vien).
- Liên kết khoa của ICT6, ICT7, ICT8 chưa được xác nhận trong nguồn đã đối chiếu; Admin cần bổ sung nguồn và xác nhận trước khi dùng. Không tự gán ba chương trình này vào khoa.
- Admin dùng **Danh mục đào tạo → dữ liệu chưa gán khoa** để phân về khoa; gán khoa cán bộ ở **Tài khoản**. Trưởng khoa gán điều phối cho đợt; điều phối hoàn thiện hồ sơ và đợt thuộc phạm vi mình.
- Đợt cũ đã công bố nhưng chưa có đối tượng: nút **Hoàn thiện học vụ đợt cũ** chỉ bổ sung metadata và đối tượng. Giữ lịch và lịch sử; mọi đăng ký hiện hữu phải khớp đối tượng mới. Cấu hình đã hoàn thiện không được sửa bằng đường dẫn này.

Sinh viên bắt buộc có Khoa–Ngành–Chương trình–Khóa để xác minh/cấp tài khoản. Ví dụ demo Minh Anh, MSV 23010877, K17, ngành/chương trình CNTT, Khoa Hệ thống thông tin. Đợt có mã `số_HKkỳ_năm-học`, duy nhất trong khoa. Nhóm đối tượng là OR của từng bộ Ngành–Khóa–Chương trình; không ghép chéo các nhóm. Kiểm tra lại khi duyệt; ngoại lệ tín chỉ không bỏ qua đối tượng.

## API chính

| API (tiền tố `/api`) | Quyền |
|---|---|
| `POST /users` | Admin; không nhận password; trả temporaryPassword |
| `GET /users/pending`, `POST /users/provision` | Admin; tối đa 100 hồ sơ/lần |
| `POST /users/:id/reset-password`, `POST /users/:id/access` | Admin; thu hồi phiên |
| `GET /academic`, `POST /academic/:kind` | Đọc khi đã đổi mật khẩu; ghi chỉ Admin |
| `POST /internship-periods/:id/update` | Điều phối phụ trách; chỉ bản nháp |
| `POST /internship-periods/:id/complete-academic` | Điều phối phụ trách; chỉ cấu hình học vụ cũ còn thiếu |

Cấp phát khóa hồ sơ trong giao dịch, tạo và liên kết tài khoản nguyên tử. Hồ sơ đã có tài khoản được bỏ qua; trùng email khác hồ sơ trả lỗi, không tự liên kết/reset. Vai trò lấy từ loại hồ sơ, không lấy cột Excel. Không gửi email tự động.

## Kiểm tra

- Backend: `npm test` (14), `npm run test:integration` (52), `npm run test:upgrade` (6). Chỉ dùng database tên kết thúc `_test`; runner nâng cấp tạo `internship_upgrade_test` riêng.
- Frontend: `npm test` (11); `npm run test:upgrade` kiểm tra 22 trang thuộc bảy vai trò, ảnh 1440/1024/390 và menu điện thoại. `node tests/upgrade-account-browser.cjs` kiểm tra tạo tài khoản, vòng đời kết quả cấp và đổi mật khẩu qua UI.
- Typecheck, lint và build chạy riêng trong từng thư mục backend/frontend.
- Ảnh kiểm tra ở `.local/upgrade-screenshots` (không commit). Tài khoản demo local ở `backend/.local/upgrade-demo.json` (không commit, không dùng cho triển khai thật).

Màu navy `#123B70`, cam `#F58220` là bảng màu ứng dụng tham khảo nhận diện Phenikaa, không tuyên bố là mã thương hiệu chính thức. Giao diện dùng sidebar 256 px và menu trượt trên màn hình nhỏ.
