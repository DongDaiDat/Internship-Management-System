# Bảo mật nền tảng tài khoản

## Ghi chú bản đóng gói local — Sprint 5

`docker-compose.release.yml` chỉ bind 127.0.0.1:3300, tách database/kho tệp, runtime UID 1000 và không mount source. Backend dùng chế độ cookie HTTP local có chủ đích; không coi đây là production HTTPS. Hướng dẫn ở [LOCAL_RELEASE.md](LOCAL_RELEASE.md). `.env.*` và `.local` bị loại khỏi Git/build context; `node scripts/check-public-files.cjs` rà soát heuristic file chuẩn bị bàn giao, không quét toàn lịch sử Git và không chứng nhận không còn secrets. Không công khai stack này lên Internet.

Mật khẩu được băm bằng scrypt với salt ngẫu nhiên 16 byte, N=32768, r=8, p=3 và so sánh timingSafeEqual. API không trả passwordHash hoặc token trong JSON. Các lỗi nội bộ trả thông báo chung, không trả chi tiết Prisma/SQL.

Token phiên ngẫu nhiên 32 byte được gửi qua cookie HttpOnly, SameSite=Strict, Path=/. Database chỉ lưu SHA-256 của token. Phiên hết hạn sau 8 giờ; logout xóa phiên trong database. Production dùng cookie Secure với prefix __Host- và APP_ORIGINS phải khai báo HTTPS.

Các API được bảo vệ mặc định. User active và role/permission được đọc lại ở mỗi request. DTO từ chối trường lạ; chỉ Admin quản lý /api/users, cấp hàng loạt, sửa vai trò/khoa và cấp lại mật khẩu tạm. Đổi quyền hoặc reset thu hồi phiên cũ. /auth/me lấy danh tính từ phiên, không lấy userId do client truyền.

Mọi request ghi phải có Origin khớp chính xác APP_ORIGINS. Không bật CORS rộng. Frontend gọi API qua proxy cùng origin; không lưu token vào localStorage. Bản nháp báo cáo trong localStorage chỉ là dữ liệu trải nghiệm, không phải hồ sơ nghiệp vụ bảo mật hoàn chỉnh.

Giới hạn login: 10 lần/email và 100 lần/IP trong 15 phút; bộ đếm dùng upsert atomic PostgreSQL, giữ hiệu lực khi restart. Backend chưa tin X-Forwarded-For, nên khi qua proxy nhiều người dùng có thể cùng bucket IP. Trước triển khai nhiều người dùng cần cấu hình trusted proxy/rate limit phù hợp, HTTPS, quy trình reset mật khẩu và lịch dọn Session/LoginThrottle hết hạn. Audit hiện ghi các thao tác thành công login/logout/tạo tài khoản; chưa có pipeline cảnh báo đăng nhập thất bại.

Tài khoản seed chỉ dành cho local, mật khẩu được sinh ngẫu nhiên và lưu backend/.local/demo-accounts.txt. Thư mục này bị loại khỏi Git và Docker build context. Không công khai Compose development ra Internet; chưa có cấu hình production hoàn chỉnh.

## Bổ sung ngày 11/09/2026

- `mustChangePassword` được chặn tại SessionGuard cho tất cả vai trò, kể cả Admin. Khi đang dùng mật khẩu tạm, chỉ cho phép các API có xác thực `auth/me`, `auth/change-password`, `auth/logout`; không dựa vào việc ẩn giao diện.
- `POST /api/auth/change-password` nhận `{ currentPassword, password }`. Bắt buộc mật khẩu hiện tại đúng, mật khẩu mới khác mật khẩu cũ và dài 12–128 ký tự. Giới hạn 10 lần thử đổi/tài khoản/15 phút.
- Đổi mật khẩu, tắt cờ bắt buộc đổi, thu hồi phiên khác và ghi audit nằm trong một transaction. Phiên đang thực hiện được giữ lại. Login và đổi mật khẩu khóa cùng bản ghi User để tránh tạo phiên từ mật khẩu cũ sau khi đổi.
- Ghi điểm, báo cáo, phân công liên quan và chốt điểm sử dụng khóa bản ghi Internship trong transaction. Đã chốt trả 409; audit của các thao tác này nằm cùng transaction với dữ liệu.
- Duyệt thực tập khóa StudentProfile và FacultyProfile để kiểm tra một thực tập hiệu lực và quota trong cùng transaction. Đổi giảng viên cũng khóa FacultyProfile đích, kiểm tra quota và ghi `AuditLog.reason` riêng.
- Chưa nghiệm thu toàn bộ quyền/scoping, hạn nộp/chấm hoặc luồng mở khóa. Không coi các cải tiến này là chứng nhận sẵn sàng production.
