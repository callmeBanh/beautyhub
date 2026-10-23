# BeautyHub — Web + PWA, chuẩn bị ra mắt công khai

React + TypeScript + Vite; Supabase PostgreSQL/Auth/Storage; deploy static lên Cloudflare Pages. Không còn công tắc giả lập vai trò, JSON database hoặc nút khách tự xác nhận đã thanh toán.

**Mục tiêu hiện tại:** web + PWA để mở khách công khai và thu cọc thật theo lựa chọn mới của chủ dự án. Đợt hoàn thiện môn học đã có; điều kiện mở thị trường và phần còn chờ được ghi tại [MARKET_LAUNCH.md](MARKET_LAUNCH.md). Supabase vẫn để sau vì chủ dự án chưa sở hữu project cũ; không thao tác project đó. Frontend, migration và kiểm thử cục bộ đã có; chưa nghiệm thu đăng nhập hosted, ngân hàng hoặc production. Khi thiếu cấu hình, web hiển thị trạng thái chuẩn bị, không tự sinh creator/giao dịch giả. **Hiện chưa mở nhận tiền.**

## Chạy tại máy

Node.js 22.12+:

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:pwa
```

Mở http://127.0.0.1:4173. Mặc định `.env.example` đặt `VITE_BACKEND_ENABLED=false` để xem giao diện mà không truy cập backend. Khi nhóm có project Supabase riêng, điền URL HTTPS và publishable/anon key rồi đổi `VITE_BACKEND_ENABLED=true`. Chỉ hai giá trị public này được đưa vào frontend. **Không dùng service-role/secret key hoặc mật khẩu database trong biến `VITE_*`.** Khởi động lại Vite sau khi đổi env.

## PWA và hướng dẫn môn học

`npm run build` tạo icon, bundle và service worker có phiên bản. Chạy `npm run preview -- --port 4180`, mở `http://127.0.0.1:4180/install` để kiểm tra bản cài; service worker không chạy trong dev. Trên hosting dùng HTTPS và cấu hình headers của Cloudflare/Vercel. PWA có màn hình kết nối lại khi mất mạng, không gửi booking hoặc thanh toán ngầm. Bản cập nhật chỉ tải lại khi người dùng chọn.

Xem [CLASSROOM_GUIDE.md](CLASSROOM_GUIDE.md) cho các phần xem được ngay, các phần chờ backend và cách trình bày trung thực trước thầy cô. Để chuyển sang khách công khai và thu cọc thật, dùng [MARKET_LAUNCH.md](MARKET_LAUNCH.md), cấu hình các thông tin công khai trong `.env.example`, chạy `npm run check:release` và deploy với `npm run build:public`, `VITE_RELEASE_MODE=public`. Các kiểm tra này không thay thế nghiệm thu backend/ngân hàng, đánh giá pháp lý hay quyền sở hữu dịch vụ.

## Thiết lập Supabase và Google

1. Chủ dự án tạo Supabase Free project, chọn region phù hợp (ví dụ Singapore), bật bảo vệ tài khoản quản trị. Không cần nhập thông tin thẻ cho mã nguồn này.
2. Khi có project do nhóm sở hữu, áp dụng lần lượt `202610050001_beta.sql`, `202610050002_operations.sql`, `202610210001_hardening.sql`, `202610220001_audit.sql`, `202610220002_product.sql`, `202610230001_catalog.sql` trong `supabase/migrations`. Không chạy lại migration khởi tạo hoặc đoán trạng thái DB. Có thể dùng `npm run db:bundle` để chuẩn bị script cho project mới hoặc DB có đúng hai migration gốc; xem [CLASSROOM_GUIDE.md](CLASSROOM_GUIDE.md). Script chỉ tạo file, không tự kết nối/migrate. Schema `private` không được exposed qua API.
3. Chạy `supabase/enable-cron.sql` bằng SQL Editor để hết hạn giữ lịch và nhắc hẹn mỗi phút; kiểm tra trạng thái trong Integrations → Cron. Tác vụ cũng giữ lịch sử cron tối đa 7 ngày. Hàm nghiệp vụ đã được thử bằng PostgreSQL nhúng; scheduler Supabase cần kiểm tra trên project thật.
4. Bật Google provider trong Supabase Auth. Chủ tài khoản cấu hình Google OAuth client, consent screen và callback `https://<project-ref>.supabase.co/auth/v1/callback`. Client secret chỉ nhập trong dashboard Supabase.
5. Supabase Auth → URL Configuration: Site URL là URL production. Redirect allowlist gồm URL callback web thực tế (có query `next`): `http://127.0.0.1:4173/auth/callback**` cho local và `https://<site>.pages.dev/auth/callback**` cho production. Không allowlist wildcard mọi domain. Khi mở khách thật, Google consent screen phải cho phép khách ngoài danh sách test.
6. Người vận hành đăng nhập Google lần đầu. Kiểm tra đúng email trong Auth → Users; cấp admin bằng UUID đã xác minh trong SQL Editor (thay placeholder):

