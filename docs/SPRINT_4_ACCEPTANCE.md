# Sprint 4 — biên bản nghiệm thu

Ngày kiểm tra: **15/09/2026**. Kết luận: **hoàn tất phạm vi Sprint 4 của đồ án**, có thể chuyển Sprint 5. Không đồng nghĩa nghiệm thu toàn dự án hoặc chứng nhận sẵn sàng vận hành toàn trường.

## Thay đổi chính

- Stack `internship-e2e` tách PostgreSQL/MinIO/network/volume khỏi dữ liệu chính, chỉ mở frontend QA ở `127.0.0.1:3200`.
- Fixture mới được thêm bằng script, không sửa lịch đã công bố, không xóa hồ sơ cũ. Mật khẩu ngẫu nhiên chỉ nằm trong `.local` bị loại khỏi Git.
- Chuẩn hóa tên truy cập của select đợt, công ty, giảng viên và danh mục hồ sơ.
- Danh mục hồ sơ tự cập nhật sau xác nhận import, không cần tải lại trang.
- Form hồ sơ thủ công báo lỗi tiếng Việt theo trường, liên kết lỗi bằng `aria-describedby`, đánh dấu `aria-invalid`, focus vào trường sai đầu tiên. Kiểm tra tín chỉ, email, trường bắt buộc, độ dài và quota; server vẫn kiểm tra độc lập.
- Bổ sung các script E2E độc lập và lệnh chạy tổng hợp `npm run test:sprint4:all`.

## Kết quả thực thi

| Nhóm | Kết quả và phạm vi |
|---|---|
| Backend | Lint, typecheck, build PASS; **52/52 integration, 14/14 unit** PASS |
| Frontend | Lint, typecheck, production build PASS; **11/11 test logic** PASS (3 test form hồ sơ + 8 test báo cáo cũ) |
| Bảy actor | Đăng nhập/đăng xuất, danh tính, workspace, quyền dashboard, không pageerror/HTTP 5xx trong kịch bản |
| Cấp tài khoản | Import qua UI → xem lỗi thiếu cột/nhiều dòng → xác nhận → hồ sơ xuất hiện không reload → cấp tài khoản → mật khẩu một lần → đổi mật khẩu đầu tiên |
| Đổi mật khẩu | Chặn nghiệp vụ trước đổi, xác nhận sai, sau đổi mở nghiệp vụ, mật khẩu tạm cũ bị từ chối, đăng nhập lại bằng mật khẩu mới |
| Đăng ký | Gửi/hủy trong hạn; sau hạn không có nút hủy và API từ chối |
| Ngoại lệ/phân công | Sinh viên gửi ngoại lệ; Trưởng khoa duyệt ngoại lệ, duyệt hồ sơ và chọn giảng viên |
| Thay đổi đầu kỳ | Đổi doanh nghiệp sang công ty QA khác rồi về lại; đổi giảng viên và về lại; nhận xét rồi mở khóa báo cáo trong cửa sổ 7 ngày |
| Doanh nghiệp | Đại diện phân công supervisor; supervisor chấm phiếu 8/10 qua UI |
| Tệp/điểm | Upload PDF tuần/cuối, giảng viên chấm 9, khoa nhập phiếu thay có PDF/lý do, chốt **8,5**, khóa giao diện sửa; tải PDF sau khóa khớp từng byte |
| Dashboard | Bộ lọc/tìm kiếm/rỗng, drilldown chỉ số/đạt/không đạt/thiếu phiếu, quota, audit và tải hai Excel trên hồ sơ vừa chốt |
| Đồng thời | Duyệt trùng, vượt quota, một sinh viên/hai đợt, confirm import lặp, chấm trong lúc đổi giảng viên, chốt lặp; nằm trong 52 integration test |
| UI | Đo không tràn ngang ngoài bảng cuộn ở **390/768/1440 px**; kiểm tra tên truy cập các input/select/textarea hiển thị; Tab/Enter đăng nhập, focus ô sai; tên tiếng Việt dài |
| Smoke local | Trang chính và `/api/health` ở cổng 3000 đều HTTP 200 |

**Đã chạy thành công một lượt tổng hợp liên tiếp** bằng `frontend/tests/run-sprint4.cjs`, không chỉ cộng kết quả những test rời. Đã xem ảnh thực tế form chấm thay mobile và kết quả sau chốt desktop; ảnh ở `frontend/.local/sprint4/` và dashboard ở `frontend/.local/sprint3/`.

## Cách chạy lại

Điều kiện: Docker Desktop hoạt động, đủ dung lượng, `.env` local hợp lệ, Node.js, Google Chrome và dependencies frontend đã cài bằng `npm ci`. Không sử dụng tài khoản thật. Cổng 3200 không bị stack QA cũ chiếm.

Lần đầu từ thư mục dự án:

```powershell
docker compose -f docker-compose.e2e.yml up -d --build
cd frontend
npm ci
npm run test:sprint4:all
```

Các lần sau runner dùng image đã build; nếu đổi dependency/Dockerfile phải build lại. Với bind mount Windows không tự nạp sửa đổi, restart frontend QA trước khi chạy. Runner dừng ở bước lỗi đầu tiên; không tiếp tục rồi báo PASS giả.

Runner tuần tự: baseline bảy actor → onboarding → import/UI validation → seed workflow mới → đăng ký/ngoại lệ/duyệt/đổi công ty/chấm doanh nghiệp → PDF/nhận xét/mở khóa/đổi giảng viên/chốt → dashboard/Excel. Các bước chuẩn bị gọi Docker, browser chạy trên host. Lượt kiểm chứng dùng Node runtime/Playwright có sẵn trên máy.

Chạy quá nhiều lần trong 15 phút có thể bị giới hạn đăng nhập thật (HTTP 429); chờ cửa sổ hết hạn, không tắt guard hoặc sửa counter để vượt kiểm soát. Dữ liệu fixture được giữ lại cho điều tra; runner không reset database. Dừng QA và giữ dữ liệu:

```powershell
docker compose -f docker-compose.e2e.yml stop
```

## Giới hạn và Sprint 5

- Bộ browser là các kịch bản chính trên Chrome/Windows, không phải mọi tổ hợp thao tác hoặc kiểm thử đa trình duyệt. Kiểm tra accessibility cơ bản không phải chứng nhận WCAG hay kiểm thử screen reader toàn diện.
- Đăng ký đang mở và hồ sơ chờ duyệt sau hạn dùng các fixture khác nhau với mốc thời gian cố định; không giả lập sửa lịch đợt thật để làm test đi qua.
- Không chạy kiểm thử tải quy mô toàn trường, không tự push GitHub, không triển khai máy chủ, không reset dữ liệu chính.
- Sprint 5 còn kiểm tra cài từ máy sạch/database trống, backup/restore, tài liệu bảo vệ/ma trận quyền, pipeline CI và biên bản bàn giao cuối. Chưa tuyên bố toàn dự án 100%.
