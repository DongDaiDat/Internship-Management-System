# Domain model

## Cấu trúc học vụ

Department (Khoa), Major (Ngành), TrainingProgram (Chương trình), Cohort (Khóa) là các danh mục riêng. DepartmentProgram lưu liên kết khoa–chương trình có xác nhận và nguồn. StudentProfile liên kết cả bốn danh mục; không suy đoán khoa/khóa từ MSV. User, giảng viên, doanh nghiệp và đợt có departmentId nullable để giữ bản ghi cũ chưa hoàn thiện.

InternshipPeriod có số đợt, học kỳ 1–3 và năm học liên tiếp; tổ hợp duy nhất trong khoa. PeriodAudience lưu từng nhóm Ngành–Khóa và Chương trình tùy chọn; phép đối chiếu OR giữa các nhóm hoàn chỉnh. Khóa cấu hình sau công bố, lưu snapshot khi duyệt. Xem [luồng chuyển đổi dữ liệu cũ](PHENIKAA_UPGRADE.md).

Nền tảng tài khoản đã được triển khai:

- User: email duy nhất, tên, passwordHash, trạng thái hoạt động và timestamps.
- UserRole: khóa ghép userId/role; một người dùng có thể có nhiều vai trò trong database. Giao diện tạo người dùng hiện chọn một vai trò.
- Session: thuộc User, tokenHash duy nhất, createdAt/expiresAt; token thô chỉ ở cookie trình duyệt.
- AuditLog: actorId tùy chọn, action, targetId và thời điểm. Ghi cùng transaction với login, logout và tạo tài khoản.
- LoginThrottle: bộ đếm atomic theo hash email/IP trong cửa sổ 15 phút.

Bảy role canonical:

- Student: cập nhật hồ sơ, đăng ký thực tập, nộp báo cáo và xem kết quả của chính mình.
- Company: đại diện doanh nghiệp, quản lý thông tin công ty, tạo người hướng dẫn và phân công người chấm.
- CompanySupervisor: người hướng dẫn tại doanh nghiệp, xem và chấm sinh viên được phân công.
- FacultyMentor: giảng viên hướng dẫn, nhận xét báo cáo tuần và chấm điểm giảng viên bao gồm quyển báo cáo cuối cùng.
- InternshipCoordinator: điều phối thực tập, quản lý đợt, import hồ sơ, xác minh công ty, phân công và theo dõi tiến độ.
- FacultyManager: trưởng khoa, duyệt cuối, xử lý ngoại lệ và xem dashboard toàn Trường CNTT.
- Admin: quản trị hệ thống, tài khoản và cấu hình nền.

Permission users:read/users:create hiện chỉ cấp cho Admin qua mapping tập trung; chưa có bảng cấu hình Permission động.

Phạm vi dữ liệu được giới hạn cho Trường Công nghệ Thông tin Phenikaa, không phải toàn trường.

- StudentProfile: mã sinh viên, lớp, khóa, chuyên ngành CNTT, email, tín chỉ chương trình/đã hoàn thành, nợ học phần bắt buộc và trạng thái xác minh.
- FacultyProfile: mã giảng viên, email, chuyên môn, quota hướng dẫn và trạng thái hoạt động.
- CompanyProfile/CompanySupervisorProfile: công ty tối giản, đại diện công ty và các nhân viên hướng dẫn dùng tài khoản riêng.
- InternshipPeriod: thời gian đăng ký/thực tập, 6–12 báo cáo tuần và ngưỡng tín chỉ. Sau khi `Published`, thời gian là bất biến.
- InternshipApplication/EligibilityExceptionRequest/Internship: đăng ký, ngoại lệ, snapshot eligibility và phân công đúng một giảng viên.
- WeeklyReport, SupervisorEvaluation, FacultyEvaluation, FinalReport, FinalGrade: báo cáo, đánh giá và điểm cuối 50% doanh nghiệp + 50% giảng viên hướng dẫn. Điểm giảng viên bao gồm phần đánh giá quyển báo cáo cuối; không còn trọng số báo cáo cuối độc lập. Snapshot trong FinalGrade lưu công thức tại thời điểm chốt để không hồi tố các điểm đã chốt theo công thức cũ.
- ImportBatch: lưu bản xem trước và lỗi theo dòng; hồ sơ chỉ được tạo sau xác nhận import.

Dữ liệu mock giao diện cũ không dùng làm hồ sơ thực tập trong database.
