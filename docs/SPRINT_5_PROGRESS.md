# Sprint 5 — đóng gói và nghiệm thu cuối

Trạng thái: **đã nghiệm thu Sprint 5 ngày 15/09/2026 trong phạm vi đồ án local**. Xem [biên bản cuối](SPRINT_5_ACCEPTANCE.md) và giới hạn bằng chứng. Các mục theo đợt phía dưới là lịch sử, không thay thế kết luận mới nhất. Không thay đổi phạm vi nghiệp vụ hoặc công thức 50/50.

## Đợt đầu

- Rà soát cấu hình: Docker hiện là development (watch/bind mount), không được gọi là bản production.
- CI backend/frontend đã có lint, typecheck, test và build; chưa khẳng định workflow GitHub đã chạy thành công.
- Thêm script sao lưu local có preview mặc định, chọn rõ main/qa, tạm dừng bên ghi dữ liệu, lưu PostgreSQL và MinIO cùng bộ, SHA-256 và phục hồi trạng thái chạy trước đó.
- Script không chứa mật khẩu, không xóa volume và không tự khôi phục đè database. Backup chứa dữ liệu nhạy cảm, đặt trong `.local` đã được ignore.
- Cập nhật README theo workspace bảy vai trò; bỏ lệnh xóa volume khỏi ví dụ thường dùng.

## Các cổng nghiệm thu còn lại

- [x] Chạy Docker từ database trống và kiểm tra migration nâng cấp trên máy local.
- [x] Chạy backup thật trên QA; khôi phục vào stack mới, đối chiếu bản ghi và byte PDF qua S3.
- [x] Kiểm tra restart giữ nguyên dữ liệu và lịch đã công bố trong bản khôi phục.
- [x] Đóng gói bản build local, ghi rõ yêu cầu HTTPS/cookie khi dùng production.
- [x] Hoàn thiện hướng dẫn import/cấp tài khoản, xử lý lỗi, actor/use case/ERD/ma trận quyền.
- [x] Rà soát secret và CI/E2E trước khi bàn giao GitHub (không tự push; chưa có remote CI run).
- [x] Chạy lại toàn bộ kiểm thử/build và lập biên bản nghiệm thu cuối.

Không đánh dấu hoàn thành dựa riêng vào việc viết script hoặc có file dump; phải diễn tập khôi phục thành công.

## Kiểm tra đợt đầu

- Chạy preview PowerShell cho cả `main` và `qa`: PASS, không tạo backup hoặc dừng container.
- `git diff --check`: PASS (chỉ có cảnh báo chuyển LF/CRLF).
- `git check-ignore .local/backups/example/database.dump`: PASS, backup bị loại khỏi Git.
- Chưa chạy nhánh `-Execute`, chưa chạy restore và chưa chạy lại regression ứng dụng trong đợt này. Kết quả Sprint 4 là bằng chứng lịch sử, không thay thế nghiệm thu Sprint 5.

## Kiểm chứng tiếp theo — 15/09/2026

- Backup QA thật PASS, gồm cả trường hợp MinIO đang chạy: script dừng rồi khởi động lại MinIO, không khởi động backend/frontend vốn đang dừng.
- Khôi phục `qa-20260915-213123-b14692eea32e49deab77a909f71dcda8` vào `internship-restore-fb4be20b61b1`: PASS. Fingerprint nguồn chụp khi backend/frontend đều dừng, không có thao tác ghi dữ liệu giữa backup và capture.
- Đối chiếu **22 bảng, 8 PDF riêng tư** bằng SHA-256: PASS trước và sau restart; không chỉ so số lượng bản ghi.
- Database trống: **7 migration** PASS; chạy deploy lần hai không đổi lịch sử migration, không seed tài khoản.
- Nâng cấp: dựng 3 migration cũ + đợt Published giả lập, áp dụng 4 migration tiếp theo: PASS, mọi trường lịch cũ giữ nguyên, thông tin lịch thiếu không tự điền.
- Script mới được format bằng Prettier. Không thay đổi mã nghiệp vụ; chưa chạy lại full regression/E2E ứng dụng trong đợt này.
- Cổng clean install toàn ứng dụng vẫn mở: các phép kiểm tra trên tái sử dụng image/dependencies QA hiện có, chưa chứng minh cài từ máy mới hoặc bản production.
- Hướng dẫn có lệnh tái hiện trong [BACKUP_RESTORE.md](BACKUP_RESTORE.md). Không push GitHub, không reset/xóa dữ liệu chính.

## Đóng gói local — 15/09/2026

- Thêm target Docker `release`: Next standalone, Nest chạy dist, không mount source/watch; hai tiến trình runtime chạy UID 1000. Backend prune dev dependencies nhưng Prisma vẫn kéo peer dependencies; không khẳng định image không có TypeScript/Prisma CLI.
- Thêm stack `internship-release` với volume riêng, chỉ bind localhost:3300, job migrate phải thành công trước API; không công khai PostgreSQL/MinIO/API.
- Build đủ ba image PASS. `up -d --wait` từ volume trống PASS: 7 migration, frontend/API healthy. Đây là kiểm tra database sạch trên máy hiện tại, không phải bằng chứng chạy trên máy thứ hai.
- Seed local chủ động, mật khẩu chỉ lưu volume riêng; không in mật khẩu trong test/log. Không seed đợt hoặc đổi lịch.
- Playwright smoke Admin/Student PASS trước và sau restart: đăng nhập, auth/me, dashboard 200/403, logout 401, layout 390/768/1440, không pageerror/HTTP 5xx. Đã xem ảnh Admin mobile; ảnh lưu `frontend/.local/sprint5`.
- Backend lint/typecheck + **14/14 unit PASS**; frontend lint/typecheck + **11/11 test logic PASS**. Backend/Next production build trong Docker PASS. Chưa chạy lại 52 integration và E2E đầy đủ bảy actor ở đợt này.
- Thêm workflow `release-checks.yml`: build sạch, seed riêng, browser smoke và restart smoke. Chưa chạy workflow trên GitHub và chưa push.
- Scanner heuristic kiểm tra 164 Git candidate files PASS; bổ sung ignore `.env.*` (giữ `.env.example`), loại env khỏi Docker context. Đây không thay thế kiểm toán secret/security đầy đủ hoặc scan lịch sử Git.
- `git diff --check` PASS; preview backup `-Stack release` PASS. Backup release thật chưa chạy (QA restore đã có bằng chứng riêng).
- Hướng dẫn [LOCAL_RELEASE.md](LOCAL_RELEASE.md). Còn tài liệu nghiệp vụ cuối, full regression/E2E và biên bản nghiệm thu tổng thể.
