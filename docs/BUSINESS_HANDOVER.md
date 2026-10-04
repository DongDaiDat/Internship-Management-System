# Nghiệp vụ và ma trận quyền bản bàn giao

Phạm vi: quản lý thực tập tốt nghiệp của Trường CNTT Phenikaa, phục vụ đồ án môn học. Tài liệu mô tả hành vi đang triển khai, không phải văn bản quy chế chính thức của trường. Công thức 50/50 là lựa chọn đã thống nhất cho dự án; không khẳng định đây là công thức hiện hành cho mọi học phần của Phenikaa.

## Actor và quyền chính

Một tài khoản có thể có nhiều vai trò. Giao diện chọn không gian làm việc và gửi `X-Workspace-Role`; server xác minh vai trò đã được gán, thu hẹp quyền theo không gian đó và kiểm tra khoa, phân công, thời hạn. API không có header vẫn kiểm tra các vai trò thực được gán; Admin không có quyền nghiệp vụ mặc định.

| Actor | Nghiệp vụ | Phạm vi và giới hạn |
|---|---|---|
| Admin | Tài khoản, cấp hàng loạt, đặt lại mật khẩu, gán vai trò/khoa, danh mục Khoa–Ngành–Chương trình–Khóa | Không import/sửa hồ sơ học vụ, tạo đợt, duyệt hoặc chốt điểm |
| FacultyManager — Trưởng khoa | Giao điều phối, duyệt ngoại lệ/đăng ký, chọn giảng viên ban đầu, chốt điểm, kết quả/Excel/audit | Chỉ khoa mình; không import, cấp tài khoản, tạo đợt hoặc vận hành thay điều phối |
| InternshipCoordinator — Điều phối viên | Hồ sơ/import/xác minh trong khoa; tạo/công bố đợt, xác minh công ty tự tìm, theo dõi, đổi đầu kỳ/mở khóa, nhập điểm thay có minh chứng | Chỉ khoa mình và đợt được giao; không cấp tài khoản, duyệt cuối hoặc chốt điểm |
| FacultyMentor — Giảng viên | Xem sinh viên được giao, nhận xét tuần, chấm điểm tổng hợp gồm quyển báo cáo cuối | Đúng phân công hiện tại; không tự mở khóa báo cáo hoặc đổi phân công |
| Company — Đại diện doanh nghiệp | Xem workspace doanh nghiệp, tạo tài khoản người hướng dẫn, phân công họ; kích hoạt kiêm hướng dẫn | Công ty của mình; không dùng tài khoản chung cho nhiều nhân viên. Hồ sơ công ty do điều phối cập nhật |
| CompanySupervisor — Hướng dẫn doanh nghiệp | Xem và chấm phiếu riêng | Chỉ sinh viên được giao; đại diện muốn tự chấm phải bật vai trò này và được phân công |
| Student — Sinh viên | Sửa email liên hệ, đăng ký/hủy, xin ngoại lệ, nộp báo cáo/PDF và xem điểm | Chính mình; không tự sửa tín chỉ/nợ học phần/xác minh hoặc email đăng nhập |

Quyền đọc tệp không đồng nghĩa quyền sửa. Tệp được tải qua API kiểm tra phân công; kho MinIO không có bucket công khai. CompanySupervisor chỉ đọc tệp phù hợp phân công hiện tại, không truy cập bằng cách đoán ID.

## Luồng tổng quát

