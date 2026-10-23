-- ====================================================================
-- BeautyHub: Thiết lập cấu hình vận hành và chính sách mở cửa Beta
-- Chạy đoạn script này trong: Supabase Dashboard -> SQL Editor -> Run
-- ====================================================================

UPDATE public.settings
SET 
  bank_name = 'MBBank',
  bank_account = '0987654321',
  bank_holder = 'CONG TY BEAUTYHUB VIETNAM',
  support_url = 'https://zalo.me/beautyhub',
  cancellation_policy = '1. TIỀN CỌC VÀ XÁC NHẬN GIỮ LỊCH:
- Khách hàng thanh toán trước 30% giá trị gói dịch vụ làm tiền cọc để xác nhận giữ chỗ. Số tiền còn lại (70%) sẽ thanh toán trực tiếp cho Creator sau khi hoàn thành buổi dịch vụ.
- Sau khi Creator chấp nhận yêu cầu, khách hàng có tối đa 6 giờ để chuyển khoản cọc qua mã VietQR trên hệ thống. Quá thời hạn này, lịch hẹn sẽ tự động giải phóng.

2. CHÍNH SÁCH HỦY LỊCH BỞI KHÁCH HÀNG:
- Hủy trước 48 giờ so với giờ bắt đầu: Hoàn lại 100% tiền cọc hoặc bảo lưu lịch hẹn trong vòng 30 ngày.
- Hủy từ 24 giờ đến 48 giờ trước giờ bắt đầu: Hoàn lại 50% tiền cọc (50% còn lại hỗ trợ chi phí chuẩn bị của Creator).
- Hủy trong vòng 24 giờ trước giờ bắt đầu hoặc không đến (No-show): Tiền cọc không được hoàn lại nhằm bù đắp thời gian đã giữ độc quyền cho bạn.

3. TRƯỜNG HỢP CREATOR HỦY LỊCH HOẶC BẤT KHẢ KHÁNG:
- Nếu Creator hủy lịch: Khách hàng được hoàn trả 100% tiền cọc ngay lập tức và BeautyHub hỗ trợ kết nối Creator thay thế tương đương.
- Thời gian xử lý đối soát và hoàn tiền: Từ 1 đến 2 ngày làm việc qua tài khoản ngân hàng do khách hàng cung cấp.

4. KÊNH TIẾP NHẬN HỖ TRỢ:
- Mọi yêu cầu đổi lịch, phản ánh chất lượng hoặc giải quyết tranh chấp được thực hiện tại mục Hỗ trợ của booking hoặc qua Zalo/Hotline hỗ trợ chính thức của BeautyHub.',
  policy_version = 1,
  ready = true
WHERE id = true;

-- Kiểm tra kết quả cấu hình
SELECT id, bank_name, bank_account, bank_holder, ready, left(cancellation_policy, 60) as policy_preview
FROM public.settings;

