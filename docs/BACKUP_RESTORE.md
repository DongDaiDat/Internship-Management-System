# Sao lưu và khôi phục local

Cần PowerShell 7 và Docker Desktop. Chạy từ gốc repository. Script chỉ phục vụ stack local của đồ án, không phải backup online cho môi trường nhiều máy.

## Sao lưu

Xem trước, không thay đổi dữ liệu:

```powershell
pwsh -File scripts/backup-local.ps1 -Stack qa
```

Sau khi khởi động stack QA, thực hiện:

```powershell
pwsh -File scripts/backup-local.ps1 -Stack qa -Execute
```

Đổi `qa` thành `main` khi chủ động sao lưu dữ liệu chính. Thao tác này tạm dừng frontend/backend/MinIO; không nhập dữ liệu trực tiếp qua PostgreSQL trong thời gian backup. PostgreSQL phải đang chạy. Script chỉ khởi động lại những dịch vụ vốn đang chạy, kể cả khi sao lưu lỗi.

Bộ sao lưu nằm trong `.local/backups/`: `database.dump`, thư mục `minio-data` gồm cả metadata ẩn, và `manifest.json` với SHA-256. Không chia sẻ/commit bộ này: có hồ sơ, hash mật khẩu, phiên đăng nhập và PDF riêng tư. Lưu một bản trên thiết bị an toàn ngoài máy; giữ cấu hình bí mật riêng ở nơi bảo mật. Không đưa `.env` lên GitHub.

Nếu lỗi giữa chừng, thư mục được giữ để chẩn đoán và không được dùng để khôi phục. Kiểm tra `docker compose ps` (hoặc thêm `-f docker-compose.e2e.yml` cho QA) sau thao tác. Backup thành công chưa đồng nghĩa khôi phục thành công.

## Diễn tập khôi phục QA

Đã kiểm chứng ngày 15/09/2026: restore database và MinIO riêng, hash nội dung 22 bảng và 8 PDF khớp nguồn, restart rồi so sánh vẫn đạt. Chưa xác nhận vận hành production hoặc khôi phục đè dữ liệu chính. Chỉ dùng backup tin cậy do chính dự án tạo; checksum không thay thế chữ ký/xác thực nguồn backup.

Yêu cầu đã build stack E2E: image `internship-e2e-backend` và volume dependencies `internship-e2e_e2e-backend-modules`. Stack restore không mở cổng host, không seed và không dùng volume chính. Giữ cùng phiên bản image PostgreSQL/MinIO khi phục hồi; hiện MinIO dùng tag `latest`, chưa có cam kết khôi phục xuyên phiên bản.

Trước khi tạo backup để diễn tập, dừng backend/frontend QA, giữ postgres/minio chạy và chụp fingerprint nguồn (không có người ghi database trực tiếp):

```powershell
docker compose -f docker-compose.e2e.yml stop backend frontend
docker compose -f docker-compose.e2e.yml start postgres minio
docker compose -f docker-compose.e2e.yml run --rm --no-deps -e VERIFY_DATABASE_NAME=internship_sprint4_test -e VERIFY_FINGERPRINT=restore-check-01.json backend node scripts/verify-restore.cjs capture
pwsh -File scripts/backup-local.ps1 -Stack qa -Execute
```

Mỗi lần mới dùng tên fingerprint khác; capture từ chối ghi đè. Fingerprint nằm trong `backend/.local`, chỉ chứa số lượng/hash bảng và metadata hash PDF, không xuất nội dung hồ sơ/mật khẩu. QA phải có ít nhất một PDF đã upload để phép kiểm tra có ý nghĩa.

Dùng đúng đường dẫn backup script vừa trả về:

```powershell
pwsh -File scripts/restore-rehearsal.ps1 -BackupPath .local/backups/<ten-ban-sao>
pwsh -File scripts/restore-rehearsal.ps1 -BackupPath .local/backups/<ten-ban-sao> -Execute
```

Preview kiểm tra SHA-256/dung lượng/danh sách file. Execute chỉ nhận backup QA trong `.local/backups`, sinh project ngẫu nhiên mới và chạy `pg_restore --exit-on-error` vào database trống, copy cả metadata MinIO. Không dùng `--clean`, không xóa/ghi đè volume cũ. Nếu lỗi, project được giữ để chẩn đoán.

Thay `<project>` bằng tên `internship-restore-...` được in ra:

```powershell
docker compose -f docker-compose.restore.yml -p <project> run --rm -e VERIFY_FINGERPRINT=restore-check-01.json verify
docker compose -f docker-compose.restore.yml -p <project> restart postgres minio
docker compose -f docker-compose.restore.yml -p <project> run --rm -e VERIFY_FINGERPRINT=restore-check-01.json verify
docker compose -f docker-compose.restore.yml -p <project> stop
```

Verifier đọc toàn bộ bảng, so hash từng bảng (bao gồm điểm/snapshot/audit/lịch), tải từng PDF qua S3 riêng tư và so SHA-256 với database/nguồn. Nếu MinIO chưa sẵn sàng, chạy lại verifier sau khi kiểm tra container.

Lượt nghiệm thu cuối đã đạt **22 bảng/14 PDF**, trước/sau restart, và API phân quyền trên bản khôi phục: anonymous 401, chủ hồ sơ 200/đúng hash, hồ sơ khác 403. Sau bước compare, có thể chạy `docker compose -f docker-compose.restore.yml -p <project> run --rm verify node scripts/verify-restored-api.cjs` với fixture `qa-sprint4-flow.json` tương ứng bản backup. Bước này login tạo session/audit trên database restore, nên không chạy lại fingerprint so nguồn sau đó. Không sửa fingerprint để che khác biệt.

## Kiểm tra migration

Dùng tên project mới chưa từng có volume, không dùng tên project khôi phục ở trên:

```powershell
docker compose -f docker-compose.restore.yml -p internship-restore-clean-<ma-moi> run --rm verify node scripts/check-clean-install.cjs
docker compose -f docker-compose.restore.yml -p internship-restore-upgrade-<ma-moi> run --rm verify node scripts/check-clean-install.cjs upgrade
```

Script từ chối database không trống. `clean` áp dụng đủ migrations, chạy lại kiểm tra không thay đổi và không seed tài khoản. `upgrade` dựng ba migration cũ, thêm đợt Published giả lập với lịch cố định, nâng lên bản hiện tại và xác nhận lịch cũ giữ nguyên; hạn tuần/hạn chấm/người phụ trách thiếu vẫn để trống. Sau kiểm tra dùng `stop` cho từng project; dữ liệu/volume được giữ, không tự dọn xóa.

Không dùng `docker compose down -v`, `volume prune` hoặc xóa thư mục dữ liệu để xử lý lỗi thông thường.
