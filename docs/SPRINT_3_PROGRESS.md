# Sprint 3 — tiến độ ngày 14/09/2026

## Nghiệm thu Sprint 3 — hoàn tất phạm vi đồ án

Lượt cuối: **50/50 integration + 14/14 unit backend; 8/8 test logic frontend; lint, typecheck và build cả hai ứng dụng PASS**. Playwright/Chrome chạy riêng trên QA ở cổng 3200 PASS, không sửa dữ liệu chính. Không có migration mới trong sprint này.

- Dashboard: chọn đợt; bấm từng chỉ số mở danh sách chi tiết có phân trang. Thêm đề xuất công ty chờ xác minh (đếm hồ sơ Submitted chưa liên kết công ty, không đếm toàn danh mục công ty chưa xác minh). Điểm trung bình mở danh sách điểm đã chốt.
- `/reports/readiness`: chọn đợt để kiểm tra danh mục hồ sơ dùng chung theo ngưỡng tín chỉ, xác minh, tài khoản hoạt động, nợ học phần bắt buộc và thực tập hiệu lực. Có tìm tên/mã, lọc đủ/chưa đủ và phân trang SQL. Đây là kiểm tra hồ sơ hiện tại, không thay snapshot và chưa xét cửa sổ đăng ký/công ty được chọn.
- Quota giảng viên tính tổng thực tập còn hiệu lực ở mọi đợt để khớp quy tắc phân công; chỉ hiển thị số lượng, không lộ sinh viên của đợt ngoài phạm vi. Có nhóm còn/hết quota và tìm kiếm.
- Tiến độ bổ sung tìm tên/mã, nhóm thiếu phiếu doanh nghiệp: chưa phân công người chấm hoặc chưa đủ phiếu của toàn bộ người được giao. Count, danh sách và điều kiện thiếu phiếu đọc cùng transaction RepeatableRead; điểm đã chốt không vào nhóm thiếu điểm.
- Workspace khoa phân trang server độc lập hồ sơ chờ duyệt và thực tập (20/trang), lọc theo đợt đang chọn; tệp chỉ tải khi mở. Hủy request cũ khi đổi trang/đợt. Sửa trùng key React gây lặp danh sách khi đổi đợt.
- Báo cáo Excel đăng ký và tiến độ/kết quả sử dụng đúng bộ lọc/quyền, xuất toàn bộ trang; trên 10.000 hồ sơ yêu cầu thu hẹp bộ lọc. Audit học vụ chỉ tải khi mở và giữ quyền theo đợt.

### Bằng chứng kiểm thử

- Đối chiếu tổng từng chỉ số dashboard với danh sách; các nhóm trễ hạn/nộp muộn/chờ nhận xét/cần sửa có dữ liệu dương; thiếu lịch không tự suy đoán hạn. Đề xuất công ty bị từ chối ra khỏi hàng chờ xác minh.
- Ngưỡng 119/150 không đủ và 120/150 đủ ở mức 80%; sau duyệt chuyển sang có thực tập hiệu lực; giảng viên quota 1 nhận đủ một sinh viên chuyển hết quota.
- 21 hồ sơ rồi 21 thực tập: mỗi danh sách có trang 20 + 1, không trùng ID; Excel có đủ 21 dòng dữ liệu dù đang xem trang 2. Kiểm tra nhánh vượt 10.000 bằng stub (không phải benchmark tải 10.000 hồ sơ thật).
- HTTP từ chối chưa đăng nhập, Student, query sai; service từ chối điều phối ngoài đợt. File xuất đọc ngược bằng ExcelJS kiểm tra số liệu, kiểu ngày/điểm và snapshot 8 + 9 → 8.5.
- `npm run test:sprint3` từ frontend: lọc đợt/trạng thái/tìm kiếm/rỗng, drilldown chỉ số và đạt/không đạt/thiếu phiếu, quota, audit, hai download Excel; xác minh không gọi API tệp trước khi mở, mở được báo cáo cuối. Không có pageerror. Đo tràn ngang ở 390/768/1440 px và đã xem ảnh dashboard/quota/tiến độ.
- Fixture sử dụng `backend/.local/qa-sprint2-clean.json`, Chrome cài trên máy và hai container QA Sprint 2; không in mật khẩu. Ảnh/file kết quả nằm trong `frontend/.local/sprint3/`, không commit. Script chỉ đọc dữ liệu; không tự tạo/reset fixture hoặc sửa lịch.

### Giới hạn đã ghi nhận

