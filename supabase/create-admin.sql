-- ====================================================================
-- BeautyHub: Kích hoạt tài khoản và Cấp quyền ADMIN cho quản trị viên
-- Chạy đoạn SQL này trong: Supabase Dashboard -> SQL Editor -> Run
-- ====================================================================

-- 1. Xác nhận email ngay lập tức (không cần chờ gửi email xác thực)
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'admin@beautyhub.vn';

-- 2. Nâng quyền tài khoản lên ADMIN trong bảng public.profiles
UPDATE public.profiles
SET role = 'ADMIN', display_name = 'Admin BeautyHub'
WHERE id = 'cb663abb-6283-452c-afe1-9c53846c2c8b'::uuid;

-- 3. Kiểm tra lại kết quả đã nâng quyền thành công
SELECT id, display_name, role, created_at
FROM public.profiles
WHERE role = 'ADMIN';

