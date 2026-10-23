# Kiểm tra Web + PWA và chuẩn bị ra mắt — 23/10/2026

Mục tiêu mới: mở khách công khai và thu cọc thật. Sản phẩm vẫn là web responsive và PWA dùng chung tài khoản/mã nguồn; chưa đạt nghiệm thu production khi thiếu backend và kiểm chứng tiền thật. Điều kiện cụ thể tại [MARKET_LAUNCH.md](MARKET_LAUNCH.md). Làm tại `D:\beautyHub\beautyhub`, branch `feat/web-pwa-completion`. Các chỉnh sửa cục bộ trước phiên làm việc được giữ tại commit `a4fd457`, sau đó tích hợp branch audit cũ. Không commit trực tiếp lên `main`.

## Trạng thái backend

Theo yêu cầu mới nhất, Supabase để sau vì người dùng chưa sở hữu project. `.env` tại máy đã đặt `VITE_BACKEND_ENABLED=false`; URL/key cũ được giữ trong file riêng không commit, không in ra báo cáo. Không chạy migration, cấu hình OAuth, cấp admin hoặc ghi dữ liệu vào project đó. Bản build bàn giao đã được tạo với backend tắt. Smoke test xác nhận không có yêu cầu Supabase, nút Google bị vô hiệu hóa, URL/key cũ không nằm trong JavaScript xuất ra.

Không có dữ liệu mẫu hoặc nút đổi vai trò giả trong sản phẩm. Fixture chỉ nằm trong bộ test. Khi backend tắt, chỉ các trang công khai, trạng thái chờ dữ liệu và phần cài PWA hoạt động; đăng nhập, lưu creator, CRUD và booking thật chờ kết nối project riêng sau này.

## Thay đổi sản phẩm

| Nhóm | Nội dung |
| --- | --- |
| PWA | Manifest, icon 192/512, maskable/apple icon, shortcut, hướng dẫn Android/iOS/desktop; service worker production có version theo nội dung build |
| Mất mạng/cập nhật | Màn hình kết nối lại; chỉ precache tài nguyên giao diện công khai theo allowlist; không cache API/OAuth/signed URL/booking; không gửi thao tác ngầm; người dùng chủ động chọn cập nhật sau khi lưu biểu mẫu |
| Điện thoại | Điều hướng dưới, vùng an toàn màn hình, vị trí thông báo nổi tránh thanh điều hướng, vùng chạm, input 16px |
| Khám phá/hồ sơ | Lưu/bỏ lưu creator, danh sách riêng của tài khoản; tiêu đề/description cơ bản theo hồ sơ, giữ bộ lọc trong URL |
| Creator | Giữ và tích hợp quản lý hồ sơ/gói/lịch, upload/xóa portfolio; loading và lỗi rõ hơn; không đóng modal khi đang lưu |
| Admin | Giữ phân trang 25 dòng cho các danh sách; không cắt cứng hàng đợi ở 500 booking; tải riêng booking cần xử lý ticket; có số tổng và retry |
| Thông báo | Badge số chưa đọc, đánh dấu đã đọc; làm mới khi có mạng và trang hiển thị, không phải web push |
| Biểu mẫu/accessibility | Nhãn `htmlFor`/ID và hint `aria-describedby`, hỗ trợ textarea có nội dung; trạng thái nút điều hướng, tương phản, focus/modal và kiểm tra axe |
| Bảo mật/dữ liệu | Giữ RLS review công khai không lộ UUID khách/booking; lưu creator có RLS riêng và giới hạn 100; kết hợp hardening/audit mà không mất ràng buộc mã nhận cọc/hoàn tiền; chặn ký tự điều khiển trong đường quay lại OAuth |
| Deploy | CSP/header cho Cloudflare/Vercel, service worker không bị cache lâu, assets có hash immutable; tải các khu vực booking/studio/admin theo nhu cầu; công cụ chuẩn bị SQL và kiểm tra backend có guard tắt kết nối |

## Kiểm thử

- `npm test`: 48/48 đạt (4 domain, 41 PostgreSQL/RLS, 3 cấu hình ra mắt).
- `npm run typecheck`: kiểm tra mã nguồn, database tests và cấu hình Playwright.
- `npm run test:e2e`: 30/30 đạt trên Chromium, desktop 1440×1000 và mobile 390×844. Kết quả CI được theo dõi riêng trên PR.
- `npm run test:pwa`: 8/8 đạt trên production desktop/mobile. Bao gồm manifest/icon, axe ở trang cài và trang ngoại tuyến, cache không chứa dữ liệu riêng tư, offline/reconnect, yêu cầu cài chỉ sau thao tác người dùng và cập nhật chờ người dùng chọn. Browser install/update prompt dùng fixture sự kiện; worker/cache và offline được thử thực tế trong Chromium.
- Build chạy tạo icon → TypeScript → Vite → service worker. Build có backend bật có thể báo kích thước chunk SDK lớn; admin/studio/booking đã tách tải theo route. Đây chưa phải đo Core Web Vitals hoặc kiểm thử mạng/thiết bị thật.

Luồng SQL dùng migration thật trong PGlite, chỉ mô phỏng schema Auth/Storage. Có test discovery → request → accept → report → verify → complete → review; dịch thời gian kết thúc fixture về quá khứ bằng quyền quản trị. Các trường hợp phụ gồm quyền actor, snapshot, overlap, key retry, hủy/hoàn lặp, báo sai giao dịch, cọc muộn không chiếm lại lịch, mã giao dịch trùng, ảnh private, moderation và favorites riêng tư.

