# Hệ thống quản lý thực tập tốt nghiệp

Đây là khung khởi tạo cho ứng dụng quản lý toàn bộ vòng đời thực tập tốt nghiệp. Cấu trúc được tổ chức theo domain để các tính năng tiếp theo được đặt đúng vị trí ngay từ đầu.

## Chạy bằng Docker

1. Cài Docker Desktop và Git, sau đó khởi động Docker Desktop.
2. Tạo file cấu hình: `Copy-Item .env.example .env`.
3. Đổi các secret mặc định trong `.env` trước khi dùng ngoài môi trường phát triển.
4. Chạy: `docker compose up --build`.
5. Truy cập frontend tại `http://localhost:3000`, API tại `http://localhost:3001/api/health`, MinIO Console tại `http://localhost:9001`.

Lệnh hữu ích:

```powershell
docker compose up -d --build
docker compose logs -f backend
docker compose down
docker compose down -v # xóa cả dữ liệu Docker cục bộ
```

## Đưa lên GitHub

Tạo một repository rỗng trên GitHub, không tạo README hoặc `.gitignore` tại GitHub. Trong thư mục này, chạy:

```powershell
git init
git add .
git commit -m "chore: initialize internship management scaffold"
git branch -M main
git remote add origin https://github.com/<tai-khoan>/<ten-repository>.git
git push -u origin main
```

Không commit `.env`, dữ liệu database hay file upload. Hãy chỉ commit `.env.example`.

## Nơi đặt mã nguồn về sau

- API NestJS: `backend/src/<domain>/`
- Prisma schema và migrations: `backend/prisma/`
- Giao diện Next.js: `frontend/src/app/` và `frontend/src/components/`
- Shared types/contracts: `shared/`
- Tài liệu kiến trúc và nghiệp vụ: `docs/`
- Cấu hình vận hành: `infra/`

Xem [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) để biết cây thư mục và quy ước chi tiết.
