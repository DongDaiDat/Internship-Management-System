# Nghiệm thu tổng hợp và lịch sử — 14/10/2026

## Phạm vi

- Tổng quan theo vai trò; danh sách và lịch sử có bộ lọc, tìm kiếm, phân trang.
- Lịch sử công ty, giảng viên và người hướng dẫn doanh nghiệp được cập nhật cùng giao dịch phân công.
- Đóng phân công khi chốt điểm; giữ điểm và nhận xét của người từng phụ trách.
- Phân quyền theo khoa, đợt phụ trách và hồ sơ cá nhân; Admin không truy cập dữ liệu thực tập; chỉ Trưởng khoa và Điều phối viên xuất Excel.
- Lịch sử đăng ký của sinh viên gồm cả hồ sơ chưa được phân công.

## Kết quả kiểm thử

| Nhóm | Kết quả |
| --- | --- |
| Unit backend | 14/14 đạt |
| Unit frontend | 11/11 đạt |
| Tích hợp hồi quy API | 52/52 đạt |
| Tích hợp nâng cấp | 19/19 đạt, gồm 7 kiểm thử tổng hợp/lịch sử |
| Typecheck, lint, format, build | Backend và frontend đạt |
| E2E nghiệp vụ | Import → cấp tài khoản → đổi mật khẩu → đề xuất/duyệt → báo cáo → đánh giá → chốt điểm đạt |

E2E kiểm tra thêm rằng sau chốt điểm, các khoảng phân công đã đóng và hồ sơ không xuất hiện trong danh sách đang phụ trách. Kiểm thử desktop bao phủ bảy vai trò tại 1440 và 1024 px, bộ lọc giữ qua tải lại, quyền xuất, lịch sử, màu nút chính và tràn ngang. Ảnh QA nằm trong `frontend/.local/summary-review` (không đưa vào Git).

Đã khắc phục xung đột CSS khiến nút tìm kiếm của trang tổng hợp bị đổi màu bởi kiểu giao diện sinh viên. Kiểm thử bộ lọc đợi dữ liệu API để tránh bỏ qua thao tác khi trang đang tải.

## Triển khai

Migration đã được kiểm tra trên cơ sở dữ liệu QA/test. Chưa áp dụng lên cơ sở dữ liệu vận hành. Thực hiện hướng dẫn trong [REPORTING.md](REPORTING.md) khi triển khai; không reset dữ liệu. Lịch sử trước migration chỉ ghi nhận phân công hiện có, không dựng lại các thay đổi quá khứ.
