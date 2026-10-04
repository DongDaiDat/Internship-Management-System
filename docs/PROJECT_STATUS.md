# Trạng thái dự án

## Hiện tại

### Nâng cấp Phenikaa — 16/09/2026

Đã triển khai danh mục học vụ và migration giữ dữ liệu cũ, mật khẩu tự sinh/cấp hàng loạt/reset thu hồi phiên, tách quyền Admin–Trưởng khoa–Điều phối viên theo khoa/đợt và giao diện sidebar riêng từng chức năng. Bộ kiểm thử: 52 hồi quy API + 6 tích hợp nâng cấp, 14 unit backend, 11 frontend. Xem [phạm vi, cách chạy và các liên kết chương trình cần xác nhận](PHENIKAA_UPGRADE.md). Các mục Sprint bên dưới là lịch sử, không phải ma trận quyền hiện tại.

### Sprint 5 — đã nghiệm thu phạm vi đồ án local (15/09/2026)

Đã hoàn tất tài liệu actor/quyền/use case/ERD/import, đóng gói local, CI và kiểm thử cuối. Backend 52 integration + 14 unit, frontend 11 test, format/lint/typecheck/build PASS. E2E đầy đủ bảy actor đạt ở cả development và image release. Restore mới khớp 22 bảng/14 PDF trước/sau restart; API sau restore chặn 401/403 và chủ hồ sơ tải đúng hash. Xem [biên bản Sprint 5](SPRINT_5_ACCEPTANCE.md). Không chứng nhận production Internet; chưa chạy GitHub Actions hoặc thử máy thứ hai, không tự push. Các mục dưới là lịch sử tiến độ.

### Sprint 5 — bản đóng gói local đã chạy (15/09/2026)

Đã build và chạy `internship-release` từ volume trống tại localhost:3300, đủ 7 migration. Smoke Admin/Student trước/sau restart đạt, layout 390/768/1440; 14 unit backend + 11 test frontend, lint/typecheck và Docker build đạt. Đã thêm CI kiểm tra release và scanner file nhạy cảm ở local; chưa chạy GitHub workflow. Xem [bản local](LOCAL_RELEASE.md) và [biên bản tiến độ](SPRINT_5_PROGRESS.md). Chưa nghiệm thu Sprint 5: còn full regression/E2E và tài liệu nghiệp vụ cuối. Đây không phải production Internet.

### Sprint 5 — bắt đầu đóng gói và bàn giao

Đã bổ sung script backup local có preview, tài liệu an toàn sao lưu/khôi phục và sửa README lỗi thời. Chưa nghiệm thu backup/restore thực tế hoặc clean install; xem [checklist Sprint 5](SPRINT_5_PROGRESS.md). Không tự push/deploy hoặc xóa dữ liệu.

Cập nhật tiếp: backup/restore QA đã PASS đối chiếu 22 bảng + 8 PDF trước/sau restart. Clean database 7 migration và nâng cấp từ 3 migration cũ đều PASS, giữ lịch Published. Chưa hoàn tất clean install toàn ứng dụng, đóng gói production và nghiệm thu cuối; chi tiết/bằng chứng tại checklist Sprint 5.

### Sprint 4 — hoàn tất phạm vi đồ án (15/09/2026)

Đã chạy đạt E2E tổng hợp bảy actor, import/cấp tài khoản qua UI, đổi mật khẩu, đăng ký/hủy, ngoại lệ/duyệt/phân công, đổi công ty/giảng viên, nhận xét/mở khóa, PDF/chấm/chốt và dashboard/Excel. Form lỗi theo trường/focus và danh mục tự cập nhật sau import đã kiểm tra. 52 integration + 14 unit backend, 11 test frontend; lint/typecheck/build PASS. Layout 390/768/1440 và smoke local HTTP 200. Xem [biên bản Sprint 4](SPRINT_4_ACCEPTANCE.md). Chuyển Sprint 5 — đóng gói, backup/restore, tài liệu và nghiệm thu cuối; chưa coi toàn đồ án hoàn tất.

### Sprint 3 — hoàn tất phạm vi đồ án (14/09/2026)

