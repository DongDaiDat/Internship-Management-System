# Nhập hồ sơ và bàn giao tài khoản

Điều phối viên nhập và xác minh hồ sơ trong khoa; Admin cấp tài khoản từ hồ sơ đã hoàn thiện. Trưởng khoa không có quyền import hoặc cấp tài khoản. Tạo hồ sơ không đồng nghĩa cấp tài khoản.

## Quy trình ngắn trên giao diện

1. Chọn loại hồ sơ Sinh viên/Giảng viên/Doanh nghiệp. Có thể thêm/sửa từng hồ sơ qua form; lỗi được hiển thị theo trường.
2. Nếu nhập nhiều, tải **đúng mẫu Excel từ ứng dụng**, giữ nguyên hàng tiêu đề và thứ tự cột. Xóa dòng ví dụ trước khi thêm dữ liệu thật. Lưu dạng `.xlsx`, tối đa 1.000.000 byte.
3. Chọn tệp và xem trước. Kiểm tra tổng dòng, dòng hợp lệ và toàn bộ lỗi theo số dòng Excel; chưa có hồ sơ nào được ghi từ preview.
4. Sửa file lỗi rồi tải lại; không sửa header sang tên tiếng Việt hoặc thêm cột mật khẩu. Chỉ xác nhận khi không còn lỗi. Hệ thống không ghi đè mã/email trùng; trùng phát sinh giữa preview/confirm cũng bị chặn.
5. Sau xác nhận, hồ sơ xuất hiện trong danh mục. Kiểm tra thông tin và xác minh hồ sơ sinh viên/doanh nghiệp. Import không tự xác minh hay cấp tài khoản.
6. Admin vào **Chờ cấp tài khoản**, lọc khoa/loại hồ sơ/lô import, chọn tối đa 100 hồ sơ và cấp hàng loạt. Kết quả ghi rõ thành công/bỏ qua/thất bại từng dòng; có hiện/ẩn, sao chép và tải CSV thông tin vừa cấp. Mật khẩu tạm chỉ giữ trong bộ nhớ trang; bàn giao kín và rời trang sau khi hoàn tất.
7. Người dùng đăng nhập và đổi mật khẩu tạm trước khi dùng nghiệp vụ. Mật khẩu mới khác cũ, 12–128 ký tự; không lưu mật khẩu trong Excel.

Điều phối chỉ xác nhận batch do mình tạo trong khoa mình. Admin không xác nhận import. Confirm lặp không tạo hồ sơ trùng. Cấp lại hồ sơ đã liên kết sẽ bỏ qua; email thuộc tài khoản khác báo lỗi, không liên kết hoặc thay mật khẩu tự động.

## Cột mẫu

| Loại | Header theo đúng thứ tự |
|---|---|
| Sinh viên | `studentCode`, `fullName`, `email`, `className`, `cohort`, `major`, `programCode`, `programCredits`, `completedCredits`, `hasMandatoryCourseDebt` |
| Giảng viên | `facultyCode`, `fullName`, `email`, `expertise`, `maxStudents` |
| Doanh nghiệp | `name`, `taxCode`, `address`, `website`, `contactName`, `contactEmail`, `contactPhone` |

Tín chỉ là số nguyên: chương trình ≥1, hoàn thành ≥0 và không lớn hơn chương trình. Nợ học phần nhập `true` hoặc `false`; không dùng “Có/Không” hay công thức Excel. Quota giảng viên là số nguyên 1–100, không giảm dưới số thực tập hiệu lực đang được giao.

Mã sinh viên/giảng viên tối đa 30 ký tự, tên người tối đa 120, email tối đa 254. `cohort` dùng mã khóa (ví dụ K17), `programCode` dùng mã chương trình (ví dụ ICT1). Ngành được đối chiếu từ chương trình, khoa lấy từ phạm vi của điều phối viên; phải có liên kết khoa–chương trình được xác nhận. Không suy đoán từ MSV. Doanh nghiệp bắt buộc tên/địa chỉ/người liên hệ/email/điện thoại; mã số thuế và website có thể trống. Giữ mã, điện thoại dạng Text để không mất số 0 đầu. Chỉ dùng giá trị thuần, không dùng ô công thức/merge làm dữ liệu.

Email hồ sơ và email đăng nhập được tách sau cấp tài khoản: sửa email liên hệ không đổi danh tính đăng nhập. Sinh viên chỉ tự sửa email liên hệ; tín chỉ, xác minh và nợ học phần do quản lý hồ sơ cập nhật. Không tạo thêm user rời có cùng email rồi mới provision hồ sơ: phải cấp từ hồ sơ để liên kết đúng.

## Doanh nghiệp có nhiều người phụ trách

Đại diện vào workspace doanh nghiệp, thêm nhân viên bằng họ tên/email/chức danh. Hệ thống cấp tài khoản CompanySupervisor riêng và mật khẩu tạm một lần. Trong 7 ngày đầu thực tập, chọn sinh viên và phân công từng người hướng dẫn. Mỗi người chỉ chấm sinh viên được giao.

Nếu đại diện cũng hướng dẫn: bật kiêm nhiệm trên tài khoản hiện tại, rồi phân công chính mình; không tạo tài khoản/email trùng. Khi sinh viên tự tìm công ty, điều phối xác minh và liên kết/tạo hồ sơ công ty trước, sau đó cấp tài khoản đại diện từ hồ sơ; không gửi email tự động.

## Lỗi thường gặp

- Thiếu/sai cột: tải lại đúng mẫu, giữ nguyên header/thứ tự.
- Trùng mã/email: tìm hồ sơ đã có và sửa qua form nếu có quyền; không dùng import để ghi đè.
- Tài khoản đã tồn tại: kiểm tra liên kết trước; không tự reset mật khẩu hoặc tạo user trùng.
- Mất mật khẩu tạm: Admin vào **Tài khoản → Đặt lại mật khẩu** để cấp mật khẩu tạm mới. Phiên cũ bị thu hồi và người dùng phải đổi mật khẩu khi đăng nhập. Không thể xem lại mật khẩu trước đó; không gửi email tự động.
- Tín chỉ chưa đủ: kiểm tra dữ liệu nguồn; nếu thật sự chưa đủ, dùng ngoại lệ do Trưởng khoa quyết định, không sửa tín chỉ giả để qua điều kiện.
- Đợt thiếu lịch/hết hạn: không gia hạn hoặc sửa ngày cũ để hợp thức hóa; dùng đúng đợt cấu hình đủ lịch.

Xem [nghiệp vụ và quyền](BUSINESS_HANDOVER.md), [bản local](LOCAL_RELEASE.md), [backup/restore](BACKUP_RESTORE.md).
