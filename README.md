# BeautyHub — web-first private beta

React + TypeScript + Vite; Supabase PostgreSQL/Auth/Storage/Edge Functions; deploy frontend tĩnh lên Vercel. Không còn công tắc giả lập vai trò, JSON database hoặc nút khách tự xác nhận đã thanh toán.

**Trạng thái:** mã nguồn và kiểm thử cục bộ đã có; chưa kết nối Supabase, chưa triển khai hosting, chưa nghiệm thu Google OAuth/tích hợp thanh toán thật. Khi thiếu cấu hình, web hiển thị trạng thái chuẩn bị, không tự sinh creator hoặc giao dịch giả. Không được coi bản này đã mở bán.

## Chạy tại máy

Node.js 22.12+:

```sh
npm ci
npm run dev
npm test
npm run build
```

Mở http://127.0.0.1:4173. Tạo `.env` từ `.env.example`, điền URL Supabase HTTPS và publishable/anon key. Chỉ hai giá trị public này được đưa vào frontend. **Không dùng service-role/secret key hoặc mật khẩu database trong biến `VITE_*`.** Khởi động lại Vite sau khi đổi env.

## Thiết lập Supabase và Google

1. Chủ dự án tạo Supabase Free project, chọn region phù hợp (ví dụ Singapore), bật bảo vệ tài khoản quản trị. Không cần nhập thông tin thẻ cho mã nguồn này.
2. Trong SQL Editor của project **mới**, chạy lần lượt `supabase/migrations/202610050001_beta.sql`, `202610050002_operations.sql`, `202611040001_package_details.sql`, `202611080001_package_anniversary.sql`, rồi `202611080002_payos_deposits.sql`. Migration chi tiết gói tạo các trường bổ sung và RPC `save_package_details`; migration kỷ niệm cho phép nhu cầu Kỷ niệm và giới hạn các giá trị nhu cầu được ghi mới. Migration PayOS thêm bảng link/sự kiện, RLS và RPC chỉ dành cho `service_role`. Ràng buộc kỷ niệm được thêm `NOT VALID` để không quét/từ chối dữ liệu cũ khi áp dụng. Không chạy migration khởi tạo lên database đang có dữ liệu cùng tên. Schema `private` không được thêm vào exposed API schemas.
3. Với Supabase project đã chạy trước đó, chỉ chạy migration mới chưa áp dụng; không chạy lại hai migration khởi tạo. `supabase db push` ở mục deploy bên dưới sẽ áp dụng migrations chưa chạy. Để xác định migration gói đã được áp dụng, chạy:

```sql
select to_regprocedure(
  'public.save_package_details(uuid,text,text,text,integer,integer,integer,text,text,boolean,integer,integer,integer,jsonb,jsonb)'
);
```

Nếu kết quả là `NULL`, chạy nội dung `supabase/migrations/202611040001_package_details.sql` một lần trong SQL Editor. Sau đó làm mới cache RPC của PostgREST:

```sql
notify pgrst, 'reload schema';
```

Không chạy lại migration nếu hàm đã tồn tại; chỉ gửi lệnh reload cache nếu cần. Với database đã áp dụng migration gói, chạy riêng `supabase/migrations/202611080001_package_anniversary.sql` một lần nếu chưa áp dụng.
4. Chạy `supabase/enable-cron.sql` bằng SQL Editor để hết hạn giữ lịch và nhắc hẹn mỗi phút; kiểm tra trạng thái trong Integrations → Cron. Tác vụ cũng giữ lịch sử cron tối đa 7 ngày. Hàm nghiệp vụ đã được thử bằng PostgreSQL nhúng; scheduler Supabase cần kiểm tra trên project thật.
5. Bật Google provider trong Supabase Auth. Chủ tài khoản cấu hình Google OAuth client, consent screen và callback `https://<project-ref>.supabase.co/auth/v1/callback`. Client secret chỉ nhập trong dashboard Supabase.
6. Supabase Auth → URL Configuration: Site URL là URL production. Redirect allowlist gồm URL callback web thực tế (có query `next`): `http://127.0.0.1:4173/auth/callback**` cho local và `https://<site>.vercel.app/auth/callback**` (hoặc custom domain) cho production. Không allowlist wildcard mọi domain. Khi mở khách thật, Google consent screen phải cho phép khách ngoài danh sách test.
7. Người vận hành đăng nhập Google lần đầu. Kiểm tra đúng email trong Auth → Users; cấp admin bằng UUID đã xác minh trong SQL Editor (thay placeholder):