Đã hoàn tất dashboard/drilldown, điều kiện hồ sơ/quota, thiếu phiếu doanh nghiệp, tìm kiếm/phân trang, Excel theo bộ lọc và lịch sử học vụ đúng quyền. Workspace khoa phân trang 20 hồ sơ và tải tệp khi mở. 50 integration + 14 unit backend, 8 test logic frontend; lint/typecheck/build PASS. Playwright QA PASS ở 390/768/1440 px, gồm bộ lọc, chi tiết, audit, tải Excel và lazy-load tệp. Xem [biên bản Sprint 3](SPRINT_3_PROGRESS.md) để biết bằng chứng và giới hạn. Có thể chuyển Sprint 4; chưa nghiệm thu toàn đồ án hoặc benchmark tải lớn.

### Sprint 2 — hoàn tất nghiệm thu phạm vi đồ án (14/09/2026)

- Migration `202609140001_private_files` đã áp dụng local/test; Prisma diff local không còn khác biệt schema (bổ sung map tên index cũ, không đổi dữ liệu).
- PDF báo cáo tuần/cuối và phiếu doanh nghiệp nhập thay có minh chứng, lưu MinIO riêng tư, tải qua quyền server, snapshot giữ nguồn phiếu và file.
- Kiểm thử với MinIO thật và PostgreSQL test đã đạt; giới hạn HTTP multipart đã kiểm tra. Xem [Sprint 2 — tệp](SPRINT_2_FILES.md).
- Bổ sung HTTP chấm thay/chốt điểm: 42 integration + 14 unit backend PASS; 8 test logic frontend, lint/typecheck/build PASS. Thay MinIO SDK bằng S3 client tương thích; audit production cả hai ứng dụng 0 cảnh báo.
- Playwright/Chrome trên QA sạch đã PASS đầy đủ upload tuần/cuối → điểm giảng viên 9 → phiếu doanh nghiệp nhập thay 8 kèm PDF/lý do → chốt 8.5 → sinh viên xem kết quả; chặn UI sửa sau khóa, download đúng byte sau khóa. Ảnh/đo layout 390/768/1440 px không tràn ngang. Đã đóng phần browser còn thiếu; có thể chuyển Sprint 3.
- Sprint 3 ưu tiên dashboard/bộ lọc/phân trang server/xuất Excel/audit; lưu ý trang khoa tải nặng khi test database tích lũy nhiều hồ sơ. Không xem nghiệm thu Sprint 2 là nghiệm thu toàn đồ án.

### Sprint 1 — hoàn tất chức năng và kiểm tra kỹ thuật (13/09/2026)

- Đã thêm/sửa hồ sơ thủ công (chung validation import), cập nhật email liên hệ sinh viên, UI workspace điều phối theo phạm vi và chặn công bố đợt chưa có người phụ trách hoạt động.
- Đã bổ sung kiểm tra quota khi sửa hồ sơ, chống sửa fields quyền, giữ email đăng nhập riêng, audit trong transaction. ProfilePanel có tìm kiếm/20 dòng mỗi trang; sửa CSS form sau kiểm tra mobile thực tế.
- 38 integration + 14 unit backend; 8 test logic frontend PASS. Lint/typecheck/build hai ứng dụng PASS. Chi tiết phạm vi và giới hạn browser ở [biên bản Sprint 1](SPRINT_1_ACCEPTANCE.md).
- Chưa nghiệm thu toàn đồ án; E2E tự động đầy đủ, tệp/minh chứng, dashboard chi tiết và đóng gói tiếp tục theo Sprint 2–5. Các mục bên dưới là lịch sử tiến độ.

### Sprint 1 — phân công và phạm vi điều phối viên

