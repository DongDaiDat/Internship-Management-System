# Kiểm thử dự án

## Sprint 5 — nghiệm thu 15/09/2026

Lượt cuối: 52/52 integration + 14/14 unit backend, 11/11 test logic frontend, format/lint/typecheck/build PASS. E2E tổng hợp bảy actor PASS trên development **và release images** bằng `QA_BUILT=true`; hướng dẫn/lệnh trong [biên bản Sprint 5](SPRINT_5_ACCEPTANCE.md). Đã xác minh khôi phục 22 bảng/14 PDF và quyền HTTP sau restore, startup database trống/migration nâng cấp, restart release. Workflow GitHub có cả built E2E nhưng chưa có remote run. Không suy diễn các kết quả local thành pentest/load test hoặc production Internet.

## Sprint 4 — nghiệm thu 15/09/2026

**52 integration + 14 unit backend, 11 test logic frontend PASS**, lint/typecheck/build PASS. Đã chạy toàn bộ `frontend/tests/run-sprint4.cjs` thành công liên tiếp: bảy actor, onboarding, import/cấp tài khoản qua UI, đăng ký/ngoại lệ/duyệt/thay đổi đầu kỳ, phiếu doanh nghiệp, báo cáo/PDF/nhận xét/mở khóa/chốt 8.5, dashboard/audit/Excel. Kiểm tra focus/lỗi theo trường, tên truy cập, Tab/Enter và layout 390/768/1440. Chi tiết phạm vi và giới hạn ở [biên bản Sprint 4](SPRINT_4_ACCEPTANCE.md). Các mục dưới đây là lịch sử kiểm thử; CI trên GitHub và nghiệm thu môi trường sạch thuộc Sprint 5.

## Sprint 3 — nghiệm thu 14/09/2026

50/50 integration, 14/14 unit backend; 8/8 test logic frontend PASS. Lint/typecheck/build hai phía PASS. Playwright QA PASS: dashboard drilldown, tìm/lọc/rỗng, quota, thiếu phiếu, audit, Excel và tải tệp khi mở; không pageerror, không tràn ngang 390/768/1440. Đã xem ảnh thực tế. Kiểm tra DB 21 hồ sơ/21 thực tập qua trang 20+1 và Excel không cắt trang sau; nhánh giới hạn 10.000 dùng stub, không phải kiểm thử tải lớn. Chi tiết và lệnh chạy ở [Sprint 3](SPRINT_3_PROGRESS.md). Chưa có E2E toàn bộ 7 actor và CI trên GitHub; tiếp tục Sprint 4–5.

## Sprint 3 — lượt tiến độ/xuất/audit 14/09/2026

45 integration + 14 unit backend PASS; 8 test logic frontend PASS. Lint/typecheck/build hai phía PASS. Test mới đối chiếu danh sách và Excel, ngày typed, điểm 8/9/8.5, thiếu lịch, quyền ngoài đợt và chặn query HTTP sai. Playwright QA PASS drilldown, audit, hai download Excel, layout 390/1440; đã sửa nhóm nút bộ lọc xuống dòng trên mobile. Chi tiết/phạm vi chưa nghiệm thu ở [Sprint 3](SPRINT_3_PROGRESS.md).

## Sprint 2 — 14/09/2026

- Backend 42 integration + 14 unit PASS; frontend 8 test logic PASS. Lint/typecheck/build cả hai PASS. Nginx `nginx -t` PASS với giới hạn multipart 12 MiB.
- PostgreSQL test + MinIO thật: byte PDF upload/download khớp, chặn tệp giả/corrupt/quá dung lượng/ngoài quyền, yêu cầu nội dung báo cáo trước upload, khóa báo cáo đã review, chấm thay có minh chứng giữ đúng một phiếu, tổng 8.5 và snapshot nguồn, chặn sau chốt.
- HTTP: không có phiên không tải được, ID không thuộc quyền bị từ chối, multipart quá 10 MiB trả 413. Migration local/test áp dụng; Prisma diff local không còn chênh schema.
- Browser Playwright/Chrome trên database QA riêng PASS upload tuần/cuối, giảng viên chấm 9, khoa nhập thay 8 kèm minh chứng, xác nhận chốt 8.5, sinh viên xem kết quả, không còn form sửa/nộp sau khóa, download đúng byte. Layout 390/768/1440 không tràn ngang; đã xem ảnh form và kết quả. Chạy lại bằng `frontend/npm run test:sprint2` với fixture mới theo [ghi chú Sprint 2](SPRINT_2_FILES.md). CI chưa chạy trên GitHub. Audit production backend/frontend: 0 vulnerabilities sau thay SDK và cập nhật uuid.

