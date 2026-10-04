# Database và migration

PostgreSQL được quản lý bằng Prisma 6.19.0. Migration `202609090001_auth_foundation` tạo năm bảng nền tảng và enum Role, cùng foreign key/index. Migration đã chạy trên database local và database test riêng. Không thay đổi hoặc reset lịch sử migration đã áp dụng.

Backend Docker khởi động theo thứ tự: Prisma generate → migrate deploy → NestJS watch. Thay đổi schema tiếp theo cần tạo/review migration mới; migrate deploy chỉ áp dụng migration có sẵn, không tự suy ra SQL từ schema thay đổi.

```powershell
docker compose exec backend npm run db:generate
docker compose exec backend npm run db:deploy
docker compose exec backend npm run db:seed-demo
```

Test tích hợp chạy trên `internship_management_test`. Runner chỉ chấp nhận URL có tên database kết thúc `_test`. Với Compose mặc định, nó tự suy ra URL test từ URL local; ngoài Compose phải đặt TEST_DATABASE_URL riêng. Test tạo fixture có prefix ngẫu nhiên, không dùng tài khoản seed local. Không chạy test lên database thật.

Schema hiện có 7 migration và đầy đủ hồ sơ, đợt, eligibility, thực tập, báo cáo, điểm, tệp, import và audit. Dữ liệu fixture/seed không phải dữ liệu chính thức. Sprint 5 đã kiểm tra migration trên database trống và nâng cấp từ 3 migration cũ, giữ lịch Published. Bản [release local](LOCAL_RELEASE.md) dùng job migrate riêng thay cho quy trình watch ở trên; xem [backup/restore](BACKUP_RESTORE.md).