Test UI dùng HTTP fixture riêng, không thực thi RLS hoặc xác nhận tiền thật. Các tài khoản/creator giả chỉ dùng trong test, không được seed vào project ngoài.

## Chưa kiểm chứng và giới hạn

- Chưa chạy OAuth/Auth/PostgREST/Storage/Cron hosted, nhiều kết nối đồng thời, backup/restore, ngân hàng hoặc deploy production trong phiên này. Không tuyên bố sản phẩm đã mở bán.
- Chưa thử cài PWA trên thiết bị iOS/Android thật; hỗ trợ và menu cài phụ thuộc trình duyệt. Không có bản App Store/Google Play.
- PWA ngoại tuyến là màn hình hướng dẫn kết nối lại, không cung cấp lịch cá nhân hoặc giao dịch offline. Không có thông báo đẩy, email/SMS hoặc chat tự động.
- DB chặn mã giao dịch trùng sau chuẩn hóa chữ hoa/thường và khoảng trắng đầu/cuối; người nhập hai chuỗi khác nhau cho cùng một giao dịch thực tế vẫn cần đối soát thủ công. Chưa có sổ ngân hàng/gateway/escrow/payout.
- Catalog công khai, creator đã lưu và hồ sơ admin đã phân trang phía server, chỉ ký URL ảnh cho trang cần hiển thị. Chưa chạy load test trên hosted Supabase. Kiểm tra axe trên fixture không phải chứng nhận đầy đủ về accessibility.
- Khi có Supabase riêng, áp dụng đủ 6 migration theo thứ tự trong README/CLASSROOM_GUIDE, cấu hình Google và URL callback, xác minh admin, Storage và Cron. Không chạy bundle lên database chưa xác định trạng thái. Đặt `VITE_BACKEND_ENABLED=true` có chủ đích rồi kiểm tra lại toàn bộ luồng thật.

Hướng dẫn chạy, cài và trình bày: [CLASSROOM_GUIDE.md](CLASSROOM_GUIDE.md). Vì mục tiêu đã đổi sang khách công khai/tiền thật, checklist tại MARKET_LAUNCH phải được thực hiện và lưu bằng chứng trước khi mở nhận booking. Bản môn học vẫn giữ backend tắt.

## Đợt chuẩn bị ra mắt công khai

- Thêm migration `202610230001_catalog.sql`; schema health mới `202610230001`. Catalog lọc và phân trang tại DB, kiểm tra lịch trong một RPC, không gửi fan-out theo từng gói từ trình duyệt. RPC public chỉ trả dữ liệu đã duyệt; card không trả toàn bộ đánh giá/owner_id, chỉ một ảnh và số tổng hợp. API detail theo slug/package riêng, không phụ thuộc hồ sơ có trong bốn creator ở trang chủ hay không.
- Giữ quy trình creator/admin bằng dữ liệu private có RLS. Hồ sơ admin phân trang 25 dòng, giới hạn 20 đánh giá gần nhất/hồ sơ; danh sách yêu thích phân trang riêng theo đúng tài khoản. Rating/tổng review được tính trên mọi review công khai, không chỉ mẫu 20 review hiển thị.
- Test SQL mới: 28 creator qua ba trang không trùng, điều kiện lọc kết hợp và ngày có/không còn slot, quyền saved khác tài khoản, deep link gói ẩn, projection không lộ author_id/booking_id, review ẩn không tham gia điểm/tổng; 21 review công khai nhưng payload detail tối đa 20.
- Test web mới: 29 creator qua các trang, đổi lọc/sort về trang đầu, không gọi free_slots trên explore, deep link creator/package ngoài trang chủ, giữ bộ lọc và ẩn kết quả cũ khi lỗi rồi retry. Chạy desktop/mobile; fixture chỉ kiểm tra hợp đồng giao diện.
- Thêm `check:release` và `build:public`; Vite chặn mode `public` nếu cấu hình thiếu. Thông tin vận hành/riêng tư/thời hạn lưu cấu hình công khai tại trang chính sách. Không coi việc nhập giá trị hoặc check PASS là xác minh quyền sở hữu hay khả năng hoạt động của dịch vụ.
- `check:release` tại máy hiện trả lỗi như dự kiến vì backend tắt và thông tin ra mắt chưa được cung cấp. `check:backend` thoát trước network. Không thay đổi `.env` để tự bật project cũ; bản build bàn giao vẫn backend tắt.
- Có một lần Vitest trong sandbox không đọc được file cache tạm của Vite; chạy lại ngoài sandbox đạt 48/48. Không sửa test để bỏ qua lỗi nghiệp vụ. Các thử nghiệm trình duyệt cũng chạy ngoài sandbox, chỉ gọi HTTP fixture ở máy.

Chưa có chuyển khoản/hoàn tiền thật, Google OAuth hosted, scheduler/backup/restore, kiểm thử tải lớn, thiết bị iOS/Android thật hoặc deploy production. Không có gateway tự động hay thông báo email/SMS/push. Dữ liệu về thời hạn lưu do người vận hành cấu hình; chưa có tác vụ tự xóa toàn bộ tài khoản/giao dịch theo chính sách đó.

Audit thư viện runtime ngày 23/10/2026: `npm audit --omit=dev --audit-level=moderate` báo 0 lỗ hổng đã biết. Kết quả này không thay thế kiểm toán mã hoặc đánh giá hosted production.