## Sprint 1 — lượt kiểm tra cuối 13/09/2026

38 integration và 14 unit backend PASS; 8 test logic frontend PASS; lint/typecheck/build cả hai PASS. Test mới bao phủ CRUD hồ sơ ba loại, field quyền bị từ chối, email liên hệ không đổi email đăng nhập, quota khi sửa, workspace điều phối theo phạm vi. Browser đã kiểm tra tạo/sửa/tìm hồ sơ sinh viên và cập nhật liên hệ; mobile 390px đã sửa/xem lại CSS form. Xem [biên bản Sprint 1](SPRINT_1_ACCEPTANCE.md) để biết giới hạn; chưa có E2E tự động toàn bộ UI.

## Bổ sung 13/09/2026 — dashboard

- Integration thêm tình huống phân biệt tuần thiếu quá hạn / nộp muộn / cần sửa / chờ nhận xét, hồ sơ chưa bắt đầu không tính đang thực tập, lịch thiếu không suy đoán trễ và sinh viên bị từ chối truy cập.
- Backend integration và 14 unit PASS; frontend 8 test logic PASS; lint/typecheck/build hai ứng dụng PASS. Chưa chạy browser E2E cho các thẻ thống kê mới.

## Kết quả ngày 13/09/2026

- Backend: 32 integration, 14 unit PASS; frontend: 8 test logic PASS. Lint, typecheck, production build cả hai PASS.
- Test đổi công ty: từ chối sinh viên, trùng công ty, công ty chưa xác minh, quá 7 ngày, điểm đã chốt; xác nhận audit giữ điểm 8/9 cũ, bỏ phân công/điểm hiện tại, giữ nội dung báo cáo và chặn người hướng dẫn cũ chấm tiếp. Thiếu điểm sau đổi không thể chốt.
- Migration audit details áp dụng database test; local không còn migration chờ. Không reset dữ liệu.
- Form mới chưa chạy browser E2E; test frontend hiện có chỉ là test logic báo cáo, không thay thế kiểm thử UI.

## Kết quả mới nhất — 12/09/2026

- Backend: 14 unit và 31 integration PASS. Frontend: 8 test logic PASS. Lint, typecheck và production build cả hai PASS.
- Migration hạn nộp áp dụng trên local/test; không reset. Test biên trước/đúng/sau hạn, lịch thiếu/đảo thứ tự, công bố lặp, nộp trễ không ghi đè, mở khóa chỉ bởi khoa trong 7 ngày, báo cáo cuối khóa sau điểm giảng viên.
- Import: ba mẫu đọc được, preview/confirm không tự cấp tài khoản, trùng database, dòng Excel thực (có dòng trống), nhiều lỗi một dòng, file/cột sai, người khác xác nhận, xác nhận đồng thời. Đã tái hiện và sửa lỗi default import ExcelJS gây `Workbook` undefined.
- Browser thực tế với dữ liệu QA trên database `_test`: Student nộp báo cáo tuần/cuối; FacultyMentor nhận xét và chấm 9; CompanySupervisor chấm 8; FacultyManager xác nhận chốt 8.5/A; Student thấy kết quả và các form sửa bị khóa. Tạo/công bố đợt đầy đủ lịch, đọc lại đúng giờ địa phương. Workspace Student và form đợt ở 390px không tràn ngang; đã xem screenshot điện thoại.
- Chưa có bộ E2E browser chạy tự động trong CI. Chưa kiểm thử UI toàn bộ import/cấp tài khoản/ngoại lệ/mở khóa, tất cả breakpoint, upload MinIO hay môi trường production triển khai thực.
- Cuối phiên Docker daemon ngừng hoạt động; lệnh dừng QA và restart backend/frontend không thực hiện được. Các test/build và browser nêu trên đã hoàn tất trước đó; chưa smoke lại sau restart cuối phiên. Cần khởi động Docker Desktop rồi `docker compose up -d` khi chạy tiếp.

### Tái mở môi trường QA trình duyệt