- Migration `202609130002_period_coordinator` thêm người phụ trách, đã áp dụng local/test không reset. Đợt cũ giữ null; Admin/Trưởng khoa giao lại qua form trong danh sách đợt. Đợt do điều phối viên tạo tự gắn người tạo; Admin tạo thì cần phân công riêng.
- API giao người phụ trách kiểm tra tài khoản hoạt động có vai trò điều phối, ghi lý do và audit. Bàn giao không thay lịch đã công bố.
- Điều phối viên chỉ thấy danh sách đợt/dashboard/công ty tự tìm thuộc phạm vi; API công bố, xác minh công ty tự tìm, đổi công ty/giảng viên và mở khóa kiểm tra người phụ trách trong giao dịch. Admin/Trưởng khoa giữ phạm vi đọc toàn trường theo quyền hiện có.
- 35 integration PASS, gồm bàn giao quyền và chặn người ngoài phạm vi. Form phân công chưa browser E2E. Sprint 1 còn hồ sơ thủ công và workspace thao tác đầy đủ cho điều phối; chưa nghiệm thu cả sprint.

### Triển khai kế hoạch 5 sprint — Sprint 1 đang thực hiện

- Đã sửa đổi giảng viên: chỉ khoa/điều phối, lưu điểm giảng viên cũ vào audit, bỏ điểm hiện tại để chấm lại; giữ nội dung báo cáo, nhận xét tuần và phiếu doanh nghiệp. Có form đổi giảng viên trên workspace Trưởng khoa. API chặn chọn lại giảng viên hiện tại.
- Đại diện doanh nghiệp có nút kiêm người hướng dẫn; API `POST /company-supervisors/self` bổ sung vai trò và hồ sơ trên cùng user, khóa giao dịch chống tạo trùng, có audit. Không cấp mật khẩu hay tài khoản mới.
- Test bổ sung cho điểm cũ/history, Admin bị từ chối đổi giảng viên, giảng viên cũ mất quyền và giảng viên mới chấm lại; kiêm nhiệm gọi đồng thời vẫn chỉ có một hồ sơ/audit.
- Sprint 1 CHƯA nghiệm thu: còn thêm/sửa hồ sơ thủ công, thông tin liên hệ sinh viên, người phụ trách đợt và kiểm soát phạm vi điều phối, UI điều phối và browser E2E. Sprint 2–5 chưa bắt đầu; không coi các thay đổi này là hoàn tất kế hoạch.

### Cập nhật 13/09/2026 — sửa ý nghĩa chỉ số dashboard

- Tách số tuần quá hạn chưa nộp, bản nộp hiện tại muộn hơn hạn, báo cáo chờ nhận xét và cần bổ sung; không dùng NeedsRevision thay cho trễ hạn nữa. Báo cáo nộp lại được tính theo submittedAt hiện tại, không khẳng định là lần nộp đầu muộn.
- Hồ sơ thuộc đợt Published thiếu lịch tuần được đếm riêng, không đoán hạn. Đang thực tập chỉ tính đã bắt đầu, chưa kết thúc và chưa chốt điểm.
- Thêm integration test phân biệt các nhóm và chặn sinh viên truy cập dashboard. Đã chạy backend integration/unit, frontend test logic, lint/typecheck/build cả hai thành công.
- Chưa hoàn thiện phạm vi đợt phụ trách của điều phối viên, danh sách drill-down, phân trang và browser E2E dashboard. Chỉ số hiện vẫn là toàn hệ thống theo quyền endpoint hiện có.

### Cập nhật ngày 13/09/2026 — đổi doanh nghiệp đầu kỳ

- API `POST /internships/:id/company` dành cho Trưởng khoa/điều phối viên, chỉ trong 7 ngày đầu và trước chốt điểm; doanh nghiệp mới phải đã xác minh và khác doanh nghiệp hiện tại.
- Trong cùng transaction: lưu phân công, điểm doanh nghiệp, điểm giảng viên và chi tiết chấm báo cáo cũ vào `AuditLog.details`; bỏ các điểm/phân công đó khỏi dữ liệu hiện tại để chấm lại. Nội dung báo cáo không bị xóa. Người hướng dẫn công ty cũ mất quyền chấm và phân công lại.
- Workspace Trưởng khoa có chọn doanh nghiệp mới, lý do bắt buộc và xác nhận tác động trước khi gửi. Điều phối viên có API; chưa bổ sung form riêng cho workspace điều phối.
- Migration `202609130001_audit_details` đã có trên local/test. Backend 32 integration + 14 unit, frontend 8 test logic đều PASS; lint/typecheck/build cả hai PASS. Chưa kiểm thử trình duyệt trực tiếp form đổi doanh nghiệp; chưa có màn hình đọc lịch sử chi tiết audit.
- Các phần dashboard theo phạm vi, upload minh chứng và hoàn thiện E2E vẫn cần tiếp tục; không coi dự án đã nghiệm thu toàn bộ.

