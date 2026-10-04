# Sprint 2 — tệp báo cáo và minh chứng

## Kết luận nghiệm thu — 14/09/2026

Sprint 2 hoàn tất trong phạm vi đồ án. Kịch bản Playwright chạy Chrome headless trên database QA riêng đã PASS: sinh viên nộp nội dung và hai PDF → giảng viên chấm 9 → Trưởng khoa nhập phiếu doanh nghiệp 8 với PDF/lý do → xác nhận chốt 8.5 → sinh viên thấy 8.5/A. Sau khóa không còn input tệp/nút sửa báo cáo hoặc chốt lại; download báo cáo cuối vẫn thành công và khớp từng byte. Không thay đổi lịch hay điểm của dữ liệu chính.

Đã kiểm tra ảnh và đo không tràn ngang ở 390/768/1440 px cho form tệp, chấm thay và kết quả đã khóa. Kịch bản lưu tại `frontend/tests/sprint2-browser.cjs`; ảnh và PDF tải về nằm trong `frontend/.local/sprint2/` (Git ignore). Các ghi chú chưa xác minh dưới đây mô tả lượt kiểm tra trước, đã được khép lại bằng lần chạy E2E này.

## Đã triển khai ngày 14/09/2026

- PDF tối đa 10 MiB/tệp. Kiểm tra đuôi, chữ ký `%PDF-` và đọc cấu trúc bằng pdf-lib; từ chối tệp lỗi, rỗng trang hoặc có mật khẩu. Không chỉ dựa vào MIME do trình duyệt gửi.
- Kho MinIO riêng tư: `internship-files` cho dữ liệu chính, `internship-files-test` khi database kết thúc `_test`. Tên object UUID, metadata có SHA-256, kích thước, người tải, loại, hồ sơ thực tập, công ty và người hướng dẫn liên quan.
- Kết nối MinIO qua `@aws-sdk/client-s3` (S3 path-style). Đã thay thư viện npm `minio` để loại bỏ dependency có cảnh báo; không đổi máy chủ MinIO, bucket, object hay dữ liệu đã lưu. Cập nhật bản vá uuid cho ExcelJS.
- File mới không ghi đè object cũ. Lưu object trước rồi liên kết metadata/báo cáo/điểm/audit trong transaction khóa thực tập; nếu transaction thất bại thì cố gắng xóa object vừa tạo. Không có API xóa tệp lịch sử.
- Báo cáo phải được lưu nội dung trước khi đính kèm. Nộp tệp tuân thủ hạn báo cáo tuần/cuối, quyền sinh viên, trạng thái nhận xét và khóa điểm. Tệp tuần nộp bổ sung đưa báo cáo về Submitted, cập nhật thời điểm nộp.
- Khoa nhập thay đúng phiếu của người hướng dẫn đã phân công, bắt buộc lý do và PDF. Điều phối viên bị giới hạn đợt; Admin không có quyền chấm thay. Không tăng số phiếu, không đổi công thức 50/50.
- Snapshot chốt điểm mới lưu nguồn nhập thay, người nhập, lý do, ID minh chứng và ID tệp báo cáo cuối. Metadata/object bất biến giúp truy vết; không sửa snapshot cũ.
- Nếu người hướng dẫn tự chấm lại trước khóa, nguồn phiếu trở về trực tiếp; bản nhập thay trước đó được lưu trong audit. Công ty cũ không được tải minh chứng sau đổi công ty.

## API và giao diện

- `GET /internships/:id/files`: chỉ danh sách tệp đang được tham chiếu, lọc quyền server.
- `GET /files/:id`: tải qua phiên đăng nhập, Content-Disposition attachment, application/pdf, no-store/nosniff; không xuất đường dẫn bucket.
- `POST /internships/:id/weekly-reports/:week/file`, `/internships/:id/final-report/file`: multipart trường `file`.
- `POST /internships/:id/company-scores/:supervisorId/evidence`: multipart file + discipline/responsibility/knowledge/outcome/reason; giới hạn điểm 2/2/2/4.
- Các workspace có mục “Tệp báo cáo và minh chứng”. Sinh viên chọn báo cáo đã lưu để đính kèm; giảng viên/doanh nghiệp đọc tệp theo quyền; khoa có form chấm thay và danh sách người hướng dẫn.

## Chạy và kiểm thử

- Cần `docker compose up -d`, cấu hình MINIO_ENDPOINT/PORT/USE_SSL và MINIO_ROOT_USER/PASSWORD hiện có. Không dùng thông tin test cho triển khai thật.
- Sau cập nhật dependencies/schema, chạy `docker compose exec -T backend npm ci`, `npx prisma generate`, `npx prisma migrate deploy` trong backend; hoặc rebuild Docker theo README. Migration chỉ thêm bảng/cột, không reset.
- Nginx cho request multipart tới 12 MiB; API vẫn giới hạn tệp 10 MiB.
- Integration cần cả PostgreSQL `_test` và MinIO. CI đã bổ sung bước khởi động MinIO riêng; chưa chạy workflow từ GitHub trong phiên này.
- Test đã thực thi: PDF giả/corrupt/quá giới hạn, ownership, báo cáo chưa tồn tại/đã nhận xét, tải lại byte chính xác qua MinIO, người ngoài phạm vi bị chặn, thiếu minh chứng không lưu, phiếu thay không tăng số phiếu, tổng 8.5, snapshot có nguồn, chặn sau chốt; HTTP không đăng nhập bị chặn và tệp >10 MiB trả 413.