```sql
update public.profiles set role='ADMIN' where id='<verified-auth-user-uuid>'::uuid;
```

7. Creator đăng nhập → Không gian creator → cập nhật tên/số điện thoại trong Tài khoản, tạo hồ sơ, gói, ít nhất 3 ảnh thật có quyền sử dụng và lịch trống. Admin kiểm tra liên hệ, tác phẩm, điều kiện gói rồi duyệt. Không tải ảnh minh họa lên thành tác phẩm của creator.
8. Admin → Cấu hình mở beta: tài khoản ngân hàng nhận cọc, link hỗ trợ HTTPS, chính sách hủy/đổi/hoàn, người trực. Chỉ mở `ready` sau khi nghiệm thu toàn bộ checklist dưới đây. Chính sách không được coi là đã rà soát pháp lý chỉ vì được nhập vào hệ thống.

## Deploy Cloudflare Pages Free

Khi muốn chia sẻ bài học qua HTTPS, chủ tài khoản tạo Pages project từ Git repository chứa mã nguồn này. Với bản công khai, build `npm run build:public`, đặt `VITE_RELEASE_MODE=public`, output `dist`, Node 22.12+. Khai báo các biến env công khai và thông tin vận hành trong `.env.example` **trước khi build**. Có thể upload `dist` bằng dashboard sau khi build với env production.

`public/_redirects` hỗ trợ deep link SPA; `public/_headers` cung cấp CSP và security headers. CSP hiện cho phép Supabase hostname chuẩn `*.supabase.co`; nếu dùng custom domain, cập nhật CSP có chủ đích. Dùng URL `pages.dev` nếu không muốn mua domain. Service worker chỉ cache allowlist tài nguyên giao diện công khai; không cache API, OAuth, signed URL, booking hoặc dữ liệu cá nhân. Không thêm cache cho dữ liệu riêng tư. Deploy frontend trước khi mở booking và nghiệm thu URL callback thật.

Nếu dùng Vercel, `vercel.json` cũng khai báo security headers và SPA rewrite; `_headers` chỉ có tác dụng trên Cloudflare Pages. Font chỉ tải từ cùng website. Dev/build từ chối secret/service-role key trong `VITE_SUPABASE_ANON_KEY`; đây không thay thế việc kiểm tra toàn bộ biến `VITE_*` và artifact trước khi deploy. Nếu từng deploy nhầm secret, phải thu hồi/rotate trong Supabase và xóa artifact/cache đã lộ.

## Luồng giao dịch

`REQUESTED → AWAITING_DEPOSIT → PAYMENT_REVIEW → CONFIRMED → COMPLETED → review`

- Khách gửi yêu cầu; giữ lịch tối đa 12 giờ, tối thiểu đặt trước 24 giờ.
- Creator nhận lịch; khách có tối đa 6 giờ chuyển cọc 30%. Giá, nội dung gói, ngân hàng và policy được snapshot theo booking.
- Khách báo đã chuyển chỉ tạo `REPORTED`. Admin kiểm tra tiền thực nhận, nhập mã tham chiếu rồi mới xác nhận. Không có gateway/QR tự động, SMS/email trả phí hoặc webhook thanh toán giả.
- Sau giờ kết thúc, creator mới được hoàn thành. Chỉ khách booking đó được review, một lần, bốn tiêu chí 1–5.
- Chưa chuyển tiền: khách hủy trực tiếp. Đã báo chuyển/đã nhận tiền: ticket hỗ trợ; admin xử lý theo chính sách snapshot. Hoàn tiền được ghi `REFUND_PENDING` trước, chỉ ghi `REFUNDED` sau giao dịch hoàn thật.
- Cọc đúng số tiền nhưng chuyển muộn vào booking `EXPIRED`/`CANCELLED`/`REJECTED`: admin kiểm tra tiền thực nhận, mở booking → **Đối soát cọc chuyển muộn để hoàn**. RPC ghi hàng chờ hoàn và audit, giữ nguyên trạng thái kết thúc, không chiếm lại lịch. Chỉ ghi nhận một lần. Mã giao dịch nhận cọc/hoàn tiền có ràng buộc duy nhất sau khi chuẩn hóa chữ hoa/thường và khoảng trắng ở đầu/cuối. Admin chỉ nhập mã ngân hàng, không thêm ghi chú vào mã; DB chặn mã trùng chính xác, nhưng không thể nhận biết người nhập hai chuỗi khác nhau cho cùng một giao dịch ngân hàng. Tiền chuyển thiếu/thừa vẫn cần đối soát thủ công; không có kết nối ngân hàng thật.
- Đổi lịch xử lý thủ công qua hỗ trợ: thống nhất hai bên, xử lý tiền booking cũ rồi đặt booking mới. Không có công cụ đổi giờ giữ nguyên cọc tự động.
- App chỉ theo dõi **tiền cọc**, không phải kế toán, ví, escrow hay payout. Phần còn lại và việc chuyển tiền cọc cho creator phải có thỏa thuận/đối soát riêng; GMV không phải doanh thu nền tảng.