Chưa phải nghiệm thu toàn dự án. E2E đầy đủ 7 actor, kiểm thử tải quy mô lớn, toàn diện bàn phím/accessibility và đóng gói máy sạch thuộc Sprint 4–5. Một số chỉ số thời hạn cần quét dữ liệu tối giản trong phạm vi trước khi phân trang; audit chỉ tải theo một thực tập, chưa có phân trang riêng. Không có cam kết hiệu năng vận hành toàn trường; phạm vi vẫn là đồ án Trường CNTT.

Các mục dưới đây là lịch sử triển khai, không phải trạng thái hiện tại.

## Lượt tiếp theo — tiến độ, kết quả, xuất file và audit

Kết quả chạy: 45/45 integration và 14/14 unit backend, 8/8 test logic frontend PASS. Typecheck/lint và build backend/frontend PASS. Test frontend logic không thay thế Playwright; luồng browser đã được kiểm tra riêng như dưới đây.

- `GET /reports/progress`: phân trang server; bộ lọc đợt, tên/mã sinh viên (API), và all/graded/passed/failed/missingFaculty. Số chỉ mục và danh sách đọc trong cùng transaction RepeatableRead. UI bấm chỉ số để lọc danh sách.
- Hiển thị số tuần đã nộp/nhận xét/quá hạn chưa nộp, thiếu lịch báo riêng với overdue=null; phiếu doanh nghiệp đã có/cần có; chỉ tính trung bình khi đủ người được phân công. Điểm đã chốt lấy từ FinalGrade, không tính lại lịch sử.
- `GET /reports/applications/export` và `/reports/progress/export`: Excel theo toàn bộ bộ lọc/quyền, bỏ phân trang. Trên 10.000 hồ sơ trả lỗi yêu cầu thu hẹp bộ lọc, không cắt im lặng. Điểm/ngày giữ kiểu dữ liệu; các giá trị rỗng không biến thành 0. Báo cáo là ảnh chụp dữ liệu, không chứa công thức chấm lại hay mật khẩu.
- `GET /reports/internships/:id/audit`: Admin/Trưởng khoa/điều phối đúng đợt xem đổi công ty, đổi giảng viên, mở khóa báo cáo tuần và nhập điểm thay. Chỉ trả hành động, thời gian, người thực hiện, lý do; không trả JSON details thô. UI tải khi mở lịch sử.
- Đã kiểm thử Excel đọc ngược khớp danh sách/điểm 8 + 9 = 8.5 và ngày typed; quyền coordinator khác, Student, mentor bị chặn cho báo cáo/xuất/audit. HTTP từ chối query sai, quyền sai và chưa đăng nhập.
- Playwright QA đã PASS drilldown Đạt/Không đạt, lịch sử nhập thay, tải hai Excel và kiểm tra tràn ngang 390/1440. Sửa nhóm nút bộ lọc tự xuống dòng trên mobile. Ảnh và file QA trong frontend/.local/sprint3 (không commit).

## Đã triển khai lượt đầu

- Dashboard nhận bộ lọc đợt `periodId`, kiểm tra phạm vi điều phối viên phía server.
- `GET /reports/applications`: lọc đợt/trạng thái, tìm tên/mã sinh viên, phân trang 20 dòng mặc định (tối đa 100), thứ tự ngày/ID ổn định. Count và rows đọc trong cùng transaction RepeatableRead; không trả dữ liệu tài khoản.
- UI bộ lọc và danh sách có loading/lỗi/rỗng, hủy request cũ tránh kết quả sai khi đổi bộ lọc. Bảng có vùng cuộn riêng trên mobile. Eligibility trên danh sách là kết quả lưu lúc đăng ký, không phải kiểm tra học vụ mới.
- 43 integration PASS: đối chiếu tổng dashboard với hồ sơ chờ duyệt theo đợt, tìm kiếm, phân trang, lọc trạng thái, chặn coordinator khác và Student.
- Playwright QA kiểm tra lọc đợt/trạng thái/tìm kiếm/rỗng, 390/1440px; kịch bản `frontend/tests/sprint3-browser.cjs` chỉ đọc fixture QA Sprint 2. Cần Chrome và hai container QA sạch ở cổng 3200; chạy `node tests/sprint3-browser.cjs` từ frontend.

## Lịch sử các mục còn lại trước lượt nghiệm thu

- Đã hoàn tất drilldown, eligibility hồ sơ, quota, thiếu phiếu, phân trang khoa và lazy-load tệp ở lượt nghiệm thu phía trên.
- Đã kiểm tra vượt ranh giới trang, giới hạn xuất và browser Sprint 3. Kiểm thử tải quy mô lớn và E2E toàn hệ thống không được xem là đã hoàn tất.