Chạy ở thư mục dự án sau khi Docker Compose/PostgreSQL đã hoạt động và database test tồn tại:

```powershell
docker compose exec -T backend npm run build:test
docker compose run -d --no-deps --name internship-qa-backend backend node scripts/serve-qa.cjs
docker compose run -d --no-deps --name internship-qa-frontend -p 127.0.0.1:3100:3000 -v internship-qa-next:/app/.next -e INTERNAL_API_URL=http://internship-qa-backend:3001 frontend npm run dev
```

Nếu hai container QA đã tồn tại, dùng `docker start internship-qa-backend internship-qa-frontend`. Mở http://localhost:3100. Script chỉ dùng cấu hình Compose local và chuyển sang `internship_management_test`, không ghi dữ liệu nghiệp vụ chính. Tài khoản ngẫu nhiên nằm trong `backend/.local/qa-accounts.json`, đã Git/Docker ignore; không đưa file này lên GitHub. Lần khởi động sau dùng lại fixture nếu còn tồn tại. Fixture đã chốt điểm giữ nguyên kết quả để kiểm tra khóa/historical view.

Khi xong dùng `docker stop internship-qa-backend internship-qa-frontend`; dữ liệu và container được giữ lại để tái kiểm tra. Các kết quả và hướng dẫn cũ phía dưới là lịch sử, không thay thế danh sách giới hạn ở trên.

Chạy tại `frontend/` sau `npm ci`:

```powershell
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run start
```

Các kiểm thử tự động trong `tests/weekly-report.test.cjs` kiểm tra dữ liệu hợp lệ, thiếu trường, giới hạn số giờ, tuần không hợp lệ, độ dài nội dung và khôi phục bản nháp bị hỏng. Đây là kiểm tra giao diện mẫu, chưa thay thế validation và authorization phía backend.

Kết quả ngày 09/09/2026: format check, lint, typecheck, 8/8 tests và production build đều PASS. npm install sau khi cập nhật PostCSS báo 0 vulnerabilities. Workflow GitHub được thêm nhưng chưa chạy trên GitHub trong phiên này.

Docker Compose build và khởi động thành công frontend, backend, PostgreSQL và MinIO. PostgreSQL healthy; GET /api/health trả về status ok. Đã tải lại UI từ container và kiểm tra mở form, trở về trang chủ, không có console error. Volume frontend đã được đồng bộ bằng npm ci, báo 0 vulnerabilities. Chưa kiểm thử upload MinIO hoặc workflow database.

## Kiểm tra trình duyệt

- Tổng quan hiển thị đúng trên desktop và điện thoại 390px.
- Điều hướng sang kỳ thực tập và lịch sử báo cáo.
- Mở form trực tiếp bằng nút Viết báo cáo hoặc Bắt đầu.
- Form trống hiển thị lỗi; 169 giờ bị từ chối; 40 giờ và nội dung đầy đủ cho phép xem trước.
- Lưu nháp, tải lại trang, mở form: nội dung được khôi phục.
- Tìm kiếm API chỉ hiển thị báo cáo phù hợp; từ khóa không tồn tại hiển thị trạng thái rỗng; Xóa tìm kiếm khôi phục danh sách.
- Menu điện thoại mở được, đóng sau điều hướng; form không tràn ngang.

Các thao tác trình duyệt trên được chạy bằng công cụ tự động hóa trong phiên phát triển; chưa có bộ E2E trình duyệt lưu trong repository. Workflow gửi/duyệt vẫn chưa được triển khai.

## Backend authentication và PostgreSQL

```powershell
docker compose exec backend npm run format:check
docker compose exec backend npm run lint
docker compose exec backend npm run typecheck
docker compose exec backend npm test
docker compose exec backend npm run test:integration
```

Test tích hợp cần database riêng. Khi cài mới, tạo `internship_management_test` trong PostgreSQL trước khi chạy. Runner tự suy ra URL với cấu hình Compose mặc định; với cấu hình khác phải truyền TEST_DATABASE_URL có tên database kết thúc `_test`. Không cần reset database dự án.

- 3 unit tests: password hashing/verification, malformed hashes, mapping quyền cho 7 vai trò.
- 15 integration tests: anonymous access, login sai/không tồn tại, DTO và mass assignment, cookie/hash phiên, me theo danh tính phiên, quyền Student/Admin, Origin giả/mất Origin, tạo user/audit/duplicate email, role/password không hợp lệ, pagination/filtering, tài khoản bị khóa, thay đổi quyền, phiên hết hạn/giả/trùng cookie, logout/replay và giới hạn login đồng thời.
- Test build dùng .test-build độc lập với dist của dev watcher. Migration test không ghi vào database dự án.