```sql
update public.profiles set role='ADMIN' where id='<verified-auth-user-uuid>'::uuid;
```

8. Creator đăng nhập → Không gian creator → cập nhật tên/số điện thoại trong Tài khoản, tạo hồ sơ, gói, ít nhất 3 ảnh thật có quyền sử dụng và lịch trống. Admin kiểm tra liên hệ, tác phẩm, điều kiện gói rồi duyệt. Không tải ảnh minh họa lên thành tác phẩm của creator.
9. Admin → Cấu hình mở beta: link hỗ trợ HTTPS, chính sách hủy/đổi/hoàn và người trực. Không còn cấu hình tài khoản ngân hàng nhận cọc trong giao diện. Chỉ mở `ready` sau khi nghiệm thu toàn bộ checklist dưới đây.

## Deploy frontend lên Vercel

Tạo Vercel project từ Git repository, dùng lệnh build `npm run build`, output `dist`, Node 22.12+. Chỉ khai báo các biến frontend `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` và các biến `VITE_*` public cần thiết trước khi build. **Không khai báo PayOS secret hoặc Supabase service-role key trong Vercel.**

`vercel.json` rewrite deep link về SPA; CSP/security headers được cấu hình trong đó và `public/_headers`. CSP hiện không cần cho phép thêm PayOS vì frontend chỉ mở checkout bằng điều hướng trình duyệt, còn API/webhook chạy trên Supabase Edge Functions. Nếu dùng Supabase custom domain, cập nhật CSP có chủ đích. Không bật cache API hoặc service-worker cache thông tin riêng tư. Nghiệm thu URL callback thật trước khi mở booking.

## Deploy PayOS qua Supabase Edge Functions

Chỉ tạo và lưu các secrets sau trong Supabase Edge Functions; không đặt chúng trong Vercel hoặc biến `VITE_*`:

- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`
- `APP_BASE_URL` — HTTPS URL production của frontend.
- `ALLOWED_ORIGINS` — danh sách origin frontend, phân tách bằng dấu phẩy; giá trị được trim và bỏ dấu `/` cuối. Production chỉ cần domain Vercel đang dùng (và custom domain nếu có). Chỉ thêm `http://localhost:4173` và `http://127.0.0.1:4173` trong lúc test local; origin chỉ được chấp nhận khi được liệt kê trong secret.

Ví dụ quy trình CLI (thay project ref và các giá trị demo bằng thông tin thật tại máy vận hành; không ghi secret thật vào repository hoặc shell history):

```sh
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
npx supabase secrets set PAYOS_CLIENT_ID="demo-client-id" PAYOS_API_KEY="demo-api-key" PAYOS_CHECKSUM_KEY="demo-checksum-key" APP_BASE_URL="https://beautyhub.example" ALLOWED_ORIGINS="https://beautyhub.example"
npx supabase functions deploy create-payment-link --use-api
npx supabase functions deploy payos-webhook
```

`create-payment-link` yêu cầu JWT; riêng `payos-webhook` xác thực chữ ký PayOS. Khi PayOS chưa cấu hình hoặc tạo link lỗi, khách được hướng dẫn thử lại hoặc liên hệ hỗ trợ; không có luồng thanh toán thủ công.

