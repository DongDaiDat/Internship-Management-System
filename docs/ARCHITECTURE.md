# Kiến trúc

Hệ thống dùng modular monolith. Trong chế độ local, trình duyệt gọi `/api/*` cùng origin với Next.js; Next.js chuyển tiếp sang NestJS qua INTERNAL_API_URL. Nginx là profile proxy tùy chọn. NestJS truy cập PostgreSQL qua Prisma.

Các module đã có: PrismaModule cung cấp truy cập database, AuthModule quản lý đăng nhập và phiên, UsersModule quản lý danh sách/tạo tài khoản. SessionGuard được đăng ký toàn cục; chỉ health và login được đánh dấu Public. Quyền quản trị được kiểm tra phía server bằng RequirePermission.

Session lưu hash SHA-256 của token ngẫu nhiên, thời hạn tuyệt đối 8 giờ. Cookie HttpOnly, SameSite Strict; production dùng Secure và tên __Host-interna_session. Mỗi request đọc lại trạng thái tài khoản/vai trò nên thay đổi quyền có hiệu lực ngay. Nguồn của các request ghi phải nằm trong APP_ORIGINS.

MinIO đã chạy như hạ tầng nhưng chưa có API upload/download. Thiết kế dự kiến chỉ cho truy cập file private sau authorization backend. Redis chưa được sử dụng.

Output frontend `.next`, backend `dist` được tách bằng volume Docker; test backend biên dịch vào `.test-build` để tránh dev watcher ghi đè build kiểm thử.
