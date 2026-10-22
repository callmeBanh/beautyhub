# Kiểm tra repository — 22/10/2026

Base: `main` tại `cbdb4af2a944f67447e8c8aa0e5159c85b241708`. Kiểm tra cục bộ trên Windows, Node 24.15.0. Không có project Supabase, OAuth hoặc ngân hàng thật được kết nối trong phiên kiểm tra này.

## Kết quả

- `npm test`: 34/34 đạt (4 domain, 30 PostgreSQL/RLS); trước sửa là 26/26.
- `npm run build`: TypeScript strict và production bundle đạt.
- `npm run test:e2e`: 14/14 đạt trên Chromium desktop 1440×1000 và mobile 390×844, gồm hai bài axe. HTTP Supabase được giả lập, không thay thế kiểm thử tích hợp hosted. Đã xem ảnh chụp hồ sơ/admin mobile và booking desktop.
- axe kiểm tra WCAG 2 A/AA và 2.1 AA trên khám phá, hồ sơ, booking và admin với fixture kiểm thử. Đã phát hiện rồi sửa lỗi tương phản. Kết quả tự động không phải chứng nhận accessibility; vẫn cần thử screen reader, thiết bị thật và nội dung dài thực tế.
- `npm audit`: 0 vulnerability sau cập nhật Vite 8.3.2 → 8.3.5 và dependency liên quan trong lockfile. Phạm vi là advisory tại thời điểm chạy.

## Lỗi thực và thay đổi

| Vấn đề | Sửa | Kiểm chứng |
| --- | --- | --- |
| Policy review công khai cho phép đọc toàn bộ cột, gồm UUID tác giả và booking | Thu hẹp RLS bảng đầy đủ; thêm RPC projection công khai không chứa hai UUID, chỉ review hiện và creator đã duyệt | SQL: khách khác/anonymous không đọc bảng riêng; projection vẫn có review công khai |
| `null` và phần tử mảng `null` có thể bỏ qua điều kiện PL/pgSQL, tạo hồ sơ không dùng được hoặc đóng ticket với quyết định hủy không rõ | Guard đầu vào cho cấu hình, hồ sơ, booking action, xử lý hỗ trợ và mã hoàn | SQL regression cho mảng, cấu hình và ticket; lỗi không làm thay đổi dữ liệu |
| Booking hết hạn/hủy/từ chối nhận cọc chuyển muộn không có đường ghi nhận hoàn | Admin RPC `reconcile_late_deposit`, khóa booking, chỉ nhận một lần, audit và hàng chờ hoàn; UI giải thích cần thực nhận đúng cọc | SQL: khách bị từ chối, ghi nhận/hoàn lặp bị chặn, booking kết thúc không chiếm lại lịch đã có khách khác |
| Storage trình duyệt bị chặn khiến gửi booking thất bại trước RPC; request key còn lưu sau thành công khiến đặt lại cùng giờ quay về booking cũ | Request key ổn định trong component, lưu phiên khi có thể, xóa sau thành công; xóa nháp khi logout | Browser: chặn sessionStorage vẫn booking được; lỗi mạng giữ nháp và gửi lại cùng key |
| URL booking/checkout đổi trong SPA giữ state cũ; lỗi truy vấn phụ bị bỏ qua | Remount theo URL; reset chi tiết, kiểm tra lỗi events/ticket/review và hiển thị nút thử lại | Browser: URL booking không tồn tại hiển thị lỗi, không còn địa chỉ booking cũ |
| Modal Escape dùng closure cũ có thể đóng khi request đang chạy; Tab từ container bỏ qua nút đầu/đi qua control disabled | Callback hiện tại qua ref, sửa vòng focus và loại control disabled | Browser: Escape khi gửi xác nhận không đóng modal |
| Màn hình admin ban đầu hiển thị hàng đợi rỗng trước khi tải; lỗi lịch bị trộn với không có lịch | Loading/error/retry riêng, không coi lỗi kiểm tra lịch là empty state | Browser desktop/mobile, axe, SQL không bị thay đổi |
| Chữ và badge thiếu tương phản, input mobile quá nhỏ, chuỗi dài dễ tràn | Tăng tương phản, input mobile 16px, vùng chạm 44px cho icon/slot, co cột và wrap nội dung dài | axe ở 4 trang, kiểm tra không tràn ngang tại các trang trong journey |
| CSP chặn font self-host; Vercel chưa có các header Cloudflare | Cho phép font từ self, bỏ Google Fonts; khai báo header tương ứng trong Vercel | Đọc config và kiểm tra bundle; cần xác nhận response headers sau deploy |
| Có thể vô tình bundle service-role/secret vào biến key frontend | Chỉ nhận anon JWT/publishable key, dev/build fail sớm với key không phù hợp | Domain regression; kiểm tra build bằng secret fixture riêng, không dùng credential thật |
| Vite 8.3.2 có advisory high | Cập nhật Vite/lockfile trong khoảng phiên bản cho phép | Build, E2E, npm audit |