### Cập nhật ngày 12/09/2026 — thời gian, import và kiểm thử liên vai trò

- Migration `202609120001_period_deadlines` bổ sung hạn từng tuần, hạn chấm, hạn tổng kết; đã áp dụng trên database local và test, không reset dữ liệu. Đợt mới bắt buộc đủ 6–12 hạn tăng dần trong kỳ, hạn chấm từ ngày kết thúc và hạn tổng kết không trước hạn chấm.
- Form tạo đợt có đầy đủ hạn; chuyển giờ địa phương thành ISO trước khi gửi API. Có xác nhận công bố; chỉ công bố bản nháp trước mở đăng ký một lần. Không có API thay thời gian đã công bố.
- Backend chặn báo cáo tuần/cuối, nhận xét, điểm thành phần và chốt điểm ngoài cửa sổ tương ứng. Hạn cuối tính bao gồm đúng thời điểm hạn. Duyệt hồ sơ sau đóng đăng ký và trước kết thúc kỳ; hủy chỉ trong thời gian đăng ký.
- Đợt cũ thiếu lịch được giữ nguyên; thao tác báo cáo/chấm cần lịch sẽ bị chặn với thông báo thiếu cấu hình. Chưa có luồng chuyển đổi lịch cho đợt cũ đã công bố; không tự gán ngày hạn. Khi dùng dữ liệu phát triển mới, tạo đợt mới với lịch đầy đủ.
- Khoa mở khóa báo cáo Reviewed trong 7 ngày đầu, trong hạn nộp tuần và trước chốt điểm, có lý do/audit; giảng viên và sinh viên không được tự mở. UI mở khóa có trên workspace Trưởng khoa. Báo cáo cuối bị khóa nội dung ngay sau khi giảng viên chấm điểm tổng hợp, vẫn xem được nội dung đã nộp.
- Sửa lỗi runtime ExcelJS. Xem trước kiểm tra dữ liệu trùng database, thiếu trường, tín chỉ âm, boolean, độ dài, trùng email; báo đúng số dòng Excel kể cả dòng trống và không đếm âm số dòng hợp lệ. Xác nhận chống chạy đồng thời và chặn điều phối viên xác nhận batch của người khác; không tạo tài khoản tự động.
- Bỏ quyền học vụ giả khỏi danh sách permission của Admin; tài khoản đồng thời có FacultyManager vẫn nhận quyền theo vai trò đó.
- Kiểm thử tự động: backend 14 unit + 31 integration, frontend 8 test logic; lint/typecheck/build cả hai PASS. Test mới từng phát hiện lỗi ExcelJS và đã chạy lại PASS sau sửa.
- Trình duyệt QA database riêng: sinh viên nộp tuần/cuối → giảng viên nhận xét/chấm 9 → doanh nghiệp chấm 8 → khoa xác nhận chốt 8.5/A → sinh viên xem kết quả, không còn form sửa. Kiểm tra 390px không tràn ngang ở workspace sinh viên và form đợt; tạo/công bố đợt trên điện thoại, các giờ 17:00 hiển thị đúng sau lưu. Không có console error trong lần kiểm tra cuối.
- Vẫn chưa nghiệm thu toàn dự án: cần đổi công ty trong kỳ, dashboard đúng phạm vi/đủ chỉ số, thêm sửa hồ sơ thủ công, upload minh chứng/tệp báo cáo và E2E tự động tái chạy toàn bộ luồng. Các kiểm thử trình duyệt trên chưa bao phủ tất cả actor/thao tác, import mới được test bằng service/PostgreSQL.

### Cập nhật ngày 12/09/2026 — công ty tự tìm và quyết định hồ sơ