## Vận hành không thể bỏ qua

- Người trực kiểm tra booking mới, `PAYMENT_REVIEW`, hỗ trợ và khoản hoàn. Thông báo hiện là **trong web**; không tự gửi email/Zalo/SMS. Người trực phải liên hệ thủ công, đặc biệt creator cần phản hồi trong 12 giờ, khách sắp hết hạn chuyển tiền và lịch trong 24 giờ tới.
- Không chuyển tiền theo lời nhắn ngoài thông tin booking. Tiền chuyển muộn/sai nội dung phải đối soát qua ticket; booking hết hạn không tự phục hồi và không tự chiếm lịch mới.
- Đặt `ready=false` khi không có người trực hoặc hệ thống lỗi. Việc đóng nhận mới không xóa booking hiện có.
- Mỗi ngày sao lưu dữ liệu bằng Supabase CLI `supabase db dump --db-url <connection> -f backup.sql --data-only` trên máy quản trị; tránh ghi password vào history/log. Sao lưu role/schema theo hướng dẫn chính thức và copy riêng các object portfolio: dump DB **không chứa file ảnh**. Giữ bản sao mã hóa ngoài project, giới hạn người đọc; thử khôi phục vào môi trường riêng trước khi mở beta. Không tự động chạy backup khi chưa có kết nối quản trị.
- Theo dõi quota Storage/DB/egress và log. Free không đồng nghĩa SLA hay miễn phí vô hạn. Supabase Free có thể tạm dừng khi ít hoạt động; không dùng ping giả để lách cơ chế này. Kiểm tra dashboard trước khi nhận khách.
- Chỉ duyệt quyền tác phẩm, không tuyên bố đã eKYC. Ẩn nội dung không xóa bản gốc; signed URL đã cấp có thể còn dùng được tối đa một giờ.

## Kiểm thử trước khi mời khách

`npm test` chạy chính migration bằng PGlite (PostgreSQL nhúng), kiểm tra RLS, quyền actor, state machine, snapshot, idempotency, ràng buộc loại trừ lịch giao nhau, hoàn tiền, review, nhắc lịch và analytics. Mock chỉ phần schema auth/storage của Supabase; **không thay thế nghiệm thu Auth/PostgREST/Storage trên hosted Supabase, không phải load test nhiều kết nối**.

`npm run test:e2e` chạy Chromium desktop 1440px và mobile 390px với HTTP Supabase được giả lập: khám phá → hồ sơ → booking, retry lỗi mạng cùng request key, creator nhận lịch, báo cọc, admin xác nhận, hoàn thành/review, hủy chưa cọc, hỗ trợ hủy/hoàn cọc và cọc chuyển muộn. Có kiểm tra axe cho các trang chính. Đây là test hợp đồng UI; không dùng chúng để xác nhận RLS, OAuth, ngân hàng hoặc production. Chi tiết và phần còn thiếu nằm trong [VERIFICATION.md](VERIFICATION.md). CI chạy test, build và E2E khi mở PR; không tự deploy hay migrate DB.

