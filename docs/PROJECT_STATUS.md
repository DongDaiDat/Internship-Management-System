# Trạng thái dự án

## Hiện tại

- Đã có scaffold Docker, frontend Next.js và backend NestJS tối thiểu.
- Chưa có Prisma schema, migration, authentication hoặc domain module nghiệp vụ.

## Việc tiếp theo

1. Phân tích hiện trạng và chốt domain model/use case MVP.
2. Thiết lập Prisma, PostgreSQL, authentication và RBAC.
3. Triển khai theo vertical slice, bắt đầu từ nền tảng và master data.

## Known issues

- Docker build sẽ tải dependencies lần đầu; cần kết nối Internet.
- Các secret trong `.env.example` chỉ dành cho môi trường local.
