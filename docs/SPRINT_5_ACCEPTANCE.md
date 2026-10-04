# Sprint 5 — biên bản nghiệm thu

Ngày nghiệm thu: **15/09/2026**. Kết luận: **hoàn tất Sprint 5 trong phạm vi đồ án local đã thống nhất**. Không chứng nhận sẵn sàng production Internet hoặc vận hành toàn đại học. Không push GitHub, không reset/xóa dữ liệu chính.

## Kết quả thực thi

| Nhóm | Bằng chứng và kết quả |
|---|---|
| Backend | Format, lint, typecheck, build PASS; **14/14 unit + 52/52 integration PASS** trên database test riêng |
| Frontend | Format, lint, typecheck, production build PASS; **11/11 test logic PASS** |
| E2E development | `node frontend/tests/run-sprint4.cjs`: toàn bộ chuỗi PASS trong lượt nghiệm thu này |
| E2E image đóng gói | `QA_BUILT=true`: cùng toàn bộ chuỗi bảy actor PASS; ứng dụng chạy release image, không mount source/node_modules |
| Chuỗi E2E | Đăng nhập bảy role; import thiếu cột/lỗi dòng/preview/confirm; cấp mật khẩu một lần/đổi đầu tiên; đăng ký/hủy/chặn quá hạn; ngoại lệ/duyệt/phân công; đổi công ty/giảng viên đầu kỳ; báo cáo tuần/cuối/PDF/nhận xét/mở khóa; supervisor và khoa nhập thay có chứng cứ; chốt **8,5** và khóa sửa; dashboard/audit/Excel |
| Layout | 390/768/1440 px; không root overflow trong kịch bản, không pageerror/HTTP 5xx; kiểm tra label/focus/keyboard/tên tiếng Việt dài trong suite |
| Release local | Build frontend/backend/migration PASS; startup từ volume trống áp dụng đủ 7 migration; health PASS, UID runtime 1000, chỉ public 127.0.0.1:3300 |
| Restart release | Smoke Admin/Student trước và sau restart PASS; smoke cuối PASS, tài khoản giữ nguyên |
| Migration | Database trống + deploy lặp PASS; nâng từ 3 migration cũ lên 7 PASS, lịch Published giả lập giữ nguyên, không tự lấp lịch thiếu |
| Backup/restore mới | Backup QA `qa-20260915-220307-15a793fc9bdd4243836570d4f110d5f5`; restore project `internship-restore-9f95311c236b`; SHA-256 **22 bảng + 14 PDF PASS**, trước/sau restart |
| API sau restore | Chưa đăng nhập 401, sinh viên chủ hồ sơ tải PDF 200/hash đúng, file thực tập khác 403: PASS |
| Dependency | `npm audit --omit=dev --audit-level=high` backend và frontend: **0 vulnerabilities** tại thời điểm chạy; không phải bảo đảm vĩnh viễn hoặc pentest |
| Git/secrets | Scanner candidate files PASS, không có private paths bị track; rà marker key/token trên commit hiện có `b649708` không phát hiện; `git diff --check` PASS |
| CI | Backend/frontend/release workflow đã cấu hình; release workflow thêm E2E đầy đủ trên built images. **Chưa chạy GitHub Actions** vì chưa push/được yêu cầu push |

Đã sửa hai lỗi format trong file test trước khi chốt; lượt format cuối cả hai ứng dụng PASS. Không có lỗi chặn luồng, sai điểm hoặc rò phạm vi được phát hiện trong bộ kiểm thử đã chạy. Đây không có nghĩa không thể tồn tại lỗi ngoài phạm vi test.

## Tài liệu bàn giao

- [Cài và chạy bản local](LOCAL_RELEASE.md), [README](../README.md).
- [Import/cấp tài khoản](IMPORT_ACCOUNTS.md).
- [Actor, ma trận quyền, quy trình, use case, quy tắc điểm](BUSINESS_HANDOVER.md).
- [ERD](ERD.md), [database](DATABASE.md), [kiến trúc](ARCHITECTURE.md).
- [Backup/restore](BACKUP_RESTORE.md), [bảo mật](SECURITY.md), [kiểm thử](TESTING.md).

## Tái chạy E2E trên bản đóng gói

Cần Node, Docker Desktop/Compose hỗ trợ `!reset`, Chrome và dependencies frontend trên host. Chạy từ gốc repo; `.env` local hợp lệ. Không chạy đồng thời suite development và suite built vì dùng chung QA stack/fixture; không chạy liên tục quá giới hạn login.

```powershell
docker compose -f docker-compose.release.yml build
docker compose -f docker-compose.e2e.yml build
cd frontend
npm ci
cd ..
$env:QA_BUILT='true'
node frontend/tests/run-sprint4.cjs
Remove-Item Env:QA_BUILT
docker compose -f docker-compose.e2e.yml stop
```

Tooling tạo fixture dùng source riêng, còn API/frontend trong lúc test dùng image release. Hai bộ fixture baseline `qa-sprint4` và `qa-sprint5-built` tách tài khoản, không chỉnh lịch đợt cũ. Script chỉ thêm dữ liệu QA; không reset. Nếu fixture quá cũ, tạo bộ QA mới có kiểm soát thay vì sửa lịch Published hoặc bỏ kiểm tra deadline.

Ảnh kiểm thử ở `frontend/.local/sprint4`, `frontend/.local/sprint3`, `frontend/.local/sprint5`; không commit cùng dữ liệu/tài khoản fixture. Backup chứa dữ liệu nhạy cảm trong `.local/backups`; không đính kèm vào repository.

## Giới hạn bàn giao cần biết

1. Chạy sạch được kiểm chứng bằng volume/database mới trên máy này; chưa trực tiếp kiểm tra trên máy thứ hai. CI đã cấu hình nhưng chưa có run từ GitHub. Đây là giới hạn bằng chứng, không được trình bày như đã chạy từ xa.
2. Bản local chỉ HTTP loopback, không dành công khai Internet. HTTPS/trusted proxy, quản lý secrets tập trung, quên mật khẩu/email, dọn dữ liệu định kỳ, tải lớn, HA và pentest nằm ngoài phạm vi đồ án.
3. Schema học vụ giản lược tín chỉ/nợ học phần/xác minh; không đồng bộ hệ đào tạo. Không có UI quản trị sửa/khóa/reset mọi tài khoản hoặc quy trình khiếu nại nhiều cấp.
4. Docker dùng tag image có thể thay đổi, đặc biệt MinIO `latest`. Giữ image đã kiểm thử khi bàn giao; lần tải phiên bản mới phải chạy lại kiểm thử, không khẳng định restore xuyên phiên bản.
5. Restore rehearsal chỉ phục hồi QA vào project mới, không cung cấp nút ghi đè môi trường chính. Login kiểm tra API sau restore tạo session/audit trên bản khôi phục: phải đối chiếu fingerprint **trước** bước này.

QA và project restore đã dừng sau nghiệm thu, volume vẫn giữ để đối chiếu. Bản local release tại `http://localhost:3300` còn chạy. Không xóa dữ liệu để làm sạch số liệu demo.
