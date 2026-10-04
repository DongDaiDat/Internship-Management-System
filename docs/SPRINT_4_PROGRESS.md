# Sprint 4 — UI và E2E

## Khởi động ngày 15/09/2026

**Trạng thái mới nhất: đã nghiệm thu Sprint 4 ngày 15/09/2026.** Xem [biên bản và hướng dẫn chạy lại](SPRINT_4_ACCEPTANCE.md). 52 integration + 14 unit backend, 11 test frontend, lint/typecheck/build và lượt E2E tổng hợp đều PASS. Các mục phía dưới là lịch sử trước nghiệm thu, không phải danh sách còn thiếu hiện tại.

## Cập nhật kiểm chứng mới nhất — 15/09/2026

- Docker đã phục hồi, ổ C trống khoảng 6,7 GB tại lúc kiểm tra. Stack E2E khởi động được; 7 migration áp dụng thành công trên database QA riêng. Không reset dữ liệu chính.
- **PASS trình duyệt** `sprint4-roles.cjs`: đủ 7 actor, đăng nhập/đăng xuất, danh tính/quyền dashboard, workspace, layout 390/768/1440; không pageerror/HTTP 5xx trong kịch bản.
- **PASS trình duyệt** `sprint4-onboarding.cjs`: tạo/cấp tài khoản bằng API, bắt buộc đổi mật khẩu qua UI, xác nhận sai, chặn nghiệp vụ trước đổi, từ chối mật khẩu tạm cũ và đăng nhập bằng mật khẩu mới.
- Thêm `backend/scripts/seed-sprint4-flow.cjs`: tạo thêm fixture mới trong đúng `internship_sprint4_test`, không sửa lịch/điểm cũ. Email QA đã chuẩn hóa chữ thường; dữ liệu nháp lỗi cũ không bị xóa. Sinh `qa-sprint4-flow.json` riêng, không ghi mật khẩu vào log.
- **PASS trình duyệt** `sprint4-workflow.cjs`: đăng ký/hủy trong hạn, UI không cho hủy sau hạn và API từ chối, gửi yêu cầu ngoại lệ, Trưởng khoa duyệt ngoại lệ/phê duyệt và phân công giảng viên, Company phân công người hướng dẫn, CompanySupervisor chấm 8/10.
- Bổ sung tên truy cập ổn định cho select đợt/công ty/giảng viên, đã kiểm tra qua workflow sau khi restart frontend QA (bind mount Windows chưa tự nạp thay đổi trong lần chạy đó).
- Frontend lint/typecheck đã PASS trước thay đổi aria-label và phần mở rộng tệp cuối lượt; chưa xác nhận build/regression cuối cùng.
- Thêm hai integration test duyệt trùng đồng thời và chấm điểm đồng thời đổi giảng viên. Đã khởi chạy backend regression; chưa thu được kết quả cuối vì session công cụ không còn truy cập được. **Không tính là PASS**.
- Mở rộng `sprint2-browser.cjs` để dùng fixture Sprint 4: báo cáo/PDF → nhận xét/mở khóa → đổi giảng viên và trả lại → điểm giảng viên → minh chứng/chốt. **Chưa chạy phần mở rộng mới**: yêu cầu chạy Chrome bị hệ thống phê duyệt công cụ từ chối do hết hạn mức sử dụng. Không thử chạy vòng qua cơ chế phê duyệt.

### Điểm tiếp tục chính xác

Fixture `qa-sprint4-flow.json` hiện đã qua `test:sprint4:workflow`, người hướng dẫn doanh nghiệp đã chấm 8; chưa chạy luồng nộp báo cáo cuối lượt. Có thể chạy tiếp script tệp với `QA_FIXTURE_NAME=qa-sprint4-flow`, không seed lại nếu muốn dùng hồ sơ này. Nếu cần chạy lại cả workflow, seed fixture mới trước (script thêm dữ liệu, không reset):

```powershell
docker compose -f docker-compose.e2e.yml exec -T backend node scripts/seed-sprint4-flow.cjs
cd frontend
npm run test:sprint4:workflow
$env:QA_FIXTURE_NAME = 'qa-sprint4-flow'
npm run test:sprint2
```

Cần chạy lại backend lint/typecheck/integration/unit/build, frontend lint/typecheck/test/build và xem ảnh kết quả. Các phần vẫn chưa đủ nghiệm thu: E2E import/cấp tài khoản hoàn toàn qua UI, đổi công ty đầu kỳ, bàn phím/focus và lỗi theo trường toàn diện, kịch bản tệp/chốt vừa bổ sung. Sprint 4 **chưa hoàn tất**.

