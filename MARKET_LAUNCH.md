# BeautyHub — chuẩn bị mở khách công khai và thu cọc thật

Cập nhật 23/10/2026. Mục tiêu mới do chủ dự án chọn: mở khách công khai, thu cọc thật. Phạm vi ứng dụng vẫn là web + PWA. Đây là kế hoạch triển khai và vận hành; chưa phải biên bản nghiệm thu mở bán.

## Trạng thái hiện tại

Supabase vẫn tắt vì chủ dự án chưa sở hữu project cũ. Không chạy migration hoặc gửi giao dịch vào project đó. Build xem trước không có đăng nhập hay booking thật; dữ liệu giả chỉ nằm trong test. Không tự tạo thông tin doanh nghiệp, người vận hành, domain hoặc tài khoản nhận cọc.

Mã nguồn hiện hỗ trợ đối soát chuyển khoản thủ công: khách báo chuyển tiền → admin kiểm tra giao dịch thực nhận → xác nhận. Không có gateway, webhook ngân hàng, QR động, escrow, ví, kế toán hoặc tự động chuyển tiền cho creator. Không dùng cụm từ “thanh toán tự động” khi giới thiệu tính năng này.

## Các phần đã chuẩn bị trong mã nguồn

- Khám phá: tìm kiếm và phân trang tại PostgreSQL, 12 creator/trang (API tối đa 24), kết hợp dịch vụ/khu vực/phong cách/giá và lịch trống trong cùng một yêu cầu. Không tải toàn bộ creator để lọc trên điện thoại, không gọi lịch riêng cho từng gói từ trang tìm kiếm.
- Trang chủ: chỉ tải bốn hồ sơ công khai và hồ sơ của chính tài khoản nếu có. Hồ sơ creator và checkout được tải theo đường dẫn riêng; tải lại link từ bên ngoài vẫn hoạt động dù creator không có ở trang chủ.
- Danh sách đã lưu phân trang theo tài khoản. Admin phân trang hồ sơ 25/trang; ảnh được ký URL cho trang đang xem. Mỗi thẻ công khai chỉ có một ảnh và điểm/tổng đánh giá tổng hợp; hồ sơ có tối đa 12 ảnh và 20 đánh giá công khai mới nhất. Admin hiển thị tối đa 20 đánh giá mới nhất/hồ sơ, chưa phải hệ thống xử lý báo cáo nội dung quy mô lớn.
- Thông tin người vận hành, kênh riêng tư, thời hạn lưu dữ liệu và ngày cập nhật chính sách cấu hình qua môi trường công khai, hiển thị tại `/policies`.
- `npm run check:release`: kiểm tra cấu hình tại máy; không kết nối backend, không in giá trị key hoặc thông tin cấu hình. Backend tắt hoặc thông tin còn trống thì trả về lỗi. Đây không phải kiểm chứng tính hợp pháp, quyền sở hữu hay khả năng hoạt động của URL.
- `npm run build:public`: bắt buộc kiểm tra cấu hình trước build. Trên hosting đặt `VITE_RELEASE_MODE=public`; Vite cũng từ chối build nếu thiếu cấu hình bắt buộc. Build preview vẫn dùng được để duyệt giao diện.

## Thông tin chủ dự án cần cung cấp

| Thông tin | Dùng để làm gì | Trạng thái |
| --- | --- | --- |
| Supabase do nhóm sở hữu và quyền quản trị | Database/Auth/Storage/Cron/backup | Chờ, chưa kết nối |
| URL HTTPS chính thức, có quyền quản lý hosting | Web, PWA, Google callback, khôi phục phiên bản | Chờ |
| Tên chủ thể/người vận hành công khai và đầu mối hỗ trợ | Chính sách, khiếu nại, trực giao dịch | Chờ |
| Kênh xử lý dữ liệu và thời hạn lưu thực tế | Tiếp nhận yêu cầu riêng tư, thực thi lưu/xóa | Chờ |
| Tài khoản ngân hàng nhận cọc, người đối soát và nguồn hoàn tiền | Nhận/hoàn tiền thực tế | Chờ |
| Thỏa thuận với creator: phí nền tảng, bàn giao dịch vụ, nhận cọc, chuyển tiền, hủy và tranh chấp | Phân định nghĩa vụ của các bên | Chờ quyết định |