1. Admin khởi tạo người quản lý và gán khoa. Điều phối nhập/import, hoàn thiện, xác minh hồ sơ; Admin vào Chờ cấp tài khoản để cấp. Người nhận mật khẩu tạm đổi mật khẩu ở lần đăng nhập đầu.
2. Điều phối tạo đợt và mặc định phụ trách; Trưởng khoa có thể chuyển người phụ trách cùng khoa. Chốt đối tượng Ngành–Khóa (tùy chọn Chương trình) và đủ mốc đăng ký, thực tập, 6–12 hạn tuần, hạn chấm và hạn tổng kết trước công bố.
3. Trong hạn đăng ký, sinh viên chọn công ty đã xác minh hoặc khai báo công ty tự tìm. Hệ thống ghi kết quả eligibility; hồ sơ thiếu điều kiện học tập có thể xin một ngoại lệ tối giản. Sinh viên được hủy trong hạn, không được hủy sau đóng đăng ký.
4. Điều phối xác minh/link công ty tự tìm. Trưởng khoa quyết định ngoại lệ, sau khi đóng đăng ký duyệt hồ sơ và chọn đúng một giảng viên trong quota. Duyệt tạo Internship và snapshot điều kiện tại lúc xét.
5. Trong 7 ngày đầu, điều phối phụ trách được đổi công ty/giảng viên cùng khoa, mở khóa báo cáo có lý do. Đại diện doanh nghiệp phân công người hướng dẫn trong cùng cửa sổ. Mọi thao tác vẫn bị chặn nếu điểm đã khóa.
6. Sinh viên lưu báo cáo tuần/cuối rồi đính kèm PDF. Giảng viên nhận xét hoặc yêu cầu bổ sung; giảng viên chấm một điểm tổng hợp bao gồm báo cáo cuối. Người hướng dẫn doanh nghiệp chấm từng phiếu riêng.
7. Khi đủ phiếu doanh nghiệp và điểm giảng viên, Trưởng khoa xác nhận chốt trước hạn tổng kết. Snapshot giữ công thức, rubric, các phiếu và nguồn nhập thay. Sinh viên xem điểm; khoa theo dõi dashboard/Excel/audit.

## Điều kiện và thời gian

- Ngưỡng mặc định 80%: `completedCredits * 100 >= programCredits * threshold`. Dữ liệu tín chỉ do khoa nhập/xác minh; nợ học phần bắt buộc dùng cờ boolean. Không tích hợp bảng điểm hệ đào tạo hoặc xây phân hệ trạng thái học vụ chi tiết.
- Khi duyệt kiểm tra lại hồ sơ xác minh, tài khoản hoạt động, công ty xác minh, tín chỉ/nợ học phần và thực tập hiệu lực. Ngoại lệ học tập không bỏ qua xác minh, tài khoản, công ty hay ràng buộc một thực tập.
- Thực tập hiệu lực được kiểm tra theo `endsAt >= thời điểm hiện tại`, bao gồm cả thực tập sắp bắt đầu. Quota giảng viên tính trên toàn bộ thực tập còn hiệu lực, không chỉ đợt đang lọc.
- Đăng ký/hủy tính cả đúng thời điểm mở và đóng. Phê duyệt chỉ **sau** đóng đăng ký và **trước** kết thúc thực tập.
- Cửa sổ thay đổi là `[startsAt, startsAt + 7 ngày)`: đúng mốc ngày thứ 7 đã bị chặn. Lý do bắt buộc và audit được lưu.
- Báo cáo tuần được nộp từ bắt đầu thực tập đến hạn tuần tương ứng; báo cáo cuối đến ngày kết thúc. Chấm từ bắt đầu thực tập đến hạn chấm; chốt từ bắt đầu đến hạn tổng kết. Hạn cuối của các thao tác này có tính bao gồm.
- Lịch công bố không chỉnh giữa chừng. Đợt cũ thiếu lịch được cảnh báo và chặn thao tác cần lịch, không tự thêm/gia hạn để demo chạy được. Tạo fixture/đợt mới thay vì sửa lịch cũ.

## Thay đổi và lưu lịch sử

Đổi giảng viên giữ báo cáo và điểm doanh nghiệp, lưu điểm giảng viên cũ vào audit rồi yêu cầu người mới chấm lại. Đổi doanh nghiệp giữ nội dung báo cáo nhưng xóa phân công doanh nghiệp/điểm hiện tại cần chấm lại, lưu dữ liệu trước thay đổi vào audit. Người cũ mất quyền theo phân công hiện tại. Khoa chỉ mở lại báo cáo Reviewed trong cửa sổ thay đổi, còn hạn tuần và chưa chốt điểm.

