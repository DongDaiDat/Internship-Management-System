# Kiến trúc

Hệ thống dùng modular monolith: Next.js frontend gọi NestJS REST API qua Nginx; NestJS truy cập PostgreSQL qua Prisma. MinIO dùng cho file private và chỉ được cấp quyền truy cập thông qua backend. Redis chỉ được bổ sung khi có nhu cầu nghiệp vụ hoặc kỹ thuật đã được ghi nhận.