## Kết quả xác minh ngày 14/09/2026

- Backend: 42/42 integration với PostgreSQL và MinIO thật; 14/14 unit PASS. Lint, typecheck và build PASS.
- Frontend: lint, typecheck, production build và 8/8 test logic PASS. Tám test này là logic báo cáo minh họa, không phải E2E toàn giao diện.
- HTTP multipart bổ sung: thiếu file/lý do, điểm vượt giới hạn trả 400 và không tạo phiếu; phiếu hợp lệ trả 201; tải trả application/pdf/attachment và đúng byte; chốt 8 doanh nghiệp + 9 giảng viên = 8.5, snapshot có nguồn/minh chứng; gửi lại sau chốt trả 409, vẫn chỉ một phiếu.
- Trình duyệt trên môi trường QA riêng: sinh viên lưu nội dung tuần/cuối, upload cả hai PDF thành công; danh sách có hai tệp. Sinh viên tải báo cáo tuần, giảng viên tải báo cáo cuối đều nhận sự kiện download thành công. Đã thao tác form nhận xét/chấm giảng viên, nhưng công cụ trình duyệt mất khả dụng trước bước xác nhận trạng thái cuối.
- `npm audit --omit=dev` backend và frontend: 0 vulnerabilities tại thời điểm chạy. Đây không thay thế rà soát bảo mật toàn hệ thống.

## Tái tạo dữ liệu QA trình duyệt

Chạy từ thư mục dự án, sau khi đã chạy integration để có `.test-build`. Dùng database riêng chỉ chứa fixture nghiệm thu, không dùng database integration đã tích lũy nhiều lượt test. Tạo database `internship_sprint2_test` bằng tài khoản PostgreSQL trong cấu hình local (chỉ lần đầu). Ví dụ trong PowerShell:

```powershell
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE internship_sprint2_test;"'
docker compose run -d --no-deps --name internship-sprint2-clean-backend -e QA_DATABASE_NAME=internship_sprint2_test -e QA_FIXTURE_NAME=qa-sprint2-clean backend node scripts/serve-qa.cjs
docker compose run -d --no-deps --name internship-sprint2-clean-frontend -p 127.0.0.1:3200:3000 -v internship-sprint2-clean-next:/app/.next -e INTERNAL_API_URL=http://internship-sprint2-clean-backend:3001 frontend npm run dev
```

Nếu cổng 3200 đang được container QA cũ sử dụng, dừng đúng container QA đó trước; không dừng database hoặc ứng dụng chính. Mở `http://localhost:3200`. Tài khoản riêng trong `backend/.local/qa-sprint2-clean.json`, PDF tổng hợp trong `backend/.local/qa-report.pdf`; không commit hoặc công khai mật khẩu.

Trên máy host có Node.js và Google Chrome, vào `frontend`, chạy `npm ci` rồi `npm run test:sprint2`. Kịch bản dùng Playwright 1.62.1 đã khóa trong package-lock, tự mở Chrome headless; không cần tài khoản thật. Lần nghiệm thu này sử dụng Playwright cùng phiên bản từ runtime đi kèm, kết nối Chrome cài sẵn trên host.

Kịch bản chốt điểm thật **trong database QA**, vì vậy mỗi lần chạy đầy đủ cần fixture chưa nộp/chưa chốt. Script tạo fixture tái sử dụng dữ liệu khi file tài khoản đã tồn tại, tuyệt đối không mở khóa hoặc dịch lịch để chạy lại. Lượt mới: khởi động backend QA với `QA_FIXTURE_NAME=qa-sprint2-<tên-mới>` (và tên container mới), cho frontend QA trỏ đúng backend đó, đồng thời đặt cùng biến `QA_FIXTURE_NAME` khi chạy E2E. Không reset database dự án. `QA_DATABASE_NAME` chỉ chấp nhận tên dạng `internship_..._test`.

## Giới hạn ngoài phạm vi nghiệm thu Sprint 2

- Bộ Playwright toàn bộ 7 actor/quy trình vẫn thuộc Sprint 4; test hiện tại bao phủ luồng Sprint 2, không phải toàn đồ án.
- Trang khoa với nhiều dữ liệu integration tích lũy tải nặng; Sprint 3 cần phân trang/lọc server và tránh tải danh sách tệp cho mọi hồ sơ cùng lúc. Kết quả responsive ở đây được đo trên bộ dữ liệu nghiệm thu nhỏ, không phải load test.
- Chưa có antivirus/sandbox phân tích PDF; bộ kiểm tra cấu trúc không chứng minh tệp sạch mã độc. Chỉ tải dưới dạng attachment.
- Nếu tiến trình bị dừng giữa object upload và transaction, có thể còn object mồ côi; chưa có tác vụ đối soát tự động. Không xóa tệp cũ đang lưu lịch sử.

Tài liệu API tham khảo: [AWS SDK S3 JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html), [PDFDocument.load](https://pdf-lib.js.org/docs/api/classes/pdfdocument).
