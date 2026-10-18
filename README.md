# Hệ thống quản lý thực tập tốt nghiệp

Đây là hệ thống quản lý thực tập tốt nghiệp dành riêng cho Trường Công nghệ Thông tin, Đại học Phenikaa. Cấu trúc được tổ chức theo domain để các tính năng tiếp theo được đặt đúng vị trí ngay từ đầu.

Hiện đã có workspace dữ liệu thật cho bảy vai trò, đăng nhập bằng phiên PostgreSQL, hồ sơ/import Excel, đăng ký/phân công, báo cáo PDF riêng tư và điểm 50% doanh nghiệp + 50% giảng viên. Sprint 5 đã nghiệm thu phạm vi đồ án local; xem [biên bản và giới hạn](docs/SPRINT_5_ACCEPTANCE.md). Không phải bản production Internet. Trang `/demo` là khu vực minh họa độc lập, không ghi dữ liệu nghiệp vụ.

Có thể chạy riêng frontend bằng `npm ci` rồi `npm run dev` tại thư mục `frontend/`. Xem `docs/TESTING.md` để chạy bộ kiểm tra.

## Chạy bằng Docker

Bản nâng cấp Phenikaa đã bổ sung Khoa–Ngành–Chương trình–Khóa, mật khẩu tự sinh, cấp tài khoản hàng loạt và phân quyền theo khoa/đợt. Giao diện dùng sidebar và URL riêng cho từng chức năng. Xem [hướng dẫn nâng cấp, dữ liệu cũ và kiểm thử](docs/PHENIKAA_UPGRADE.md).

Để chạy bản đã build phục vụ bàn giao, xem [bản đóng gói local](docs/LOCAL_RELEASE.md) tại cổng 3300, volume riêng. Các lệnh bên dưới là chế độ phát triển tại cổng 3000.

1. Cài Docker Desktop và Git, sau đó khởi động Docker Desktop.
2. Tạo file cấu hình nếu chưa có: `if (!(Test-Path .env)) { Copy-Item .env.example .env }`.
3. Đổi các secret mặc định trong `.env` trước khi dùng ngoài môi trường phát triển.
4. Chạy: `docker compose up --build`.
5. Truy cập frontend tại `http://localhost:3000`, API tại `http://localhost:3001/api/health`, MinIO Console tại `http://localhost:9001`.

Backend tự chạy `prisma generate` và `prisma migrate deploy` khi khởi động. Migration được version hóa; không reset database. Database test riêng là `internship_management_test`.

## Đăng nhập lần đầu

Chạy một lần để tạo tài khoản phát triển:

```powershell
docker compose exec backend npm run db:seed-demo
```

Mật khẩu ngẫu nhiên của `admin@interna.local` và `student@interna.local` được lưu tại `backend/.local/demo-accounts.txt`. Mở file này trên máy để lấy mật khẩu, không commit/chia sẻ file. Chạy seed lại không đổi mật khẩu tài khoản đã tồn tại. Seed bị vô hiệu hóa khi NODE_ENV là production; không dùng các tài khoản này ngoài môi trường local.

- Trang `/`: đăng nhập và workspace chung; Admin/điều phối có tạo đợt, import, xem/xác minh hồ sơ và cấp tài khoản.
- Trang `/demo`: xem giao diện mẫu không cần đăng nhập.
- Bảy vai trò có workspace theo quyền: Admin, Trưởng khoa, Điều phối viên, Giảng viên, Đại diện doanh nghiệp, Người hướng dẫn doanh nghiệp và Sinh viên.
- Tài khoản cấp từ hồ sơ phải đổi mật khẩu tạm trước khi gọi API nghiệp vụ. Màn hình đổi mật khẩu yêu cầu mật khẩu tạm, mật khẩu mới và xác nhận; có nút đăng xuất. Đổi thành công thu hồi các phiên khác.
- Không triển khai email/quên mật khẩu tự động trong phạm vi đồ án.

Quản trị có thể tạo tài khoản bằng tên, email, mật khẩu ban đầu từ 12–128 ký tự và vai trò. API kiểm tra quyền quản trị, không cho sinh viên tự tạo tài khoản hoặc tự nâng quyền.

Lệnh hữu ích:

```powershell
docker compose up -d --build
docker compose logs -f backend
docker compose down
```

Sau khi thay đổi dependencies frontend, cập nhật cả volume dependencies đang dùng:

```powershell
docker compose exec frontend npm ci
docker compose restart frontend
```

Source frontend được mount vào container nên các thay đổi giao diện được cập nhật trong chế độ dev. Thay đổi package, Dockerfile hoặc migration vẫn cần bước cài đặt/build/migration tương ứng.

Đây là cấu hình development, không phải triển khai production. Không dùng `down -v` hoặc `volume prune` khi cần giữ dữ liệu. Xem [sao lưu và khôi phục](docs/BACKUP_RESTORE.md) và [tiến độ Sprint 5](docs/SPRINT_5_PROGRESS.md).

Với dependencies backend: `docker compose exec backend npm ci`, sau đó `docker compose restart backend`. Nếu backend chưa khởi động được do thiếu package, dùng `docker compose run --rm --no-deps backend npm ci` rồi `docker compose up -d backend`.

## Kiểm thử E2E riêng

Sprint 4 có stack QA tách database/kho tệp khỏi dữ liệu chính. Chạy từ gốc dự án `docker compose -f docker-compose.e2e.yml up -d --build`, sau đó từ `frontend` chạy `npm run test:sprint4:all` (cần dependencies frontend, Docker và Chrome trên host). Xem [biên bản Sprint 4 và hướng dẫn](docs/SPRINT_4_ACCEPTANCE.md). Không dùng `down -v` hoặc tài khoản thật cho bộ test này.

## Nơi đặt mã nguồn về sau

Tài liệu bàn giao: [nghiệp vụ/quyền/use case](docs/BUSINESS_HANDOVER.md), [import và cấp tài khoản](docs/IMPORT_ACCOUNTS.md), [ERD](docs/ERD.md), [cài đặt local](docs/LOCAL_RELEASE.md), [backup/restore](docs/BACKUP_RESTORE.md).

- API NestJS: `backend/src/<domain>/`
- Prisma schema và migrations: `backend/prisma/`
- Giao diện Next.js: `frontend/src/app/` và `frontend/src/components/`
- Shared types/contracts: `shared/`
- Tài liệu kiến trúc và nghiệp vụ: `docs/`
- Cấu hình vận hành: `infra/`

Xem [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) để biết cây thư mục và quy ước chi tiết.
