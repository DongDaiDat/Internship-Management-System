# Tổng hợp và lịch sử thực tập

Các trang `/workspace/{vai-trò}/summary` cung cấp danh sách có bộ lọc, phân trang và bảng tổng hợp. `/history` của sinh viên, giảng viên và phía doanh nghiệp cho phép tra cứu các đợt trước đây. Tổng quan dùng API `/reports/overview`; số liệu chi tiết và xuất Excel dùng chung phép lọc.

## Quyền

- Admin: chỉ số tài khoản, cấp phát, danh mục và dữ liệu cần hoàn thiện; không truy cập danh sách thực tập.
- Trưởng khoa: toàn bộ đợt trong khoa.
- Điều phối viên: đợt được giao trong khoa.
- Giảng viên, doanh nghiệp, người hướng dẫn doanh nghiệp: phân công hiện tại và lịch sử của chính mình.
- Sinh viên: hồ sơ của chính mình.
- Chỉ Trưởng khoa và Điều phối viên được xuất Excel.

Tài khoản nhiều vai trò chọn không gian làm việc bằng `X-Workspace-Role`. API tổng hợp không cộng gộp phạm vi của nhiều vai trò.

## Lịch sử

Migration `20261014000000_assignment_history` ghi nhận phân công hiện tại tại thời điểm triển khai. Không phục hồi thay đổi trước đó. Những bản ghi này được đánh dấu `Migration` và không khẳng định ngày bắt đầu hướng dẫn thực tế.

Phân công mới, đổi công ty, đổi giảng viên và gán người hướng dẫn doanh nghiệp cập nhật lịch sử trong giao dịch nghiệp vụ. Khi đóng khoảng phân công, điểm và nhận xét liên quan được lưu thành bản chụp; việc xóa đánh giá vận hành khi đổi phân công không xóa bản chụp lịch sử.

Chốt điểm đóng các khoảng phân công hiện hành. Hồ sơ hoàn thành được đưa sang lịch sử, không tính vào danh sách đang phụ trách. Các hồ sơ hoàn thành trước migration vẫn chỉ có mốc ghi nhận hiện trạng, không suy đoán ngày kết thúc phân công.

Giảng viên/phía doanh nghiệp đã kết thúc phân công chỉ xem phần đánh giá của mình. API lịch sử không cung cấp khóa lưu trữ tệp hoặc quyền sửa nghiệp vụ. Bảng `Internship` tiếp tục giữ các liên kết hiện tại.

## Trạng thái

Thứ tự xét: hồ sơ hủy → có điểm chốt → chưa bắt đầu → trong khoảng thực tập → quá ngày kết thúc nhưng chưa chốt. Thiếu báo cáo quá hạn chỉ tính các hạn nộp đã qua và chưa có báo cáo tương ứng; không tính các tuần tương lai.

## API

- `GET /reports/overview`
- `GET /reports/internships`
- `GET /reports/internships/:id/history`
- `GET /reports/internships/export`
- `GET /reports/registrations`: lịch sử các lần đăng ký của sinh viên, gồm cả hồ sơ chưa tạo phân công.

## Nhắc việc trong ứng dụng

Biểu tượng chuông trong thanh tiêu đề và mục **Việc cần làm** dùng `GET /notifications/summary` và `GET /notifications/tasks`. Hệ thống chỉ tính công việc trong không gian vai trò đang chọn, nhắc trước 72 giờ; đỏ cho quá hạn/trong 24 giờ và cam cho các việc còn lại. Không lưu trạng thái đã đọc và không gửi email. Mục nhắc tự biến mất khi hồ sơ được xử lý, hủy, chốt điểm hoặc đổi phân công.

Bộ lọc: `academicYear`, `semester`, `periodId`, `departmentId`, `majorId`, `programId`, `cohortId`, `companyId`, `mentorId`, `supervisorId`, `status`, `attention`, `assignment`, `search`, `sort`, `page`, `pageSize`. Danh sách tùy chọn lấy từ phạm vi người dùng được phép xem. Các bộ lọc URL được giữ khi tải lại hoặc quay lại trang.

## Triển khai và kiểm thử

Triển khai backend cùng Prisma client và migration mới (`npm run db:generate`, `npm run db:deploy` trong backend), sau đó khởi động lại backend/frontend. Không reset database. Migration chỉ thêm mốc lịch sử hiện trạng, không cập nhật điểm hoặc báo cáo cũ.

- `npm run test:upgrade` trong backend gồm kiểm thử đề xuất, tài khoản và 7 tình huống báo cáo/lịch sử mới.
- `npm run test:integration` chạy bộ hồi quy API trên database có hậu tố `_test`.
- `npm run test:e2e` trong frontend chuẩn bị QA riêng, chạy toàn luồng và kiểm tra các trang tổng hợp của bảy vai trò ở 1440/1024 px.
- `node tests/summary-browser.cjs` chạy riêng kiểm thử giao diện khi QA đã được chuẩn bị. Ảnh được lưu trong `frontend/.local/summary-review` và không đưa vào Git.
- Script seed demo và QA bổ sung lịch sử hiện trạng, giữ nguyên thông tin đăng nhập hiện có.