- Điều phối viên/Admin có màn hình công ty tự tìm: xác nhận tên, địa chỉ, người liên hệ, email, điện thoại và ghi chú; tạo công ty đã xác minh hoặc liên kết công ty đã xác minh trùng tên/email mà không ghi đè thông tin. Tài khoản doanh nghiệp vẫn được cấp riêng từ hồ sơ.
- Xác minh và liên kết cùng giao dịch khóa hồ sơ, chặn xác minh lặp hoặc xử lý hồ sơ đã hủy/từ chối. Công ty đã tồn tại nhưng chưa xác minh phải được xác minh tại danh sách hồ sơ trước.
- Trưởng khoa có thao tác từ chối hồ sơ với lý do, xác nhận và audit; sinh viên xem được kết luận của khoa.
- Chỉ FacultyManager được duyệt/từ chối hồ sơ, quyết định ngoại lệ và chốt điểm. Admin vẫn có quyền đọc API workspace và dashboard, không được thực hiện quyết định học vụ qua API.
- 26/26 integration test pass, backend lint/build và frontend production build (gồm lint/kiểm tra kiểu dữ liệu) pass. Chưa kiểm thử E2E trên trình duyệt.
- Còn cần xử lý mốc thời gian đầy đủ, mở khóa/đổi công ty trong cửa sổ cho phép, import toàn diện, báo cáo quản trị và kiểm thử desktop/mobile.

### Cập nhật ngày 12/09/2026 — workspace phê duyệt và tổng kết

- Bổ sung `GET /faculty-workspace` và giao diện hồ sơ chờ duyệt, xét ngoại lệ có lý do, chọn giảng viên theo quota đang sử dụng, duyệt hồ sơ và chốt điểm với bước xác nhận.
- Tổng kết hiển thị số phiếu doanh nghiệp, điểm giảng viên và điểm dự kiến 50/50; chỉ bật nút chốt khi đủ đúng tập người chấm. Backend vẫn kiểm tra lại điều kiện và khóa giao dịch.
- Xét ngoại lệ chỉ áp dụng cho yêu cầu Pending thuộc hồ sơ Submitted; cập nhật quyết định và audit cùng transaction, chặn ghi đè/lần xử lý thứ hai.
- Phân quyền hiện kế thừa backend: Admin và FacultyManager truy cập workspace; điều phối viên không xem qua endpoint này do chưa có dữ liệu phân phạm vi đợt phụ trách. Cần rà soát quyền Admin phê duyệt nếu yêu cầu chỉ Trưởng khoa được duyệt được áp dụng tuyệt đối.
- 25/25 integration test pass sau khi sửa tên quan hệ quota Prisma; backend build và frontend production build pass. Chưa kiểm thử E2E trình duyệt.
- Còn thiếu luồng từ chối hồ sơ chính thức, liên kết/xác minh công ty tự tìm, mốc thời gian đầy đủ, phân trang/bộ lọc, mở khóa có kiểm soát và kiểm thử UI toàn luồng.

### Cập nhật ngày 12/09/2026 — workspace doanh nghiệp

- Đại diện doanh nghiệp tạo tài khoản nhân viên, nhận mật khẩu tạm để bàn giao một lần, xem danh sách và phân công người hướng dẫn trong 7 ngày đầu; theo dõi số phiếu đã chấm.
- Người hướng dẫn chỉ xem thực tập được phân công, nhập phiếu kỷ luật/trách nhiệm/chuyên môn/kết quả theo thang 2–2–2–4. UI khóa chấm khi đã chốt điểm; backend tiếp tục là nơi kiểm tra quyền và khóa điểm.
- API `GET /company-workspace` kiểm tra vai trò, công ty và phân công; không trả mật khẩu băm hay thông tin học vụ không cần thiết. Người hướng dẫn chỉ nhận phiếu điểm của chính mình.
- Tạo tài khoản nhân viên và audit cùng transaction; chỉ lỗi trùng dữ liệu mới được chuyển thành lỗi email đã sử dụng.
- 24/24 integration test pass; backend lint/build và frontend production build (gồm kiểm tra lint/kiểu dữ liệu) pass. Chưa chạy E2E trình duyệt cho màn hình mới.
- Chưa có thao tác để đại diện tự bổ sung vai trò người hướng dẫn cho chính mình; chưa có chỉnh sửa thông tin công ty trong UI. Các mục hạn chấm, minh chứng tệp và tổng kết của khoa còn cần triển khai.