Các mục dưới đây là lịch sử trước khi Docker phục hồi.

- Thêm `docker-compose.e2e.yml`, project `internship-e2e`: PostgreSQL, MinIO, backend và frontend riêng; không dùng network/volume dữ liệu chính. Chỉ mở frontend tại `127.0.0.1:3200`.
- Database `internship_sprint4_test`, fixture `backend/.local/qa-sprint4.json`; dùng generator QA hiện có, mật khẩu ngẫu nhiên không ghi log. Khởi động lại giữ nguyên fixture/lịch, không reset tự động.
- Thêm `frontend/tests/sprint4-roles.cjs` và `npm run test:sprint4`: đăng nhập/đăng xuất, nhận diện role, quyền dashboard, tải workspace, phát hiện pageerror/HTTP 5xx và tràn ngang 390/768/1440 cho bảy actor. Mỗi actor dùng browser context riêng. Script chỉ đọc, chưa kiểm thử nghiệp vụ ghi dữ liệu.

## Kết quả kiểm tra thực tế

### Lượt tiếp tục ngày 15/09/2026

- Ổ C đã có khoảng 1,2 GB trống, nhưng `up -d --no-build` vẫn thất bại khi Docker đọc image MinIO với lỗi I/O. Chưa thể chạy bộ test; không tự restart toàn Docker hoặc xóa image/volume.
- Bổ sung `npm run test:sprint4:onboarding`: tạo hồ sơ và cấp tài khoản QA bằng API, kiểm thử trên browser bắt buộc đổi mật khẩu, xác nhận không khớp, mở nghiệp vụ sau đổi, từ chối mật khẩu tạm cũ và đăng nhập bằng mật khẩu mới. Mỗi lần tạo hồ sơ synthetic riêng; không xóa dữ liệu và không in mật khẩu. Đây **không** phải kiểm thử UI tạo hồ sơ/cấp tài khoản.
- Script onboarding đã được kiểm tra cú pháp bằng Node và đối chiếu DTO/status API trong mã nguồn; **chưa chạy E2E**, chưa khẳng định đạt. Cần khôi phục Docker trước khi tiếp tục nghiệm thu.

- Hai Docker image frontend/backend build thành công, npm ci thành công.
- `node --check frontend/tests/sprint4-roles.cjs` và `git diff --check`: PASS.
- **Chưa chạy E2E, lint/typecheck/test/build ứng dụng trong lượt này.** Tạo container frontend thất bại vì Docker báo `input/output error`; kiểm tra ổ C còn 8.626.176 byte trống. Docker đọc danh sách image cũng gặp I/O. Không xóa cache/image/volume hoặc dữ liệu người dùng để khắc phục.
- Chưa có fixture Sprint 4 chạy thành công. Kết quả test Sprint 3 không được dùng thay cho test mới.

## Chạy sau khi khôi phục dung lượng Docker

Từ thư mục gốc, với `.env` local hiện có:

```powershell
docker compose -f docker-compose.e2e.yml up -d --build
docker compose -f docker-compose.e2e.yml ps
```

Backend phải healthy trước khi chạy trình duyệt. Cổng 3200 không được có container QA Sprint 2 cũ đang dùng. Cần Chrome và cài dependencies frontend:

```powershell
cd frontend
npm run test:sprint4
```

Ảnh nằm trong `frontend/.local/sprint4/` (gitignored). Không gửi fixture chứa mật khẩu lên GitHub. Dừng stack mà giữ dữ liệu bằng `docker compose -f docker-compose.e2e.yml stop`; không dùng `down -v` để xử lý lỗi chung.

## Các phần tiếp theo

1. Chạy và sửa baseline UI bảy actor, xem ảnh/kiểm tra bàn phím và focus.
2. Fixture riêng cho đăng ký đang mở/đã đóng, ngoại lệ và cấp tài khoản; thêm E2E import → cấp tài khoản → đổi mật khẩu → đăng ký/hủy → duyệt/phân công.
3. E2E đổi đầu kỳ, báo cáo/tệp, chấm/chốt và dashboard; đối chiếu server từ chối thao tác ngoài quyền/hạn.
4. Bổ sung kịch bản đồng thời còn thiếu và lỗi từng trường; chạy regression, production build rồi lập biên bản nghiệm thu Sprint 4.
