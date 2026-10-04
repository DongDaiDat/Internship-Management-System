# Quyết định triển khai

## 2026-09-09 Giao diện trải nghiệm đầu tiên

Theo ưu tiên giao diện đẹp và thao tác ngắn gọn, xây dựng không gian sinh viên trước để kiểm chứng UX: tổng quan, thông tin kỳ thực tập, báo cáo tuần. Tên hiển thị tạm thời là interna, dùng màu tím nhẹ và bố cục thẻ.

Dữ liệu minh họa phải luôn được ghi nhãn rõ. Lưu nháp bằng localStorage chỉ dùng cho bản trải nghiệm, không ghi hồ sơ chính thức hoặc trạng thái phê duyệt. Chưa có đăng nhập và không có API nhận báo cáo công khai. Các dữ liệu 12 tuần, 480 giờ và hạn nộp là ví dụ, không phải quy định đã chốt.

Giữ kiến trúc Next.js và NestJS đã chọn. CSS thuần được dùng cho giao diện đầu tiên; Tailwind chưa tích hợp. Nghiệp vụ sẽ được triển khai theo module sau khi có nền tảng Prisma, authentication và phân quyền. Không suy diễn rằng giao diện hiện tại đã hoàn thành workflow.

Giữ Next.js 15.5.25 và khóa PostCSS 8.5.28 qua npm overrides để xử lý cảnh báo audit của dependency transitive; phải kiểm tra lại override khi nâng Next.js. Frontend có package-lock.json và Docker dùng npm ci để tái lập dependencies.

Docker frontend dùng volume riêng cho `.next` để tránh trộn cache build Windows và Linux. Hai môi trường vẫn dùng chung source nhưng không dùng chung build output.

## Nền tảng authentication và quản trị tài khoản

Chọn opaque session lưu PostgreSQL thay vì JWT để dễ thu hồi phiên và áp dụng quyền mới ngay. JWT_SECRET của scaffold cũ không còn được sử dụng. Prisma 6.19.0 được khóa phiên bản; các override multer/effect/deepmerge-ts xử lý cảnh báo dependency, đã kiểm tra lại generate, build và migration. Cần đánh giá lại override khi nâng framework/Prisma.

Chỉ Admin có quyền quản lý tài khoản trong giai đoạn nền tảng. Chưa mở self-registration hoặc cấp quyền toàn hệ thống cho Coordinator/FacultyManager. Đây là phạm vi kỹ thuật ban đầu, không tự chốt quy trình duyệt thực tập.

Các API ghi kiểm tra Origin; frontend chuyển tiếp request qua Next.js cùng origin. SessionGuard kiểm tra user active và permission từ database. Các thao tác quan trọng tạo audit trong transaction.

Test tích hợp phát hiện dev watcher ghi đè module cũ vào dist; đã tắt incremental backend, tách volume backend-dist và biên dịch test vào .test-build. Test không được sử dụng output của dev watcher.