### Cập nhật ngày 12/09/2026 — workspace giảng viên

- Giảng viên xem/tìm sinh viên được phân công, tiến độ và nội dung báo cáo tuần/cuối kỳ; lưu nhận xét hoặc yêu cầu bổ sung; chấm một điểm tổng hợp gồm báo cáo cuối (50%).
- API danh sách giảng viên chỉ trả thực tập được phân công và giới hạn thông tin sinh viên ở tên, mã, lớp. Đã bổ sung điểm thành phần, điểm chốt và báo cáo cuối cho workspace.
- Backend chặn nộp đè và sửa nhận xét đối với báo cáo `Reviewed`, trong cùng giao dịch khóa thực tập. Báo cáo `NeedsRevision` vẫn cho nộp bổ sung. Chưa có thao tác khoa mở khóa.
- Sửa hiển thị điểm chữ sinh viên để đọc đúng trường `letterGrade`.
- Lint và build cả backend/frontend pass; 23 integration test pass, bao gồm kiểm thử mới về phạm vi giảng viên, chặn chấm/nhận xét người khác, bổ sung báo cáo và chống ghi đè sau nhận xét. Chưa kiểm thử trình duyệt/E2E cho workspace mới.

### Cập nhật ngày 12/09/2026 — workspace sinh viên

- Đã thêm màn hình sinh viên dùng API thật: hồ sơ tín chỉ/xác minh, chọn đợt đang mở, chọn doanh nghiệp hoặc khai báo công ty tự tìm, gửi đăng ký, theo dõi trạng thái, yêu cầu ngoại lệ và xác nhận hủy trong hạn.
- Đã thêm tiến độ báo cáo, xem nhận xét giảng viên, nộp/cập nhật báo cáo tuần, nộp báo cáo cuối và xem điểm đã chốt. UI không cho sửa báo cáo đã được nhận xét; backend vẫn cần bổ sung quy tắc khóa/mở khóa đầy đủ.
- Công thức 50/50 được hiển thị cho kỳ chưa chốt; kết quả đã chốt không bị gắn nhãn công thức mới để tránh mô tả sai điểm lịch sử.
- Frontend lint, typecheck và 8 test hiện có đã pass. Các test hiện có kiểm tra logic báo cáo demo, chưa thay thế E2E của workspace mới. Chưa kiểm thử tương tác trình duyệt desktop/mobile cho màn hình mới.
- Còn thiếu: hạn nộp/chấm, upload tệp báo cáo, xác minh công ty tự tìm hoàn chỉnh, UI giảng viên/doanh nghiệp/trưởng khoa và dashboard theo phạm vi.

### Rà soát ngày 11/09/2026 — chưa hoàn thiện để nghiệm thu

Đã củng cố một phần backend, không phải đã hoàn thành toàn bộ kế hoạch. Các mục lịch sử phía dưới chỉ ghi nhận phần từng triển khai/kiểm tra.

- Mật khẩu tạm: chặn API nghiệp vụ cho cả bảy vai trò; xác minh mật khẩu hiện tại, từ chối dùng lại mật khẩu, thu hồi các phiên khác, audit cùng transaction. UI có nhập mật khẩu tạm và đăng xuất.
- Phê duyệt: chống duyệt đồng thời vượt quota hoặc tạo hai thực tập hiệu lực cho cùng sinh viên; xét lại tín chỉ, nợ học phần, xác minh hồ sơ/tài khoản/công ty khi duyệt.
- Đổi giảng viên: kiểm tra quota, chặn trước ngày bắt đầu và từ thời điểm bắt đầu + 7 ngày; lưu lý do riêng trong audit, không ghép vào mã hành động.
- Chốt điểm: khóa giao dịch chung với cập nhật báo cáo/điểm/phân công; chặn sửa sau chốt, chốt lặp trả 409; kiểm tra đúng tập người hướng dẫn đã được phân công. Công thức hiện tại là 50% doanh nghiệp + 50% giảng viên hướng dẫn; điểm giảng viên bao gồm quyển báo cáo cuối. Snapshot lưu trọng số, tiêu chí, ngưỡng và phiếu doanh nghiệp để không hồi tố điểm đã chốt theo công thức cũ.
- Migration `202609110001_audit_reason` chỉ thêm cột nullable, không reset dữ liệu.

