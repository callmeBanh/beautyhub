-- ====================================================================
-- BeautyHub: Khởi tạo 2 Creator mẫu chuẩn bị mở bán (Seed Data)
-- Chạy script này trong: Supabase Dashboard -> SQL Editor -> Run
-- ====================================================================

-- 1. Tạo tài khoản User cho Creator 1: Minh Anh Photography
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated',
  'minhanh.photo@beautyhub.vn',
  crypt('Creator@2026Pass!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Minh Anh Photography"}'::jsonb,
  now(), now()
) ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET display_name = 'Minh Anh Photography', phone = '0901234567', role = 'PROVIDER'
WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid;

-- Tạo thông tin Creator 1
INSERT INTO public.providers (id, owner_id, slug, name, category, bio, districts, styles, status)
VALUES (
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'minh-anh-photo',
  'Minh Anh Photography',
  'Photographer',
  'Nhiếp ảnh gia tự do với hơn 4 năm kinh nghiệm chụp chân dung cá nhân, lookbook thời trang và ảnh kỷ yếu tại TP.HCM. Bắt trọn những khoảnh khắc tự nhiên, cảm xúc và chân thật nhất.',
  ARRAY['Quận 1', 'Quận 3', 'Bình Thạnh', 'Thủ Đức'],
  ARRAY['Natural', 'Korean', 'Editorial', 'Cinematic'],
  'APPROVED'
) ON CONFLICT (slug) DO UPDATE
SET status = 'APPROVED';

-- Gói dịch vụ cho Creator 1
INSERT INTO public.packages (id, provider_id, name, service, description, duration, price, delivery_days, includes, exclusions, active)
VALUES 
(
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'Gói Chân dung / Lookbook Ngoại cảnh',
  'Personal',
  'Buổi chụp 90 phút tại các địa điểm ngoại cảnh đẹp ở Quận 1, Quận 3 hoặc quán cà phê theo concept yêu thích của bạn.',
  90,
  850000,
  5,
  '15 ảnh chỉnh sửa màu & da chuyên nghiệp, trả toàn bộ file gốc độ phân giải cao.',
  'Chi phí vé vào cổng / nước uống tại địa điểm chụp (nếu có).',
  true
),
(
  'c0000000-0000-0000-0000-000000000002'::uuid,
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'Gói Ảnh Profile Doanh nghiệp / CV',
  'Profile/CV',
  'Chụp ảnh chân dung nghề nghiệp chuyên nghiệp, phong thái tự tin, phục vụ hồ sơ LinkedIn, CV ứng tuyển hoặc website.',
  60,
  500000,
  3,
  '8 ảnh chỉnh sửa chuẩn chỉnh chu, tư vấn tạo dáng chuyên nghiệp.',
  'Trang phục cá nhân tự chuẩn bị.',
  true
) ON CONFLICT (id) DO NOTHING;

-- 2. Tạo tài khoản User cho Creator 2: Lan Hương Makeup
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated',
  'lanhuong.makeup@beautyhub.vn',
  crypt('Creator@2026Pass!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Lan Hương Makeup & Hair"}'::jsonb,
  now(), now()
) ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET display_name = 'Lan Hương Makeup & Hair', phone = '0909876543', role = 'PROVIDER'
WHERE id = 'a0000000-0000-0000-0000-000000000002'::uuid;

-- Tạo thông tin Creator 2
INSERT INTO public.providers (id, owner_id, slug, name, category, bio, districts, styles, status)
VALUES (
  'b0000000-0000-0000-0000-000000000002'::uuid,
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'lan-huong-makeup',
  'Lan Hương Makeup & Hair',
  'Makeup Artist',
  'Chuyên viên trang điểm và tạo mẫu tóc chuyên nghiệp tại TP.HCM. Phong cách tự nhiên, trong trẻo chuẩn Hàn hoặc sắc sảo dự tiệc. Cam kết sử dụng 100% mỹ phẩm chính hãng cao cấp (NARS, MAC, Dior).',
  ARRAY['Quận 1', 'Quận 7', 'Phú Nhuận', 'Bình Thạnh'],
  ARRAY['Korean', 'Natural', 'Luxury', 'Party/Event'],
  'APPROVED'
) ON CONFLICT (slug) DO UPDATE
SET status = 'APPROVED';

-- Gói dịch vụ cho Creator 2
INSERT INTO public.packages (id, provider_id, name, service, description, duration, price, delivery_days, includes, exclusions, active)
VALUES 
(
  'c0000000-0000-0000-0000-000000000003'::uuid,
  'b0000000-0000-0000-0000-000000000002'::uuid,
  'Makeup & Làm tóc Dự tiệc / Sự kiện',
  'Party/Event',
  'Layout makeup tiệc đêm hoặc sự kiện sang trọng, tôn đường nét khuôn mặt và giữ lớp nền bền đẹp suốt 8-12 tiếng.',
  60,
  450000,
  0,
  'Trang điểm hoàn thiện, làm tóc kiểu, hỗ trợ dán mi giả và lens cao cấp.',
  'Phụ phí di chuyển nếu ngoài các quận trung tâm.',
  true
),
(
  'c0000000-0000-0000-0000-000000000004'::uuid,
  'b0000000-0000-0000-0000-000000000002'::uuid,
  'Makeup Photoshoot & Đi theo dặm phấn',
  'Photoshoot makeup',
  'Trang điểm concept chụp ảnh chuyên sâu, đi kèm dịch vụ theo sát buổi chụp để dặm lại lớp nền và đổi kiểu tóc.',
  90,
  750000,
  0,
  '2 layout trang điểm + làm tóc, đồng hành cùng khách hàng trong suốt buổi chụp 2 tiếng.',
  'Chi phí di chuyển liên tỉnh.',
  true
) ON CONFLICT (id) DO NOTHING;

-- 3. Tạo khung giờ trống (Availability) cho cả 2 Creator trong 14 ngày tới
DO $$
DECLARE
  d date;
  p1 uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;
  p2 uuid := 'b0000000-0000-0000-0000-000000000002'::uuid;
BEGIN
  FOR i IN 1..14 LOOP
    d := (now() at time zone 'Asia/Ho_Chi_Minh')::date + i;
    
    -- Ca sáng Creator 1 (8:00 - 12:00)
    INSERT INTO public.availability (provider_id, starts_at, ends_at)
    VALUES (p1, (d || ' 08:00:00+07')::timestamptz, (d || ' 12:00:00+07')::timestamptz)
    ON CONFLICT DO NOTHING;

    -- Ca chiều Creator 1 (13:30 - 17:30)
    INSERT INTO public.availability (provider_id, starts_at, ends_at)
    VALUES (p1, (d || ' 13:30:00+07')::timestamptz, (d || ' 17:30:00+07')::timestamptz)
    ON CONFLICT DO NOTHING;

    -- Ca sáng Creator 2 (9:00 - 12:30)
    INSERT INTO public.availability (provider_id, starts_at, ends_at)
    VALUES (p2, (d || ' 09:00:00+07')::timestamptz, (d || ' 12:30:00+07')::timestamptz)
    ON CONFLICT DO NOTHING;

    -- Ca chiều Creator 2 (14:00 - 18:30)
    INSERT INTO public.availability (provider_id, starts_at, ends_at)
    VALUES (p2, (d || ' 14:00:00+07')::timestamptz, (d || ' 18:30:00+07')::timestamptz)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Kiểm tra kết quả
SELECT p.name, p.category, p.status, count(pk.id) as package_count
FROM public.providers p
LEFT JOIN public.packages pk ON pk.provider_id = p.id
GROUP BY p.id, p.name, p.category, p.status;

