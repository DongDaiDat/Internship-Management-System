# Bản đóng gói local để bàn giao đồ án

Bản `docker-compose.release.yml` chạy mã đã build, không watch, không mount mã nguồn hoặc node_modules từ máy chủ. Frontend là Next.js standalone; backend chỉ mang dependencies runtime và chạy bằng user `node` không phải root. Migration là job riêng, phải thành công trước khi API khởi động.

**Đây không phải production Internet.** Chỉ mở `127.0.0.1:3300`; database, API và MinIO không công khai cổng. Backend chủ động dùng `NODE_ENV=development` để cookie hoạt động trên HTTP local; frontend vẫn chạy bản production build. Không đổi cổng bind thành `0.0.0.0` để công khai bản này. Khi triển khai thật cần HTTPS, backend `NODE_ENV=production`, danh sách `APP_ORIGINS` HTTPS, secrets và vận hành riêng.

## Cài từ mã nguồn

Yêu cầu Docker Desktop đang chạy (Linux containers), Docker Compose v2 và Internet để tải image/npm ở lần build đầu. Không cần cài Node/PostgreSQL trên máy để chạy bản đóng gói. Chạy từ thư mục gốc repository:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose -f docker-compose.release.yml up -d --build
docker compose -f docker-compose.release.yml ps -a
```

Trước khi chạy, đổi mật khẩu mẫu trong `.env`; cập nhật đồng bộ `DATABASE_URL` với PostgreSQL (host phải là `postgres`, tên database phải khớp `POSTGRES_DB`). Nếu mật khẩu có ký tự đặc biệt, mã hóa phần mật khẩu trong URL. Không paste `.env` hoặc kết quả `docker compose config` chứa secrets vào nơi công khai.

Mở `http://localhost:3300`. API health cùng origin: `http://localhost:3300/api/health`. Project/volume `internship-release_*` tách khỏi dữ liệu development và E2E. Database trống ban đầu là bình thường: không tự seed tài khoản hoặc thay lịch đợt cũ.

## Tài khoản khởi đầu và dữ liệu

Để trải nghiệm đủ bảy actor với cùng một mật khẩu dễ nhớ, chạy:

```powershell
docker compose -f docker-compose.release.yml exec -e DEMO_SHOWCASE_CONFIRM=local-only backend node scripts/seed-showcase.cjs
docker compose -f docker-compose.release.yml cp backend:/app/.local/showcase-accounts.txt .local/showcase-accounts.txt
```

Mặc định cả bảy tài khoản dùng `Phenikaa@2026`, không bắt đổi ở lần đăng nhập đầu và được gắn sẵn một kỳ thực tập đang diễn ra. Chạy lại đặt lại mật khẩu của đúng bảy email `*.demo@interna.local`, thu hồi phiên cũ và không reset tiến độ báo cáo/điểm đã thử. Có thể truyền `-e DEMO_PASSWORD=<mat-khau-12-128-ky-tu>` để đổi mật khẩu chung. Chỉ dùng local; script từ chối `NODE_ENV=production` và yêu cầu cờ xác nhận rõ ràng.

| Actor | Email demo |
|---|---|
| Admin | `admin.demo@interna.local` |
| Trưởng khoa | `truongkhoa.demo@interna.local` |
| Điều phối viên | `dieuphoi.demo@interna.local` |
| Giảng viên hướng dẫn | `giangvien.demo@interna.local` |
| Đại diện doanh nghiệp | `doanhnghiep.demo@interna.local` |
| Người hướng dẫn doanh nghiệp | `huongdan.demo@interna.local` |
| Sinh viên | `sinhvien.demo@interna.local` |

Chủ động tạo hai tài khoản local để vào giao diện quản trị:

```powershell
docker compose -f docker-compose.release.yml exec backend node scripts/seed-demo.cjs
New-Item -ItemType Directory -Force .local | Out-Null
docker compose -f docker-compose.release.yml cp backend:/app/.local/demo-accounts.txt .local/release-demo-accounts.txt
```

Mở file trên máy để lấy mật khẩu ngẫu nhiên; không commit/chia sẻ. Bản gốc nằm trong volume `release-bootstrap`, không mất khi thay container. Không copy đè một file bàn giao mật khẩu đang cần giữ. Seed chạy lại không đổi mật khẩu tài khoản tồn tại. Không dùng `npm run db:seed-demo` trong runtime release vì lệnh đó cần Nest CLI và mã nguồn; dùng lệnh `node` ở trên. `npm prune --omit=dev` vẫn giữ các peer dependency do Prisma yêu cầu, không khẳng định image không chứa TypeScript/Prisma CLI.

Đăng nhập Admin để thêm tài khoản Trưởng khoa/Điều phối viên. Nhập/import hồ sơ qua UI rồi cấp tài khoản từ hồ sơ theo hướng dẫn nghiệp vụ. Không dùng fixture E2E làm dữ liệu chính, không chạy script QA vào database release.

## Cập nhật và sao lưu

```powershell
pwsh -File scripts/backup-local.ps1 -Stack release
pwsh -File scripts/backup-local.ps1 -Stack release -Execute
docker compose -f docker-compose.release.yml up -d --build
```

Backup tạm dừng các bên ghi, cần thực hiện lúc không có người thao tác. Giữ bản mã nguồn/image tương ứng backup và thông tin bàn giao tài khoản ở nơi an toàn riêng. Script restore rehearsal hiện chỉ nhận backup QA; không dùng nó để ghi đè release. Xem [backup/restore](BACKUP_RESTORE.md).

Đổi `.env` không tự đổi mật khẩu PostgreSQL trong volume đã tồn tại. Nếu gặp lỗi xác thực sau đổi env, dùng lại cấu hình đúng của volume và lập kế hoạch đổi mật khẩu database; không xóa volume để chữa lỗi.

## Chẩn đoán và dừng

```powershell
docker compose -f docker-compose.release.yml logs --tail 80 migrate backend frontend
docker compose -f docker-compose.release.yml restart backend frontend
docker compose -f docker-compose.release.yml stop
```

- Migration lỗi: đọc log `migrate`, sửa cấu hình/kết nối hoặc migration mới đã review; không `migrate reset`.
- Trình duyệt không vào được: kiểm tra Docker, health và cổng 3300; không mở frontend bằng IP LAN.
- 403 khi ghi: dùng đúng `localhost:3300`/`127.0.0.1:3300`, đăng nhập đúng vai trò và kiểm tra thời hạn nghiệp vụ.
- 429 đăng nhập: đợi cửa sổ giới hạn 15 phút, không xóa dữ liệu bộ đếm để bỏ kiểm soát.
- Tệp lỗi: kiểm tra MinIO; giữ cả database và kho tệp khi chuyển máy.
- Không dùng `down -v`/`volume prune`. `stop` giữ nguyên dữ liệu.

## Giới hạn nghiệm thu

Bản build local không đồng nghĩa production-ready. Sprint 5 đã chạy đạt toàn bộ E2E bảy actor/import/PDF/điểm bằng image release trên QA riêng, ngoài smoke Admin/Student. Xem [biên bản](SPRINT_5_ACCEPTANCE.md). Cài từ volume trống được kiểm chứng trên máy hiện tại, chưa thử trực tiếp máy thứ hai hoặc GitHub Actions.