## Kiểm tra qua Next.js proxy

Sau khi seed tài khoản local, chạy trên máy từ thư mục backend:

```powershell
node scripts/smoke-local.cjs
```

Script đọc file tài khoản local vào bộ nhớ, không in mật khẩu hoặc cookie. Kiểm tra 2 role Admin/Student đăng nhập, /auth/me, quyền xem users, từ chối Origin lạ, logout và replay phiên qua http://127.0.0.1:3000/api. Chỉ gọi origin local, không gửi credentials đến host tùy ý.

## Kiểm tra UI đăng nhập

Đã xem giao diện desktop và mobile 390px; không tràn ngang. Đã kiểm tra hiện/ẩn mật khẩu, thông báo sai thông tin, giữ email khi lỗi, điều hướng giữa đăng nhập và /demo. Đăng nhập thành công và quyền 2 role được kiểm tra qua HTTP proxy; chưa thực hiện toàn bộ thao tác thành công của form quản trị trong trình duyệt. Cần bổ sung E2E trình duyệt cho tạo tài khoản, đổi vai trò và hết hạn phiên trước khi tuyên bố hoàn thiện sản phẩm.

Frontend đã PASS format/lint/typecheck, 8 test báo cáo và production build. Backend đã PASS lint/typecheck, 3 unit tests và 15 integration tests. Docker chạy được, migration không còn pending, 2 tài khoản local đã seed thành công. Workflow CI frontend/backend đã được thêm nhưng chưa chạy trên GitHub trong phiên này.
# Cập nhật kiểm thử ngày 11/09/2026

- Kết quả cuối lượt: 14/14 unit backend, 22/22 integration PostgreSQL, 8/8 test logic frontend PASS. Lint, typecheck và production build backend/frontend PASS. Migration audit reason đã áp dụng thành công trên database test và local; không reset dữ liệu. Hai lỗi thiếu trường bắt buộc trong fixture mới đã được sửa trước khi chạy lại toàn bộ integration.
- Backend `npm test`: thêm `test/session-guard.test.cjs`, kiểm tra mật khẩu tạm cho bảy vai trò, ba API được phép khi chờ đổi mật khẩu và giữ nguyên phân quyền sau khi đổi.
- `npm run test:integration`: chạy cả `auth.integration.test.cjs` và `internships.integration.test.cjs` trên database riêng có hậu tố `_test`; không reset database dự án.
- Kiểm thử API cấp tài khoản từ hồ sơ → đăng nhập → chặn nghiệp vụ → đổi mật khẩu → thu hồi phiên cũ; sai mật khẩu, dùng lại mật khẩu và sai Origin bị từ chối.
- Kiểm thử service với PostgreSQL: duyệt đồng thời vượt quota, một sinh viên/hai đợt, eligibility thay đổi, đổi giảng viên/quota/mốc 7 ngày/audit lý do dài, đủ phiếu doanh nghiệp, chốt đồng thời và chặn ghi sau chốt.
- Đây chưa phải E2E trình duyệt cho toàn bộ nghiệp vụ. Màn hình đổi mật khẩu mới chưa được kiểm tra trực quan desktop/mobile trong lượt này; các kiểm tra UI lịch sử dưới đây không thay thế bước đó.
# Sprint 2 — lịch sử lượt HTTP trước nghiệm thu trình duyệt 14/09/2026

42 integration + 14 unit backend PASS; frontend 8 test logic, lint/typecheck/build PASS. Backend lint/typecheck/build PASS. Audit production backend/frontend 0 vulnerabilities. Integration bổ sung đi qua HTTP multipart thật, xác minh định dạng/điểm/lý do, tải đúng byte, nguồn phiếu và khóa 50/50. Browser đã kiểm tra nộp hai PDF và tải theo vai trò sinh viên/giảng viên; UI chấm thay/chốt/mobile chưa xác minh hết do công cụ trình duyệt không còn khả dụng. Xem [biên bản Sprint 2](SPRINT_2_FILES.md) để biết đúng phạm vi; các số liệu bên dưới là lịch sử.