Không gửi mật khẩu ngân hàng, service-role key hoặc mật khẩu database trong chat hay đưa vào frontend. Google client secret chỉ cấu hình trong dashboard dịch vụ.

## Trình tự triển khai

1. Tạo project staging do nhóm sở hữu. Kiểm tra lịch sử schema rồi chạy sáu migration theo thứ tự trong README, bao gồm `202610230001_catalog.sql`. Không chạy bundle cài mới trên database đã có dữ liệu. Lưu bản sao cấu hình và lịch sử migration. Giữ nhận booking tắt.
2. Cấu hình Google OAuth, callback đúng URL staging, private Storage và Cron. Xác minh UUID của từng admin; dùng tài khoản quản trị riêng, bảo vệ bằng xác thực nhiều bước ở tài khoản Google/dashboard, không chia sẻ phiên đăng nhập. Chưa có bắt buộc MFA cho từng hành động admin trong ứng dụng.
3. Điền thông tin thực vào các biến công khai trong `.env.example`. Biến `VITE_*` đều có thể được khách xem; không chứa secrets. Nhập ngân hàng, chính sách hủy/hoàn và người trực trong khu vực admin. Thông tin hỗ trợ trên website và settings phải nhất quán.
4. Chỉ sau khi chủ động bật kết nối project riêng, chạy `npm run check:backend`. Công cụ chỉ kiểm tra schema version, hình dạng API catalog, cấu hình chính sách công khai và việc bật Google provider; HTTP 200 đơn thuần không đủ. Nó không thử đăng nhập, xác minh domain/ngân hàng hoặc chuyển khoản. Có thể kiểm tra khi `ready=false`.
5. Thực hiện các thử nghiệm thật bên dưới trên staging. Không dùng fixture E2E làm bằng chứng cho bước này. Lưu bằng chứng đã che dữ liệu riêng tư; không commit ảnh ngân hàng hoặc thông tin khách vào repo.
6. Tạo môi trường production riêng hoặc xác minh rõ môi trường sẽ chuyển thành production. Áp dụng migration đã thử; deploy bằng `npm run build:public`, output `dist`, cấu hình HTTPS/security headers/callback đúng origin. Không tái sử dụng dữ liệu thử nghiệm thành hồ sơ/review thật.
7. Kiểm tra URL production, backup/restore, người trực và dòng tiền. Chỉ người vận hành có quyền mới bật nhận booking sau khi hoàn tất các điều kiện. Không tự mở `ready` bằng CI. Theo dõi các giao dịch đầu tiên với số lượng phù hợp khả năng trực/hoàn tiền; chưa có chứng nhận tải lớn.

## Nghiệm thu thật trước khi bật nhận booking

| Việc cần làm | Tiêu chí đạt | Bằng chứng hiện có |
| --- | --- | --- |
| Đăng nhập/đăng xuất Google | Khách, creator, admin riêng; callback/deep link đúng domain, không tăng quyền | Test cục bộ; hosted chưa thử |
| RLS/Storage/API | Khách A không đọc dữ liệu B; ảnh chưa duyệt không công khai; key công khai không vượt quyền | PostgreSQL nhúng; hosted chưa thử |
| Đồng thời và retry | Hai kết nối giữ cùng lịch chỉ có một thành công; retry cùng key không sinh booking mới | Test nghiệp vụ; nhiều kết nối thật chưa thử |
| Cọc thật | Người được ủy quyền chuyển số tiền phù hợp, người khác đối soát mã nhận thực tế; trạng thái và audit đúng | Chưa thử ngân hàng |
| Hoàn thật/cọc muộn | Hoàn có mã giao dịch, không hoàn trùng; booking kết thúc không được phục hồi để chiếm lịch | Test nghiệp vụ; dòng tiền thật chưa thử |
| Phí và tiền của creator | Chốt ai nhận, ai giữ, ai chuyển tiền và ai chịu phí; đối chiếu tổng cọc/hoàn/tiền phải trả mỗi ngày | Chưa có thỏa thuận/sổ đối soát thực tế |
| Creator và dịch vụ | Nội dung gói, tác phẩm có quyền sử dụng, lịch thực tế, thỏa thuận bàn giao/hủy rõ | Chưa nạp dữ liệu thật |
| Cron và trực hỗ trợ | Hết hạn/nhắc lịch đúng; có người trực đối soát và ticket. Thông báo hiện trong app, chưa có email/SMS/push | Scheduler hosted chưa thử |
| Khôi phục | Backup DB + ảnh ngoài project, restore vào môi trường riêng và kiểm tra đối soát; chọn mục tiêu thời gian/mức mất dữ liệu | Chưa diễn tập thật |
| PWA/thiết bị | Cài HTTPS trên iPhone/Android thật, cập nhật không mất form, offline không gửi giao dịch | Chromium đã thử; máy thật chưa thử |
| Tải/giám sát | Đo với số creator/lịch thực tế và số người dùng dự kiến; đặt ngân sách/quota/cảnh báo, có người nhận sự cố | Chưa load test hoặc đo Core Web Vitals thực |
| Chính sách và tư cách vận hành | Nội dung thực tế, đầu mối chịu trách nhiệm, rà soát yêu cầu theo mô hình kinh doanh | Cần chủ dự án xử lý |