## Phủ luồng booking và quyền

- SQL dùng migration thật trong PGlite. Chỉ schema Auth/Storage được mô phỏng. Luồng mới dùng RPC cho tìm giờ, tạo booking, creator nhận, khách báo chuyển, admin xác nhận, creator hoàn thành và khách review; chỉ dùng cập nhật quản trị để dịch thời gian kết thúc về quá khứ trong fixture.
- Kiểm tra giá/cọc/policy snapshot, key retry, vùng phục vụ, giờ quá khứ/không mở, overlap constraint, khách lạ, anonymous, tự cấp admin, giả xác nhận tiền, hoàn thành sớm, review sai điểm/sai tác giả/lặp, từ chối và hủy chưa cọc, giải phóng lịch, không tìm thấy giao dịch rồi báo lại, không expire `PAYMENT_REVIEW`, hỗ trợ hủy/hoàn, hoàn lặp, cọc muộn, cron/reminder và analytics.
- Storage: khách lạ/anonymous không đọc ảnh chưa duyệt; không upload vào thư mục creator khác; sau duyệt mới đọc được ảnh. Đây là thử policy trong PostgreSQL, chưa thử HTTP upload/sign/download hosted.
- Browser kiểm tra thao tác UI, nội dung, điều hướng, lỗi mạng và accessibility trên fixture; HTTP giả lập không thực thi quyền hoặc state machine. Các xác nhận quyền/state dựa trên bộ SQL riêng.
- Thêm workflow `Verification`: npm ci → SQL/domain → build → Playwright trên Linux/Node 22. Kết quả CI phải đọc riêng trên GitHub; không suy từ việc local đạt.

## Việc cần cấu hình và nghiệm thu trên Supabase thật

1. Sao lưu DB và Storage, thử khôi phục ở staging. Với DB đã có schema cũ, chỉ chạy `202610220001_audit.sql` sau hai migration đầu. Kiểm tra dữ liệu hiện có có mảng sai/null trước khi mở creator. Deploy migration trước frontend mới; refresh schema cache nếu RPC chưa xuất hiện. Không expose schema `private`.
2. Hai khách, creator và admin riêng: Google OAuth/callback/allowlist, logout, refresh token, khôi phục phiên và deep link. Admin chỉ được cấp bằng UUID đã xác minh qua SQL quản trị. Không dùng metadata người dùng để cấp role.
3. Thử PostgREST bằng anon/customer/provider/admin: bảng profiles/bookings/events/support/audit/analytics, review đầy đủ và projection công khai; xác nhận RLS/grant trên project thực tế không có policy cũ mở rộng quyền ngoài migration.
4. Bucket portfolio private, MIME/512 KB, thư mục theo user, ảnh chưa duyệt/đã ẩn; thử signed URL bằng tài khoản khác và sau revoke/ẩn. URL đã cấp có thể còn hiệu lực một giờ. Kiểm tra quyền service-role chỉ tồn tại ở hệ thống quản trị tin cậy.
5. Chạy nhiều kết nối thật đặt cùng slot và gửi cùng key; thử timeout sau commit rồi retry. PGlite là một kết nối, chưa phải kiểm thử race/load thực tế. Giám sát deadlock/retry, giới hạn API và quota.
6. Cấu hình Cron/maintenance, kiểm tra expire và reminder một lần trên hosted; giám sát job lỗi. Giữ `ready=false` khi chưa có người trực và chính sách được duyệt.
7. Chuyển khoản nhỏ thật, đối soát đúng người/booking/số tiền, xử lý báo sai/chuyển muộn/thiếu/thừa/hủy/tranh chấp; hoàn thật rồi mới ghi `REFUNDED`. Mã tham chiếu hiện là văn bản tự do, chưa chống dùng cùng một giao dịch ngân hàng cho nhiều booking bằng sổ ledger duy nhất. Người vận hành phải kiểm tra và tránh xác nhận trùng.
8. Công bố người phụ trách dữ liệu, liên hệ hỗ trợ, thời hạn lưu/xóa dữ liệu tài khoản/giao dịch/backup, quyền tác phẩm và quy trình yêu cầu riêng tư phù hợp thực tế. Repo chưa có chính sách lưu giữ giao dịch cố định hoặc tác vụ tự xóa tài khoản. Review là công khai; không đưa thông tin nhạy cảm vào nội dung.
9. Kiểm tra header HTTP/CSP/font, SPA callback/deep link, HTTPS, cache dữ liệu riêng tư và env thực tế trên Cloudflare/Vercel. Kiểm tra toàn bộ biến `VITE_*`; guard key không phải secret scanner toàn diện. Nếu từng lộ credential, rotate; sửa code không thu hồi credential đã lộ.

Chưa nghiệm thu gateway, thanh toán/hoàn tiền thật, production, nhiều kết nối, Auth/Storage hosted, Cron hosted hoặc backup/restore. App vẫn là private beta đối soát cọc thủ công; không phải ví, escrow, ledger ngân hàng hoặc payout.