- [ ] Google login/logout/callback/deep-link trên production, hai tài khoản khách và một creator/admin riêng.
- [ ] Creator tạo và cập nhật hồ sơ, ảnh thật, package, mở/đóng lịch; quyền đọc ảnh người lạ và ảnh chưa duyệt đúng.
- [ ] Khách tìm đúng creator theo tất cả bộ lọc AND; ngày/giờ Việt Nam đúng.
- [ ] Hai trình duyệt gửi cùng giờ đồng thời: chỉ một booking giữ được lịch. Bấm gửi lại sau lỗi mạng không sinh hai booking.
- [ ] Chuyển khoản giá trị nhỏ được cho phép bởi người vận hành → đối soát thủ công → xác nhận; khách/provider không tự nâng quyền hoặc sửa tiền.
- [ ] Cron hết hạn giữ lịch, nhắc lịch đúng một lần cho hai bên, không tự giải phóng `PAYMENT_REVIEW`.
- [ ] Hủy, tranh chấp và hoàn tiền thật; mã đối soát được lưu, không hoàn hai lần.
- [ ] Hoàn thành sau giờ kết thúc → review một lần; khách lạ không xem địa chỉ/số điện thoại/lịch sử booking.
- [ ] Desktop 1440px, mobile 390px, mất mạng, tải lại, back/forward và báo lỗi có thể khôi phục.
- [ ] Sao lưu/khôi phục DB + ảnh; đối soát dữ liệu trước khi mở `ready`.

## Phạm vi và giới hạn minh bạch

- Web responsive + PWA có thể thêm vào màn hình chính. Xem `/install` và [CLASSROOM_GUIDE.md](CLASSROOM_GUIDE.md). Chưa có app phát hành qua cửa hàng, chat/AI matching/gateway hoặc push notification.
- Thống kê funnel chỉ tài khoản đã đăng nhập, tối đa 100 event/ngày/tài khoản, gộp cùng loại trong 10 giây, giữ 90 ngày. Không ghi search term, địa chỉ hoặc ghi chú vào event. `CONFIRMED`/`COMPLETED` lấy từ booking thật. Chưa có visitor analytics cho khách chưa đăng nhập.
- Admin dùng truy vấn phân trang 25 dòng cho booking, hàng chờ đối soát/hoàn/hỗ trợ, người dùng và audit; xử lý ticket tải riêng booking cần thiết. Thống kê dùng RPC tổng hợp toàn DB. Catalog công khai và danh sách đã lưu phân trang 12/trang tại DB; admin hồ sơ 25/trang, public card chỉ một ảnh và số tổng hợp, chi tiết tối đa 20 đánh giá mới nhất. Chưa load test trên hosted database hoặc chứng nhận hiệu năng quy mô thị trường.
- Có khóa tại DB + exclusion constraint, không dựa vào đồng hồ hoặc localStorage phía khách để xác nhận giữ chỗ/thanh toán. Rate limit nghiệp vụ chưa thay thế WAF chống tấn công phân tán.
- Portfolio được nén WebP trước upload, private bucket giới hạn 512 KB/ảnh và 12 ảnh/creator. Kiểm tra MIME/size không phải dịch vụ quét mã độc hoặc nhận diện ảnh tự động. Creator có thể xóa ảnh của mình, giữ ít nhất ba ảnh khi hồ sơ đang hoạt động/chờ duyệt. DB gỡ tham chiếu trước khi xóa Storage; nếu xóa file thất bại, UI báo để quản trị dọn object mồ côi.
- Creator đã lưu nằm trong bảng riêng theo tài khoản, RLS ngăn đọc chéo; tối đa 100 creator/tài khoản. Thông báo chưa đọc được làm mới khi ứng dụng hiển thị và có mạng, không phải push.
- Review công khai qua `provider_reviews` chỉ chứa nội dung hiển thị, không trả `author_id`/`booking_id`. Bảng review đầy đủ chỉ cho khách tác giả, admin hoặc bên liên quan theo policy. Nội dung review/tên hiển thị vẫn là công khai: không nhập địa chỉ hoặc thông tin ngân hàng vào review. Nháp booking lưu trong phiên tab để khôi phục lỗi mạng, được xóa khi gửi thành công hoặc đăng xuất; trình duyệt chặn lưu nháp vẫn gửi booking được.
- SEO dùng URL riêng, title/description cơ bản; chưa prerender từng hồ sơ, chưa có sitemap production hay OpenGraph động. Không giả định SPA đã đạt SEO đầy đủ.
- Prototype và ảnh demo giữ ở `legacy/`, không nằm trong bản deploy. `data/db.json` cũ không được dùng/import vào database mới. Không deploy `legacy/server.cjs`.

## Tham khảo triển khai

- [Google OAuth / Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Cron](https://supabase.com/docs/guides/cron/quickstart)
- [Backup Supabase](https://supabase.com/docs/guides/platform/backups)
- [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