Khi test local, cập nhật danh sách origin trong Supabase (giữ domain production và thêm đúng các origin cần dùng): `npx supabase secrets set ALLOWED_ORIGINS="https://beautyhub.example,http://localhost:4173,http://127.0.0.1:4173"`. Chỉ các origin được liệt kê mới qua CORS.
## Luồng giao dịch

`REQUESTED → AWAITING_DEPOSIT → PAYMENT_REVIEW → CONFIRMED → COMPLETED → review`

- Khách gửi yêu cầu; giữ lịch tối đa 12 giờ, tối thiểu đặt trước 24 giờ.
- Creator nhận lịch; khách có tối đa 6 giờ thanh toán cọc 30% qua payOS. Giá, nội dung gói và policy được snapshot theo booking.
- Khách thanh toán cọc 30% duy nhất qua PayOS; webhook xác nhận tự động khi giao dịch hợp lệ. Giao dịch thiếu tiền, hết hạn hoặc trùng được ghi nhận để admin xử lý trong `PAYMENT_REVIEW`. Không tự động gửi SMS/email trả phí.
- Sau giờ kết thúc, creator mới được hoàn thành. Chỉ khách booking đó được review, một lần, bốn tiêu chí 1–5.
- Chưa thanh toán cọc: khách hủy trực tiếp. Giao dịch cọc đã nhận hoặc cần kiểm tra: gửi ticket hỗ trợ; admin xử lý theo chính sách snapshot. Hoàn tiền được ghi `REFUND_PENDING` trước, chỉ ghi `REFUNDED` sau giao dịch hoàn thật.
- Đổi lịch xử lý thủ công qua hỗ trợ: thống nhất hai bên, xử lý tiền booking cũ rồi đặt booking mới. Không có công cụ đổi giờ giữ nguyên cọc tự động.
- App chỉ theo dõi **tiền cọc**, không phải kế toán, ví, escrow hay payout. Phần còn lại khách thanh toán trực tiếp cho creator sau buổi hẹn; GMV không phải doanh thu nền tảng.

## Vận hành không thể bỏ qua

- Người trực kiểm tra booking mới, `PAYMENT_REVIEW`, hỗ trợ và khoản hoàn. Thông báo hiện là **trong web**; không tự gửi email/Zalo/SMS. Người trực phải liên hệ thủ công, đặc biệt creator cần phản hồi trong 12 giờ, khách sắp hết hạn thanh toán cọc và lịch trong 24 giờ tới.
- Không thanh toán theo lời nhắn ngoài thông tin booking. Giao dịch cọc muộn hoặc bất thường cần được kiểm tra qua ticket; booking hết hạn không tự phục hồi và không tự chiếm lịch mới.
- Đặt `ready=false` khi không có người trực hoặc hệ thống lỗi. Việc đóng nhận mới không xóa booking hiện có.
- Mỗi ngày sao lưu dữ liệu bằng Supabase CLI `supabase db dump --db-url <connection> -f backup.sql --data-only` trên máy quản trị; tránh ghi password vào history/log. Sao lưu role/schema theo hướng dẫn chính thức và copy riêng các object portfolio: dump DB **không chứa file ảnh**. Giữ bản sao mã hóa ngoài project, giới hạn người đọc; thử khôi phục vào môi trường riêng trước khi mở beta. Không tự động chạy backup khi chưa có kết nối quản trị.
- Theo dõi quota Storage/DB/egress và log. Free không đồng nghĩa SLA hay miễn phí vô hạn. Supabase Free có thể tạm dừng khi ít hoạt động; không dùng ping giả để lách cơ chế này. Kiểm tra dashboard trước khi nhận khách.
- Chỉ duyệt quyền tác phẩm, không tuyên bố đã eKYC. Ẩn nội dung không xóa bản gốc; signed URL đã cấp có thể còn dùng được tối đa một giờ.

## Kiểm thử trước khi mời khách