UI lịch sử hiển thị người thực hiện, hành động, thời gian, lý do cho đổi công ty/giảng viên, mở khóa và chấm thay. Chi tiết snapshot trước thay đổi vẫn ở database; không mô tả UI audit là trình xem mọi sự kiện hệ thống.

## Chấm điểm

Phiếu doanh nghiệp: kỷ luật 0–2, trách nhiệm 0–2, vận dụng chuyên môn 0–2, kết quả 0–4. Phải có ít nhất một người được phân công và đủ một phiếu cho từng người; không chốt với phiếu thiếu hoặc người chấm ngoài phân công.

`Điểm doanh nghiệp = trung bình cộng tổng điểm các phiếu hợp lệ`

`Điểm cuối = làm tròn 2 chữ số (0,5 × doanh nghiệp + 0,5 × giảng viên)`

Ví dụ doanh nghiệp 8, giảng viên 9 → **8,50**, điểm chữ A, đạt. Hai phiếu 7 và 9 cho trung bình doanh nghiệp 8, không cộng thành 16.

| Điểm từ | Chữ | Kết quả |
|---|---|---|
| 9,5 | A+ | Đạt |
| 8,5 | A | Đạt |
| 8,0 | B+ | Đạt |
| 7,0 | B | Đạt |
| 6,5 | C+ | Đạt |
| 5,5 | C | Đạt |
| 5,0 | D+ | Không đạt |
| 4,0 | D | Không đạt |
| Dưới 4,0 | F | Không đạt |

Bảng là cấu hình quy đổi đang có trong code. Điểm báo cáo cuối độc lập không còn là thành phần bắt buộc hoặc trọng số thứ ba. Một số trường/endpoint cũ còn giữ tương thích và lịch sử; không tính thêm 40%.

Khoa nhập thay chọn đúng người hướng dẫn được giao, bắt buộc PDF minh chứng và lý do. Upsert thay đúng phiếu, không tăng số phiếu; lưu người nhập, trạng thái nhập thay, ID minh chứng. Snapshot chốt bảo toàn lịch sử 30/30/40 cũ; không hồi tố. Sau chốt không sửa điểm/báo cáo/phân công.

## Use case trình bày khi bảo vệ

| Mã | Tình huống | Điều cần chứng minh |
|---|---|---|
| UC01 | Import → xác nhận → cấp tài khoản → đổi mật khẩu | Chưa xác nhận chưa tạo hồ sơ; không xuất mật khẩu ra Excel |
| UC02 | Đăng ký đủ/thiếu tín chỉ và công ty tự tìm | Eligibility thật; công ty phải xác minh; ngoại lệ do Trưởng khoa |
| UC03 | Duyệt và phân công | Một thực tập hiệu lực, một giảng viên, chặn quota và ID ngoài phạm vi |
| UC04 | Thay đổi đầu kỳ | Lý do/audit, người cũ mất quyền, sau 7 ngày bị chặn |
| UC05 | Báo cáo tuần/cuối + PDF | Lưu nội dung trước, PDF hợp lệ ≤10 MiB, quyền tải riêng tư |
| UC06 | Chấm nhiều người/phương án nhập thay | Đủ phiếu, minh chứng bắt buộc, 50/50 và khóa sau chốt |
| UC07 | Dashboard, drilldown, Excel, audit | Số liệu và danh sách cùng bộ lọc/quyền; không lộ dữ liệu đợt khác |

Không triển khai email/thông báo, ký số, tích hợp đào tạo, khiếu nại nhiều cấp, workflow gia hạn hay hệ quản trị toàn đại học. Không có quên mật khẩu qua email hoặc UI khóa/sửa quyền tài khoản tổng quát. Các giới hạn này cần nêu rõ khi bảo vệ, không quảng bá là hệ thống production toàn trường.