## Khi có sự cố hoặc cần rollback

Đóng nhận booking mới trong admin (`ready=false`), vẫn xử lý lịch đã nhận và khoản tiền đang đối soát. Không đánh dấu “chưa nhận tiền” chỉ vì ứng dụng lỗi. Đối chiếu lịch sử ngân hàng và audit trước khi xác nhận lại hoặc hoàn; không yêu cầu khách chuyển thêm tiền để thử.

Quay lại artifact frontend đã kiểm chứng qua hosting. Service worker chờ người dùng đồng ý cập nhật; các tab cũ có thể còn hoạt động, nên giữ API tương thích khi có thể. Không rollback schema bằng cách xóa bảng/cột hoặc chạy lại migration khởi tạo. Với migration catalog mới, triển khai DB trước frontend mới. Nếu phải quay lại frontend cũ, giữ các RPC cũ đến khi chắc chắn không còn client dùng chúng.

Người quản trị ghi thời điểm sự cố, booking bị ảnh hưởng, người xử lý và kết quả đối soát. Không ghi token, số điện thoại, địa chỉ hoặc nội dung ngân hàng vào log gửi công khai. Khi nghi lộ secret, thu hồi/rotate ở dịch vụ sở hữu, kiểm tra artifact và lịch sử truy cập; không chỉ xóa chuỗi khỏi mã nguồn.

## Phạm vi thương mại và dữ liệu

Phạm vi đã đổi từ trình diễn môn học sang khách công khai và tiền thật. Không dùng lý do “môn học” để tự kết luận được miễn nghĩa vụ kinh doanh, thương mại điện tử hoặc dữ liệu. Chủ dự án cần xác định tư cách chủ thể vận hành và loại nền tảng, rồi đối chiếu thủ tục hiện hành với cơ quan/chuyên gia phù hợp; tài liệu này không tự đăng ký hay chứng nhận đáp ứng pháp luật.

Nguồn chính thức đã đối chiếu ngày 23/10/2026: [thông báo của Cục Thương mại điện tử ngày 14/10/2026](https://www.idea.gov.vn/default.aspx?category_id=6e3f3b28-3917-4816-83c5-a331259dd181&do=detail&id=184e0d3f-daab-42a5-a33e-782c78e579c0&page=news) về việc triển khai quy định mới; [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 trên Cổng Chính phủ](https://chinhphu.vn/?classid=1&docid=214590&orggroupid=1&pageid=27160), có hiệu lực 01/01/2026. Không dùng checklist cũ để mặc định phù hợp với thay đổi pháp luật năm 2026.

Về kỹ thuật, các RPC công khai dùng phép chiếu dữ liệu rõ ràng và phân trang; quyền thực thi và `search_path` được giới hạn theo [hướng dẫn database functions](https://supabase.com/docs/guides/database/functions). Các bước hosted/backup/quyền quản trị cần đối chiếu [production checklist Supabase](https://supabase.com/docs/guides/deployment/going-into-prod) trên chính project do nhóm sở hữu.
