# BeautyHub — hướng dẫn trải nghiệm môn học

Đây là hướng dẫn bản web + PWA dùng cho môn Trải nghiệm khởi nghiệp. Mục tiêu mới là mở khách công khai và thu cọc thật; xem MARKET_LAUNCH.md cho các điều kiện còn thiếu trước khi thực hiện. PWA dùng chung mã nguồn và tài khoản với web; không phải ứng dụng phát hành qua App Store/Google Play.

## Chạy ngay khi chưa có backend

```sh
npm ci
npm run dev
```

Mở `http://127.0.0.1:4173`. Nếu cổng này đang có ứng dụng khác, dùng `npm run dev -- --port 4180` và mở cổng tương ứng. Không dừng ứng dụng đang chạy chỉ để giải phóng cổng.

`VITE_BACKEND_ENABLED=false` giữ backend ở trạng thái chưa kết nối. Không gửi truy vấn đến project Supabase chưa thuộc quyền của nhóm. Không cần mật khẩu, service-role key hoặc tài khoản doanh nghiệp để xem giao diện công khai.

Bạn xem được trang chủ, bộ lọc, trạng thái chưa có creator, hướng dẫn quy trình, chính sách và màn hình **Cài BeautyHub** (`/install`). Đăng nhập, lưu creator, CRUD hồ sơ, booking và admin cần backend thật nên chưa hoạt động khi tắt kết nối. Không có dữ liệu mẫu trá hình hoặc công tắc giả lập vai trò trong sản phẩm.

## Chạy bản PWA đã build

```sh
npm run build
npm run preview -- --port 4180
```

Mở `http://127.0.0.1:4180/install`. Trên Chrome/Edge dùng menu cài ứng dụng nếu trình duyệt hỗ trợ. Trên iPhone/iPad dùng Safari → Chia sẻ → Thêm vào màn hình chính. Nút cài đặt tự động chỉ xuất hiện khi trình duyệt phát tín hiệu hỗ trợ, không phải lúc nào cũng hiện ngay.

Service worker chỉ được đăng ký ở bản build/preview; khi lập trình bằng `npm run dev` không dùng service worker để tránh giữ phiên bản mã cũ. PWA cần HTTPS khi đưa lên máy chủ; `localhost`/`127.0.0.1` được dùng để thử tại máy. Truy cập địa chỉ IP mạng LAN bằng HTTP có thể xem web nhưng không đáp ứng điều kiện service worker/cài PWA trên mọi thiết bị.

Khi mất mạng, mở trang sẽ hiện màn hình kết nối lại. Booking, thanh toán, địa chỉ và ảnh riêng tư không được đưa vào Cache Storage. Không xếp hàng gửi booking/thanh toán ngầm. Khi có bản cập nhật, ứng dụng báo để người dùng lưu biểu mẫu trước khi chủ động tải lại.

## Những phần đã lập trình

- Khách: khám phá/filter theo nhiều điều kiện, hồ sơ, gói/lịch, lưu creator, yêu cầu booking, theo dõi trạng thái, báo chuyển cọc, hỗ trợ, hủy và review.
- Creator: hồ sơ và vùng/phong cách phục vụ, gói dịch vụ, portfolio/upload/xóa ảnh, mở/đóng lịch, nhận/từ chối/hoàn thành booking.
- Admin: phân trang booking/ticket/users/audit; duyệt nội dung và creator; đối soát cọc, hủy/hoàn tiền, cọc chuyển muộn, cấu hình tiếp nhận booking.
- Thông báo trong ứng dụng, số chưa đọc, đánh dấu đã đọc; tự làm mới khi trang có mạng và đang hiển thị. Chưa có web push, email hay SMS tự động.
- PWA: manifest, icon/maskable/apple icon, hướng dẫn cài, điều hướng điện thoại, cập nhật chủ động, màn hình mất mạng, header cache/CSP cho Cloudflare/Vercel.

## Tự kiểm chứng khi trình bày với thầy cô

```sh
npm test
npm run test:e2e
npm run test:pwa
```

Lần đầu dùng Playwright chạy `npx playwright install chromium`. Trên Linux có thể cần `npx playwright install --with-deps chromium`.

- `npm test`: chạy PostgreSQL nhúng bằng các migration thật, kiểm tra phân quyền, booking/payment/review, bảo vệ dữ liệu, ảnh, idempotency và creator đã lưu.
- `npm run test:e2e`: Chromium desktop/mobile dùng HTTP fixture riêng để kiểm tra UI. Fixture chỉ nằm trong thư mục test; không phải backend sản phẩm.
- `npm run test:pwa`: kiểm tra bản production, manifest/icon, cache riêng tư, mất mạng, hướng dẫn cài và hành vi cài/cập nhật. Không gửi yêu cầu đến project Supabase cũ.

Không dùng kết quả các test này để nói đã chuyển khoản thật, đã chạy Supabase hosted hay đã phát hành ứng dụng trên cửa hàng.

## Khi nhóm có Supabase riêng

Giữ bước này cho sau theo yêu cầu hiện tại. Mã nguồn đã có `npm run db:bundle` để chuẩn bị SQL, **không tự chạy vào project**:

- `supabase/generated/install-new.sql`: chỉ cho database mới, trống; có guard từ chối database đã có `bookings`.
- `supabase/generated/upgrade-from-original.sql`: chỉ cho database đã có đúng hai migration gốc và chưa hardening; từ chối chạy lại nếu đã có cột `payment_reference`.
- Project đã có một phần migration khác: kiểm tra lịch sử và chạy từng migration còn thiếu. Không chạy bundle một cách suy đoán.

Thứ tự đầy đủ: `202610050001_beta.sql` → `202610050002_operations.sql` → `202610210001_hardening.sql` → `202610220001_audit.sql` → `202610220002_product.sql` → `202610230001_catalog.sql`.

Sau khi có project do nhóm sở hữu, cấu hình Google Auth/redirect, admin bằng UUID đã xác minh, Storage/Cron và các điều kiện nhận booking. Đặt URL và anon/publishable key của project đó rồi đổi `VITE_BACKEND_ENABLED=true`. Chỉ dùng `npm run check:backend` sau khi bật lại kết nối có chủ đích. Tuyệt đối không đặt service-role/secret vào biến `VITE_*`.

Muốn trình diễn đầy đủ có dữ liệu thật cần ít nhất hai tài khoản khách/creator và một admin; creator không được tự đặt booking của chính mình. Dùng ảnh có quyền sử dụng, phân biệt rõ cọc thử nghiệm và tiền thực. Hiện chưa nghiệm thu OAuth, Storage, Cron, tải đồng thời hoặc giao dịch ngân hàng trên Supabase hosted.

## Tài liệu kỹ thuật tham khảo

- [PWA installability — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [Service worker lifecycle/cache — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