### Phần còn thiếu cần ưu tiên

1. Hạn nộp từng tuần, hạn chấm/tổng kết được cấu hình và khóa khi công bố; luồng mở khóa báo cáo và đổi công ty có lý do. Chưa tự động chốt ngay khi đủ hai thành phần: hiện vẫn gọi API chốt riêng.
2. Kiểm thử E2E workspace sinh viên/giảng viên/doanh nghiệp; UI trưởng khoa duyệt/tổng kết.
3. Hoàn thiện import (kiểm tra trùng database ở bước xem trước, lỗi theo dòng), thêm/sửa hồ sơ thủ công, công ty tự tìm và minh chứng file.
4. Dashboard đúng phạm vi đợt phụ trách, số liệu trễ hạn thật, bộ lọc và báo cáo quản trị.
5. E2E luồng nghiệp vụ thực, kiểm tra màn hình mới desktop/mobile và rà soát toàn bộ phân quyền. Bộ test hiện tại chưa bao phủ hết các mục này.

### Lịch sử triển khai

- Đã có scaffold Docker, frontend Next.js và backend NestJS tối thiểu.
- Đã triển khai bản trải nghiệm sinh viên: tổng quan, kỳ thực tập, tìm kiếm báo cáo, viết/lưu nháp/xem trước báo cáo tuần. Dữ liệu minh họa được ghi nhãn, chưa kết nối backend.
- Giao diện responsive với menu điện thoại, label cho form, báo lỗi tại trường và trạng thái rỗng.
- Đã chạy thành công format check, lint, typecheck, 8 kiểm thử logic, build production và kiểm tra tương tác desktop/mobile; xem TESTING.md.
- Đã có Prisma schema và migration đầu tiên cho User, UserRole, Session, AuditLog, LoginThrottle.
- Đăng nhập/đăng xuất/khôi phục phiên đã kết nối PostgreSQL; mật khẩu băm scrypt, cookie HttpOnly và session hash trong database.
- API danh sách/tạo người dùng yêu cầu quyền Admin; frontend có tìm kiếm, phân trang và form tạo tài khoản.
- 3 unit test backend, 15 integration test PostgreSQL và smoke check 2 vai trò qua Next.js đã PASS. Test tích hợp dùng database riêng, không ghi vào dữ liệu dự án.
- Đã tạo tài khoản local Admin và Student, mật khẩu tại backend/.local/demo-accounts.txt, được Git và Docker ignore.
- Đã thêm migration và API nghiệp vụ cho hồ sơ CNTT, import Excel xem trước/xác nhận, đợt thực tập, eligibility, đăng ký, ngoại lệ, phân công, báo cáo tuần, điểm doanh nghiệp/giảng viên gồm báo cáo cuối và khóa điểm.
- Đã thêm dashboard dữ liệu thật theo quyền; giao diện quản trị có tạo đợt và import mẫu Excel.

## Việc tiếp theo

1. Hoàn thiện màn hình chi tiết hồ sơ, đăng ký, phân công và chấm điểm theo từng role; API nền tảng đã có.
2. Bổ sung integration/E2E chuyên sâu cho import, eligibility, quota, báo cáo và grade lock.
3. Bổ sung upload minh chứng qua MinIO nếu cần cho phiên bản nộp đồ án.

## Known issues

- Docker build sẽ tải dependencies lần đầu; cần kết nối Internet.
- Các secret trong `.env.example` chỉ dành cho môi trường local.
- Đã có đổi mật khẩu tạm; còn thiếu quên/cấp lại mật khẩu, giao diện khóa tài khoản/sửa quyền và vận hành production.
- UI role chi tiết (sinh viên, giảng viên, doanh nghiệp) chưa thay thế hoàn toàn màn hình demo; admin/điều phối có hub dữ liệu thật.
- ExcelJS hiện có cảnh báo npm audit mức moderate từ dependency uuid; không dùng `audit fix --force` vì có thể hạ phiên bản major. Cần theo dõi/upstream thay thế trước production công khai.
