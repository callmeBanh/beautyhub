-- ====================================================================
-- BeautyHub: TỔNG HỢP 1-CLICK THIẾT LẬP TOÀN BỘ MÔI TRƯỜNG LAUNCH
-- Chạy đoạn script này duy nhất 1 lần trong Supabase SQL Editor:
-- 1. Kích hoạt tài khoản Admin (admin@beautyhub.vn)
-- 2. Cài đặt chính sách hủy/hoàn, tài khoản ngân hàng và bật Ready
-- 3. Khởi tạo 2 Creator mẫu chuẩn bị nhận booking
-- ====================================================================

-- PHẦN 1: KÍCH HOẠT TÀI KHOẢN ADMIN
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'admin@beautyhub.vn';

UPDATE public.profiles
SET role = 'ADMIN', display_name = 'Admin BeautyHub'
WHERE id = 'cb663abb-6283-452c-afe1-9c53846c2c8b'::uuid;

-- PHẦN 2: THIẾT LẬP CẤU HÌNH & CHÍNH SÁCH
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

-- PHẦN 3: TẠO 2 CREATOR MẪU (PHOTOGRAPHER & MAKEUP ARTIST)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES 
(
  'a0000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated', 'minhanh.photo@beautyhub.vn', crypt('Creator@2026Pass!', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Minh Anh Photography"}'::jsonb, now(), now()
),
(
  'a0000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated', 'lanhuong.makeup@beautyhub.vn', crypt('Creator@2026Pass!', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lan Hương Makeup & Hair"}'::jsonb, now(), now()
) ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET display_name = 'Minh Anh Photography', phone = '0901234567', role = 'PROVIDER' WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.profiles SET display_name = 'Lan Hương Makeup & Hair', phone = '0909876543', role = 'PROVIDER' WHERE id = 'a0000000-0000-0000-0000-000000000002'::uuid;

INSERT INTO public.providers (id, owner_id, slug, name, category, bio, districts, styles, status)
VALUES 
(
  'b0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid,
  'minh-anh-photo', 'Minh Anh Photography', 'Photographer',
  'Nhiếp ảnh gia tự do với hơn 4 năm kinh nghiệm chụp chân dung cá nhân, lookbook thời trang và ảnh kỷ yếu tại TP.HCM. Bắt trọn những khoảnh khắc tự nhiên, cảm xúc và chân thật nhất.',
  ARRAY['Quận 1', 'Quận 3', 'Bình Thạnh', 'Thủ Đức'], ARRAY['Natural', 'Korean', 'Editorial', 'Cinematic'], 'APPROVED'
),
(
  'b0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid,
  'lan-huong-makeup', 'Lan Hương Makeup & Hair', 'Makeup Artist',
  'Chuyên viên trang điểm và tạo mẫu tóc chuyên nghiệp tại TP.HCM. Phong cách tự nhiên, trong trẻo chuẩn Hàn hoặc sắc sảo dự tiệc. Cam kết sử dụng 100% mỹ phẩm chính hãng cao cấp (NARS, MAC, Dior).',
  ARRAY['Quận 1', 'Quận 7', 'Phú Nhuận', 'Bình Thạnh'], ARRAY['Korean', 'Natural', 'Luxury', 'Party/Event'], 'APPROVED'
) ON CONFLICT (slug) DO UPDATE SET status = 'APPROVED';

INSERT INTO public.packages (id, provider_id, name, service, description, duration, price, delivery_days, includes, exclusions, active)
VALUES 
(
  'c0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid,
  'Gói Chân dung / Lookbook Ngoại cảnh', 'Personal',
  'Buổi chụp 90 phút tại các địa điểm ngoại cảnh đẹp ở Quận 1, Quận 3 hoặc quán cà phê theo concept yêu thích của bạn.',
  90, 850000, 5, '15 ảnh chỉnh sửa màu & da chuyên nghiệp, trả toàn bộ file gốc độ phân giải cao.',
  'Chi phí vé vào cổng / nước uống tại địa điểm chụp (nếu có).', true
),
(
  'c0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid,
  'Gói Ảnh Profile Doanh nghiệp / CV', 'Profile/CV',
  'Chụp ảnh chân dung nghề nghiệp chuyên nghiệp, phong thái tự tin, phục vụ hồ sơ LinkedIn, CV ứng tuyển hoặc website.',
  60, 500000, 3, '8 ảnh chỉnh sửa chuẩn chỉnh chu, tư vấn tạo dáng chuyên nghiệp.', 'Trang phục cá nhân tự chuẩn bị.', true
),
(
  'c0000000-0000-0000-0000-000000000003'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid,
  'Makeup & Làm tóc Dự tiệc / Sự kiện', 'Party/Event',
  'Layout makeup tiệc đêm hoặc sự kiện sang trọng, tôn đường nét khuôn mặt và giữ lớp nền bền đẹp suốt 8-12 tiếng.',
  60, 450000, 0, 'Trang điểm hoàn thiện, làm tóc kiểu, hỗ trợ dán mi giả và lens cao cấp.',
  'Phụ phí di chuyển nếu ngoài các quận trung tâm.', true
),
(
  'c0000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid,
  'Makeup Photoshoot & Đi theo dặm phấn', 'Photoshoot makeup',
  'Trang điểm concept chụp ảnh chuyên sâu, đi kèm dịch vụ theo sát buổi chụp để dặm lại lớp nền và đổi kiểu tóc.',
  90, 750000, 0, '2 layout trang điểm + làm tóc, đồng hành cùng khách hàng trong suốt buổi chụp 2 tiếng.',
  'Chi phí di chuyển liên tỉnh.', true
) ON CONFLICT (id) DO NOTHING;

-- Khung giờ trống cho 14 ngày tới
DO $$
DECLARE
  d date;
  p1 uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;
  p2 uuid := 'b0000000-0000-0000-0000-000000000002'::uuid;
BEGIN
  FOR i IN 1..14 LOOP
    d := (now() at time zone 'Asia/Ho_Chi_Minh')::date + i;
    INSERT INTO public.availability (provider_id, starts_at, ends_at)
    VALUES (p1, (d || ' 08:00:00+07')::timestamptz, (d || ' 12:00:00+07')::timestamptz) ON CONFLICT DO NOTHING;
    INSERT INTO public.availability (provider_id, starts_at, ends_at)
    VALUES (p1, (d || ' 13:30:00+07')::timestamptz, (d || ' 17:30:00+07')::timestamptz) ON CONFLICT DO NOTHING;
    INSERT INTO public.availability (provider_id, starts_at, ends_at)
    VALUES (p2, (d || ' 09:00:00+07')::timestamptz, (d || ' 12:30:00+07')::timestamptz) ON CONFLICT DO NOTHING;
    INSERT INTO public.availability (provider_id, starts_at, ends_at)
    VALUES (p2, (d || ' 14:00:00+07')::timestamptz, (d || ' 18:30:00+07')::timestamptz) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- KIỂM TRA TỔNG QUAN HỆ THỐNG
SELECT 'ADMIN ACTIVE' as status, id, display_name, role FROM public.profiles WHERE role = 'ADMIN'
UNION ALL
SELECT 'SETTINGS READY' as status, id::text::uuid, bank_name, ready::text FROM public.settings
UNION ALL
SELECT 'CREATOR APPROVED' as status, id, name, status FROM public.providers;

