# Sprint 1 — hồ sơ và phân quyền

Ngày kiểm tra: 13/09/2026. Trạng thái: hoàn tất chức năng Sprint 1 và kiểm tra kỹ thuật bên dưới; không phải nghiệm thu toàn dự án hay E2E tự động đầy đủ.

## Chức năng bàn giao

| Tiêu chí | Kết quả |
|---|---|
| Thêm/sửa sinh viên, giảng viên, doanh nghiệp | API + UI; dùng chung validateRows với import; không ghi đè mã/email trùng; không tự tạo tài khoản |
| Hồ sơ và tài khoản riêng | Sửa email liên hệ không sửa email đăng nhập; không nhận userId/roles/isVerified qua form hồ sơ |
| Hồ sơ sinh viên | Khoa quản lý tín chỉ/nợ học phần; chỉnh hồ sơ thủ công yêu cầu xác minh lại; sinh viên chỉ cập nhật email liên hệ |
| Quota giảng viên | Không giảm quota dưới số thực tập chưa kết thúc; khóa cùng bản ghi giảng viên như phân công |
| Người phụ trách đợt | Điều phối viên tạo đợt được tự phân công; Admin/Trưởng khoa bàn giao với lý do/audit; không công bố nếu thiếu người phụ trách hoạt động |
| Đợt cũ | Không tự gán người; giữ lịch và dữ liệu, cần Admin/Trưởng khoa phân công |
| Workspace điều phối | Chỉ hồ sơ/đợt phụ trách; xem hồ sơ chờ khoa duyệt, thay phân công và mở khóa trong hạn; không duyệt/chốt điểm |
| Thay giảng viên | Lưu điểm cũ vào audit, yêu cầu chấm lại, giữ nội dung báo cáo và phiếu doanh nghiệp |
| Doanh nghiệp kiêm hướng dẫn | Bổ sung vai trò trên cùng tài khoản; chống tạo trùng khi gọi đồng thời |

## API bổ sung

- `POST /profiles/:type` và `/profiles/:type/:id/update`: body `{ data: {...} }`, type là students/faculty/companies. Trường hợp sửa gửi đủ bộ trường như mẫu import. Chỉ Admin/điều phối; hồ sơ/import là danh mục dùng chung.
- `POST /students/me/contact`: body `{ email }`; chỉ sinh viên của chính hồ sơ đó, không đổi tài khoản đăng nhập.
- `GET /internship-coordinators`, `POST /internship-periods/:id/coordinator`: chỉ Admin/Trưởng khoa; giao người nhận hoạt động có role điều phối, kèm reason.
- `GET /faculty-workspace`: mở cho điều phối nhưng lọc theo đợt phụ trách ở server; quyền quyết định cuối giữ nguyên FacultyManager.
- `POST /company-supervisors/self`: đại diện tự kiêm hướng dẫn; không phát sinh mật khẩu mới.

## Kết quả kiểm tra

- 38 integration test backend PASS (HTTP auth/DTO và service với PostgreSQL), 14 unit backend PASS.
- 8 test logic frontend PASS. Lint/typecheck/production build cả hai PASS; git diff --check PASS.
- Kiểm tra browser database `_test`: điều phối có workspace rỗng khi chưa được giao đợt; tạo hồ sơ sinh viên qua UI, sửa tín chỉ 130 → 140, tải lại và tìm kiếm thấy giá trị 140; sinh viên cập nhật email liên hệ thành công.
- Đã phát hiện/sửa CSS form mới chưa được áp dụng và dựng quá nhiều form. ProfilePanel tìm kiếm + hiển thị 20 hồ sơ/trang; form mobile 390 px đã xem screenshot, trang rộng 375 px trong viewport 390 px, không tràn ngang. Bảng có vùng cuộn riêng.
- Lỗi kiểm thử do các test mới dùng chung tài khoản/prefix với test cũ đã được tách fixture; chạy lại toàn bộ đạt. Không thay kỳ vọng bảo mật để làm test qua.

## Giới hạn được ghi nhận

- Chưa có E2E Playwright tự động cho toàn bộ thao tác; phần này thuộc Sprint 4. Không coi 8 test frontend là độ bao phủ UI.
- Kiểm thử browser mới tập trung hồ sơ sinh viên và liên hệ; không khẳng định đã thao tác mọi form của mọi actor trên browser.
- Phân trang hồ sơ hiện ở phía client để giới hạn DOM; server-side pagination/bộ lọc báo cáo thuộc Sprint 3.
- Tệp báo cáo và minh chứng, dashboard drill-down/export và tài liệu đóng gói cuối tiếp tục ở Sprint 2–5.
- Không sửa lịch legacy đã công bố, không tự push GitHub, không reset database chính.
