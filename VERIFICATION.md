# Kiểm tra Web + PWA — 23/10/2026

Phạm vi: sản phẩm môn Trải nghiệm khởi nghiệp, web responsive và PWA dùng chung tài khoản/mã nguồn. Làm tại `D:\beautyHub\beautyhub`, branch `feat/web-pwa-completion`. Các chỉnh sửa cục bộ trước phiên làm việc được giữ tại commit `a4fd457`, sau đó tích hợp branch audit cũ. Không commit trực tiếp lên `main`.

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

- `npm test`: 39/39 đạt (4 domain, 35 PostgreSQL/RLS).
- `npm run typecheck`: kiểm tra mã nguồn, database tests và cấu hình Playwright.
- `npm run test:e2e`: 22/22 đạt trên Chromium, desktop 1440×1000 và mobile 390×844. Kết quả CI được theo dõi riêng trên PR.
- `npm run test:pwa`: 8/8 đạt trên production desktop/mobile. Bao gồm manifest/icon, axe ở trang cài và trang ngoại tuyến, cache không chứa dữ liệu riêng tư, offline/reconnect, yêu cầu cài chỉ sau thao tác người dùng và cập nhật chờ người dùng chọn. Browser install/update prompt dùng fixture sự kiện; worker/cache và offline được thử thực tế trong Chromium.
- Build chạy tạo icon → TypeScript → Vite → service worker. Build có backend bật có thể báo kích thước chunk SDK lớn; admin/studio/booking đã tách tải theo route. Đây chưa phải đo Core Web Vitals hoặc kiểm thử mạng/thiết bị thật.

Luồng SQL dùng migration thật trong PGlite, chỉ mô phỏng schema Auth/Storage. Có test discovery → request → accept → report → verify → complete → review; dịch thời gian kết thúc fixture về quá khứ bằng quyền quản trị. Các trường hợp phụ gồm quyền actor, snapshot, overlap, key retry, hủy/hoàn lặp, báo sai giao dịch, cọc muộn không chiếm lại lịch, mã giao dịch trùng, ảnh private, moderation và favorites riêng tư.

Test UI dùng HTTP fixture riêng, không thực thi RLS hoặc xác nhận tiền thật. Các tài khoản/creator giả chỉ dùng trong test, không được seed vào project ngoài.

## Chưa kiểm chứng và giới hạn

- Chưa chạy OAuth/Auth/PostgREST/Storage/Cron hosted, nhiều kết nối đồng thời, backup/restore, ngân hàng hoặc deploy production trong phiên này. Không tuyên bố sản phẩm đã mở bán.
- Chưa thử cài PWA trên thiết bị iOS/Android thật; hỗ trợ và menu cài phụ thuộc trình duyệt. Không có bản App Store/Google Play.
- PWA ngoại tuyến là màn hình hướng dẫn kết nối lại, không cung cấp lịch cá nhân hoặc giao dịch offline. Không có thông báo đẩy, email/SMS hoặc chat tự động.
- DB chặn mã giao dịch trùng sau chuẩn hóa chữ hoa/thường và khoảng trắng đầu/cuối; người nhập hai chuỗi khác nhau cho cùng một giao dịch thực tế vẫn cần đối soát thủ công. Chưa có sổ ngân hàng/gateway/escrow/payout.
- Danh sách creator vẫn tải tập trung; quy mô lớn cần phân trang/tìm kiếm phía server và load test. Kiểm tra axe trên fixture không phải chứng nhận đầy đủ về accessibility.
- Khi có Supabase riêng, áp dụng đủ 5 migration theo thứ tự trong README/CLASSROOM_GUIDE, cấu hình Google và URL callback, xác minh admin, Storage và Cron. Không chạy bundle lên database chưa xác định trạng thái. Đặt `VITE_BACKEND_ENABLED=true` có chủ đích rồi kiểm tra lại toàn bộ luồng thật.

Hướng dẫn chạy, cài và trình bày: [CLASSROOM_GUIDE.md](CLASSROOM_GUIDE.md). Các checklist về dữ liệu/thanh toán thương mại trong README là tài liệu cho giai đoạn sau, không phải yêu cầu triển khai doanh nghiệp trong phạm vi môn học.