`npm test` chạy chính migration bằng PGlite (PostgreSQL nhúng), kiểm tra RLS, quyền actor, state machine, snapshot, idempotency, ràng buộc loại trừ lịch giao nhau, hoàn tiền, review, nhắc lịch và analytics. Mock chỉ phần schema auth/storage của Supabase; **không thay thế nghiệm thu Auth/PostgREST/Storage trên hosted Supabase, không phải load test nhiều kết nối**.

- [ ] Google login/logout/callback/deep-link trên production, hai tài khoản khách và một creator/admin riêng.
- [ ] Creator tạo và cập nhật hồ sơ, ảnh thật, package, mở/đóng lịch; quyền đọc ảnh người lạ và ảnh chưa duyệt đúng.
- [ ] Khách tìm đúng creator theo tất cả bộ lọc AND; ngày/giờ Việt Nam đúng.
- [ ] Hai trình duyệt gửi cùng giờ đồng thời: chỉ một booking giữ được lịch. Bấm gửi lại sau lỗi mạng không sinh hai booking.
- [ ] PayOS webhook hợp lệ, thiếu tiền, trễ hạn, trùng giao dịch và booking đã hủy; xác nhận chỉ qua dữ liệu DB, không tin query string return URL.

- [ ] Cron hết hạn giữ lịch, nhắc lịch đúng một lần cho hai bên, không tự giải phóng `PAYMENT_REVIEW`.
- [ ] Hủy, tranh chấp và hoàn tiền thật; mã đối soát được lưu, không hoàn hai lần.
- [ ] Hoàn thành sau giờ kết thúc → review một lần; khách lạ không xem địa chỉ/số điện thoại/lịch sử booking.
- [ ] Desktop 1440px, mobile 390px, mất mạng, tải lại, back/forward và báo lỗi có thể khôi phục.
- [ ] Sao lưu/khôi phục DB + ảnh; đối soát dữ liệu trước khi mở `ready`.

## Phạm vi và giới hạn minh bạch

- Web-first, responsive, không cần cài app. Chưa có native app/chat/AI matching, payout tự động hay push notification.
- Thống kê funnel chỉ tài khoản đã đăng nhập, tối đa 100 event/ngày/tài khoản, gộp cùng loại trong 10 giây, giữ 90 ngày. Không ghi search term, địa chỉ hoặc ghi chú vào event. `CONFIRMED`/`COMPLETED` lấy từ booking thật. Chưa có visitor analytics cho khách chưa đăng nhập.
- Admin metrics tổng hợp toàn bộ database; danh sách admin giới hạn 500 booking, 200 ticket, 500 users và 100 audit gần nhất. Tăng trưởng vượt beta cần pagination/monitoring/anti-abuse và load testing bổ sung.
- Có khóa tại DB + exclusion constraint, không dựa vào đồng hồ hoặc localStorage phía khách để xác nhận giữ chỗ/thanh toán. PayOS là luồng thanh toán cọc duy nhất. Rate limit nghiệp vụ chưa thay thế WAF chống tấn công phân tán.
- Portfolio được nén WebP trước upload, private bucket giới hạn 512 KB/ảnh và 12 ảnh/creator. Kiểm tra MIME/size không phải dịch vụ quét mã độc hoặc nhận diện ảnh tự động. Orphan upload cần người quản trị dọn, hiện chưa có nút xóa ảnh của creator.
- SEO dùng URL riêng, title/description cơ bản; chưa prerender từng hồ sơ, chưa có sitemap production hay OpenGraph động. Không giả định SPA đã đạt SEO đầy đủ.
- Prototype và ảnh demo giữ ở `legacy/`, không nằm trong bản deploy. `data/db.json` cũ không được dùng/import vào database mới. Không deploy `legacy/server.cjs`.

## Tham khảo triển khai

- [Google OAuth / Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Cron](https://supabase.com/docs/guides/cron/quickstart)
- [Backup Supabase](https://supabase.com/docs/guides/platform/backups)
- [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
