# Đề xuất và phân công giảng viên hướng dẫn

## Quy trình

Đây là thiết kế nghiệp vụ của đồ án, tham khảo quy trình đăng ký của UIT/UEH; không tuyên bố là quy định chính thức của Trường CNTT Phenikaa. Quyết định 1439/QĐ-ĐHP-ĐT và hướng dẫn đồ án/khóa luận Phenikaa là tài liệu tham khảo, không thay thế xác nhận nghiệp vụ thực tập của khoa.

- Sinh viên đăng ký với lựa chọn mặc định **Để khoa phân công**, hoặc đề xuất một giảng viên cùng khoa với lý do 10–500 ký tự. Danh sách chỉ có giảng viên hoạt động, tài khoản hoạt động và có vai trò FacultyMentor. Người hết chỉ tiêu hiển thị nhưng không chọn được.
- Sinh viên đổi/rút đề xuất tại **Hồ sơ đăng ký** trong hạn đăng ký, khi hồ sơ còn Submitted/NeedsRevision. Mỗi lần thay lưu lịch sử, phản hồi cũ không áp dụng cho đề xuất mới.
- Giảng viên vào **Đề xuất hướng dẫn** (`/workspace/mentor/requests`) để đồng ý/từ chối. Từ chối cần lý do 10–500 ký tự. Chỉ xử lý đề xuất hiện hành, chưa phản hồi, hồ sơ Submitted và đợt Published chưa kết thúc. Đồng ý không giữ chỗ và chưa cấp quyền xem báo cáo/chấm điểm.
- Trưởng khoa duyệt sau đóng đăng ký theo quy tắc sẵn có. Nguyện vọng đã đồng ý được gợi ý khi giảng viên còn hợp lệ/còn chỉ tiêu. Nếu chọn người khác thay nguyện vọng được đồng ý hoặc chọn người đã từ chối trong lịch sử hồ sơ, cần lý do ít nhất 10 ký tự. Khoa có thể phân công trực tiếp khi chưa có phản hồi hoặc không có nguyện vọng.
- Điều phối viên theo dõi trong **Theo dõi đăng ký**, theo khoa và đợt được giao. Đổi người hướng dẫn sau phân công giữ nguyên cửa sổ thay đổi, khóa điểm và nhật ký của hệ thống. Admin không thực hiện nghiệp vụ phân công/phản hồi.

Chỉ tiêu tiếp tục dùng `FacultyProfile.maxStudents`, tính các thực tập có ngày kết thúc từ hiện tại trở đi. Đề xuất Pending/Accepted không tính vào chỉ tiêu. Khi duyệt, khóa hồ sơ đăng ký và bản ghi giảng viên, kiểm tra lại chỉ tiêu, tạo Internship và đóng đề xuất cùng giao dịch. Nguyện vọng không bỏ qua điều kiện học vụ, khoa hoặc đối tượng đợt.

## API (tiền tố `/api`)

| API | Quyền và dữ liệu |
|---|---|
| `GET /internship-periods/:id/mentor-choices` | Sinh viên đúng đối tượng đợt; tên, chuyên môn, chỉ tiêu, số đã phân, trạng thái còn chỗ |
| `POST /internship-applications` | Giữ payload cũ; thêm cặp tùy chọn `proposedMentorId`, `mentorReason` |
| `POST /internship-applications/:id/mentor-request` | Chủ hồ sơ; `{facultyMentorId, reason}`; thay đề xuất trong hạn |
| `POST /internship-applications/:id/mentor-request/withdraw` | Chủ hồ sơ; rút đề xuất trong hạn |
| `GET /mentor-requests` | Giảng viên; `page` (20 dòng/trang), `periodId`, `status` (Pending/Accepted/Declined/Closed), `search` tên/MSV |
| `POST /mentor-requests/:id/respond` | Giảng viên nhận đề xuất; `{response: "Accepted" hoặc "Declined", note?}` |
| `POST /internship-applications/:id/approve` | Trưởng khoa; `facultyMentorId`, `note` bắt buộc có điều kiện như trên |

Workspace sinh viên, danh sách đăng ký của khoa và trang duyệt trả `mentorRequests` theo thời gian mới nhất trước. Kết quả phân công trả riêng qua Internship. Hủy/từ chối/duyệt hồ sơ đóng đề xuất trong giao dịch. Index một phần `MentorRequest_one_current` bảo đảm tối đa một đề xuất chưa đóng cho một hồ sơ. Gửi lặp đề xuất giống hệt hiện hành hoặc phản hồi giống hệt không thêm bản ghi. Đăng ký hồ sơ trùng trả 409; người dùng mở hồ sơ có sẵn để tiếp tục.

## Migration và dữ liệu demo

- Migration `20261012000000_mentor_requests` chỉ thêm bảng, enum và index; không sửa phân công hoặc mật khẩu cũ. Không dùng `db push` thay cho migration vì ràng buộc unique có điều kiện được khai báo bằng SQL.
- Script `node scripts/seed-mentor-demo.cjs` chỉ bổ sung demo local, từ chối NODE_ENV production. Chạy lại không đặt lại phản hồi, ngày, mật khẩu hay hồ sơ đã tạo.
- Tài khoản bổ sung: `mentor-request-1@phenikaa-demo.local` (chờ phản hồi), `mentor-request-2@phenikaa-demo.local` (đã đồng ý), `mentor-request-3@phenikaa-demo.local` (đã từ chối). Mật khẩu ban đầu giống tài khoản Student demo tại lúc tạo; không ghi mật khẩu vào tài liệu/Git. Đợt demo 98 còn hạn đăng ký, đợt 99 đã đóng đăng ký để Trưởng khoa kiểm thử duyệt. Nếu không còn đúng thời gian thực, dùng QA runner để tạo fixture mới; script demo không tự đổi ngày đã tồn tại.

## Kiểm thử

- `npm run test:upgrade` tại backend chạy cả kiểm thử tài khoản/phân khoa và sáu nhóm kiểm thử đề xuất: luồng cũ/mới, thay/rút/lặp, lý do phân công, quyền/phạm vi/hạn/tài khoản, tranh chỉ tiêu cuối và đóng đề xuất/ràng buộc DB.
- `QA_BUILT=true node tests/run-sprint4.cjs` tại frontend dựng bản production trên database QA riêng; kiểm tra bảy vai trò, sinh viên đề xuất, giảng viên phản hồi, khoa phân công, báo cáo/PDF/chấm/chốt điểm và bắt đổi mật khẩu. Ảnh ở `frontend/.local/current-workflow/`, không đưa vào Git.
- Kiểm tra desktop 1440/1024 px cho đăng ký, phản hồi và duyệt; giao diện dùng chung khung/sidebar, không có nút sai vai trò.

## Nguồn tham khảo

- [Danh mục văn bản Phenikaa](https://phenikaa-uni.edu.vn/vi/post/dao-tao/van-ban-quy-dinh)
- [Hướng dẫn thực tập và ĐATN Phenikaa](https://eee.phenikaa-uni.edu.vn/vi/post/gioi-thieu/sinh-vien/tin-tuc/dao-tao/huong-dan-thuc-tap-tot-nghiep-va-datn)
- [Thông báo UIT năm 2026](https://nc.uit.edu.vn/giao-vu/thong-bao-v-v-dang-ky-thuc-tap-doanh-nghiep-hk-1-nh-2026-2027.html)
- [Thông báo UEH năm 2026](https://ueh.edu.vn/college/bit/vi/%5Bthong-bao%5D-ve-viec-dang-ky-giang-vien-huong-dan-thuc-tap-tot-nghiep-hoc-ky-cuoi-2026-77060)
