-- Generated; review on a separate class/staging project. Never includes users or payments.
begin;
do $$ begin
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='bookings') then
  raise exception 'Chưa có schema BeautyHub gốc. Dùng bản cài mới cho project riêng.';
 end if;
end $$;
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='payment_reference') then
  raise exception 'Hardening đã được áp dụng. Không chạy lại upgrade bundle; chỉ chạy từng migration còn thiếu.';
 end if;
end $$;

-- 202610210001_hardening.sql
-- Hardening: stop leaking operating data to anonymous users, unique money references, creator portfolio removal.
-- Contract change for FE: settings table is admin-only; everyone else calls public.public_settings().

-- 1. Settings: bank details are snapshotted into each booking, so only admin needs the raw table.
drop policy settings_read on public.settings;
create policy settings_admin_read on public.settings for select using(public.is_admin());
revoke select on public.settings from anon;
create function public.public_settings() returns table(ready boolean,support_url text,cancellation_policy text,policy_version integer) language sql stable security definer set search_path='' as $$
 select s.ready,s.support_url,s.cancellation_policy,s.policy_version from public.settings s where s.id;
$$;
revoke execute on function public.public_settings() from public;
grant execute on function public.public_settings() to anon,authenticated;

-- 2. Availability: only approved providers' hours are public; owner and admin see their own.
drop policy availability_read on public.availability;
create policy availability_read on public.availability for select using(exists(select 1 from public.providers p where p.id=provider_id and (p.status='APPROVED' or p.owner_id=auth.uid() or public.is_admin())));

-- 3. A bank transfer / refund reference can be consumed by only one booking.
alter table public.bookings add column payment_reference text, add column refund_reference text;
create unique index bookings_payment_reference on public.bookings(lower(trim(payment_reference))) where payment_reference is not null;
create unique index bookings_refund_reference on public.bookings(lower(trim(refund_reference))) where refund_reference is not null;

create or replace function public.booking_action(p_id uuid,p_action text,p_detail text default '') returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings; p public.providers; admin boolean; customer boolean; owner boolean;
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 if length(p_detail)>2000 then raise exception 'Nội dung quá dài.'; end if;
 select * into b from public.bookings where id=p_id for update;
 if b.id is null then raise exception 'Không tìm thấy booking.'; end if;
 select * into p from public.providers where id=b.provider_id;
 admin:=public.is_admin(); customer:=b.customer_id=auth.uid(); owner:=p.owner_id=auth.uid();
 if not(customer or owner or admin) then raise exception 'Bạn không có quyền thao tác booking này.'; end if;
 if b.status in ('REQUESTED','AWAITING_DEPOSIT') and b.hold_until<now() and p_action not in ('LATE_PAYMENT') then
  update public.bookings set status='EXPIRED',updated_at=now() where id=p_id;
  perform private.event(p_id,'EXPIRED','Hết thời hạn giữ lịch.'); return;
 end if;
 if p_action='ACCEPT' and owner and b.status='REQUESTED' then
  update public.bookings set status='AWAITING_DEPOSIT',hold_until=least(now()+interval '6 hours',b.starts_at-interval '6 hours') where id=p_id;
 elsif p_action='REJECT' and owner and b.status='REQUESTED' and length(trim(p_detail))>=5 then
  update public.bookings set status='REJECTED',hold_until=null where id=p_id;
 elsif p_action='REPORT_PAYMENT' and customer and b.status='AWAITING_DEPOSIT' and length(trim(p_detail))>=6 then
  update public.bookings set status='PAYMENT_REVIEW',payment_status='REPORTED',transfer_reference=p_detail,hold_until=null where id=p_id;
 elsif p_action='VERIFY_PAYMENT' and admin and b.status='PAYMENT_REVIEW' and length(trim(p_detail))>=6 then
  if exists(select 1 from public.bookings where id<>p_id and lower(trim(payment_reference))=lower(trim(p_detail))) then raise exception 'Mã giao dịch này đã được dùng cho booking khác.'; end if;
  update public.bookings set status='CONFIRMED',payment_status='PAID',payment_reference=trim(p_detail),hold_until=null where id=p_id;
 elsif p_action='PAYMENT_NOT_FOUND' and admin and b.status='PAYMENT_REVIEW' and length(trim(p_detail))>=5 then
  update public.bookings set status='AWAITING_DEPOSIT',payment_status='UNPAID',hold_until=least(now()+interval '6 hours',b.starts_at-interval '1 hour') where id=p_id;
 elsif p_action='CANCEL' and customer and b.status in ('REQUESTED','AWAITING_DEPOSIT') and b.payment_status='UNPAID' then
  update public.bookings set status='CANCELLED',hold_until=null where id=p_id;
 elsif p_action='COMPLETE' and owner and b.status='CONFIRMED' and b.ends_at<=now() then
  update public.bookings set status='COMPLETED' where id=p_id;
 else raise exception 'Thao tác không hợp lệ hoặc cần bổ sung lý do. Hãy tải lại booking.';
 end if;
 update public.bookings set updated_at=now() where id=p_id;
 perform private.event(p_id,p_action,p_detail);
 if admin then insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),p_action,p_id,p_detail); end if;
end $$;

create or replace function public.confirm_refund(p_id uuid,p_reference text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or length(trim(p_reference))<6 then raise exception 'Cần admin và mã giao dịch hoàn tiền.'; end if;
 if exists(select 1 from public.bookings where id<>p_id and lower(trim(refund_reference))=lower(trim(p_reference))) then raise exception 'Mã giao dịch hoàn tiền này đã được dùng cho booking khác.'; end if;
 update public.bookings set payment_status='REFUNDED',refund_reference=trim(p_reference),updated_at=now() where id=p_id and payment_status='REFUND_PENDING';
 if not found then raise exception 'Không có khoản hoàn chờ xử lý.'; end if;
 perform private.event(p_id,'REFUNDED',p_reference);
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),'REFUNDED',p_id,p_reference);
end $$;

-- 4. Creator can remove own portfolio image. FE must then delete the Storage object (policy below).
create function public.remove_portfolio(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare pid uuid; st text; a public.portfolio_assets;
begin
 select id,status into pid,st from public.providers where owner_id=auth.uid() for update;
 select * into a from public.portfolio_assets where id=p_id and provider_id=pid;
 if a.id is null then raise exception 'Không có quyền xóa ảnh này.'; end if;
 if st in ('PENDING','APPROVED') and (select count(*) from public.portfolio_assets where provider_id=pid)<=3 then raise exception 'Hồ sơ đang gửi duyệt/hoạt động cần giữ tối thiểu 3 ảnh.'; end if;
 delete from public.portfolio_assets where id=p_id;
 return a.path;
end $$;
revoke execute on function public.remove_portfolio(uuid) from public;
grant execute on function public.remove_portfolio(uuid) to authenticated;
-- Only orphaned objects (no portfolio row) in the caller's own folder can be deleted.
create policy portfolio_delete_orphan on storage.objects for delete to authenticated using(bucket_id='portfolio' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.portfolio_assets a where a.path=storage.objects.name));


-- 202610220001_audit.sql
-- Incremental audit fixes; apply after 202610050002_operations.sql.
-- Public review projections must never expose booking/customer identifiers.
drop policy reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (
 author_id=auth.uid() or public.is_admin() or (not hidden and public.can_read_booking(booking_id))
);
create function public.provider_reviews() returns table(
 id uuid, provider_id uuid, author_name text, rating numeric, text text,
 hidden boolean, created_at timestamptz
) language sql stable security definer set search_path='' as $$
 select r.id,r.provider_id,r.author_name,r.rating,r.text,r.hidden,r.created_at
 from public.reviews r join public.providers p on p.id=r.provider_id
 where not r.hidden and p.status='APPROVED';
$$;
revoke all on function public.provider_reviews() from public;
grant execute on function public.provider_reviews() to anon,authenticated;

-- A late deposit must be refunded without reviving an expired/cancelled slot.
-- This beta tracks exactly the quoted deposit; mismatched transfers need manual reconciliation.
create function public.reconcile_late_deposit(p_id uuid,p_reference text) returns void
language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 if not public.is_admin() then raise exception 'Chỉ admin được đối soát cọc chuyển muộn.'; end if;
 if p_reference is null or length(trim(p_reference)) not between 6 and 2000 then raise exception 'Cần mã giao dịch tiền thực nhận.'; end if;
 select * into b from public.bookings where id=p_id for update;
 if b.id is null or b.status not in ('EXPIRED','CANCELLED','REJECTED') or b.payment_status<>'UNPAID' then raise exception 'Chỉ đối soát một lần cho booking đã kết thúc và chưa ghi nhận tiền.'; end if;
 update public.bookings set payment_status='REFUND_PENDING',refund_amount=deposit,transfer_reference=p_reference,updated_at=now() where id=p_id;
 perform private.event(p_id,'LATE_DEPOSIT','Đã đối soát cọc chuyển muộn; chờ hoàn tiền.');
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),'LATE_DEPOSIT',p_id,p_reference);
end $$;
revoke all on function public.reconcile_late_deposit(uuid,text) from public,anon;
grant execute on function public.reconcile_late_deposit(uuid,text) to authenticated;

create or replace function public.save_provider(p_slug text,p_name text,p_category text,p_bio text,p_districts text[],p_styles text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 if p_styles is null or p_districts is null or array_position(p_styles,null) is not null or array_position(p_districts,null) is not null or cardinality(p_styles) not between 2 and 4 or cardinality(p_districts) not between 1 and 20 then raise exception 'Chọn khu vực và từ 2 đến 4 phong cách.'; end if;
 insert into public.providers(owner_id,slug,name,category,bio,districts,styles) values(auth.uid(),p_slug,p_name,p_category,p_bio,p_districts,p_styles)
 on conflict(owner_id) do update set slug=excluded.slug,name=excluded.name,category=excluded.category,bio=excluded.bio,districts=excluded.districts,styles=excluded.styles,status=case when public.providers.status='SUSPENDED' then 'SUSPENDED' else 'DRAFT' end returning id into pid;
 update public.profiles set role='PROVIDER' where id=auth.uid() and role='CUSTOMER';
 return pid;
end $$;

create or replace function public.resolve_support(p_id uuid,p_resolution text,p_cancel boolean default false,p_refund integer default 0) returns void language plpgsql security definer set search_path='' as $$
declare r public.support_requests; b public.bookings;
begin
 if not public.is_admin() then raise exception 'Chỉ admin được xử lý hỗ trợ.'; end if;
 if p_resolution is null or length(trim(p_resolution)) not between 10 and 2000 or p_cancel is null then raise exception 'Cần ghi rõ kết quả xử lý.'; end if;
 select * into r from public.support_requests where id=p_id and status='OPEN' for update;
 if r.id is null then raise exception 'Yêu cầu đã được xử lý.'; end if;
 select * into b from public.bookings where id=r.booking_id for update;
 if p_refund is null or p_refund<0 or p_refund>b.deposit then raise exception 'Số tiền hoàn không hợp lệ.'; end if;
 if p_refund>0 and (not p_cancel or b.payment_status<>'PAID') then raise exception 'Chỉ tạo khoản hoàn khi hủy booking đã đối soát tiền.'; end if;
 if p_cancel and (b.status in ('CANCELLED','REJECTED','EXPIRED') or b.payment_status in ('REFUND_PENDING','REFUNDED')) then raise exception 'Booking đã kết thúc hoặc đã xử lý hoàn tiền. Không được ghi đè khoản hoàn.'; end if;
 if p_cancel and b.payment_status='REPORTED' then raise exception 'Cần đối soát giao dịch đã báo trước khi hủy hoặc hoàn tiền.'; end if;
 if p_cancel then
  update public.bookings set status='CANCELLED',hold_until=null,refund_amount=case when payment_status='PAID' then p_refund else null end,
  payment_status=case when payment_status='PAID' and p_refund>0 then 'REFUND_PENDING' else payment_status end,updated_at=now() where id=b.id;
 end if;
 update public.support_requests set status='RESOLVED',resolution=p_resolution,assigned_to=auth.uid() where id=p_id;
 perform private.event(b.id,'SUPPORT_RESOLVED',p_resolution);
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),'SUPPORT_RESOLVED',p_id,p_resolution);
end $$;

create or replace function public.confirm_refund(p_id uuid,p_reference text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or p_reference is null or length(trim(p_reference)) not between 6 and 2000 then raise exception 'Cần admin và mã giao dịch hoàn tiền.'; end if;
 update public.bookings set payment_status='REFUNDED',updated_at=now() where id=p_id and payment_status='REFUND_PENDING';
 if not found then raise exception 'Không có khoản hoàn chờ xử lý.'; end if;
 perform private.event(p_id,'REFUNDED',p_reference);
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),'REFUNDED',p_id,p_reference);
end $$;

create or replace function public.save_settings(p_bank text,p_account text,p_holder text,p_support text,p_policy text,p_ready boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Chỉ admin được cấu hình.'; end if;
 if p_ready is null or p_bank is null or p_account is null or p_holder is null or p_support is null or p_policy is null then raise exception 'Thông tin cấu hình không được để null.'; end if;
 if p_ready and (length(trim(p_bank))<2 or length(trim(p_account))<5 or length(trim(p_holder))<2 or p_support !~ '^https://' or length(trim(p_policy))<100) then raise exception 'Cần tài khoản nhận tiền, kênh hỗ trợ HTTPS và chính sách đầy đủ trước khi mở booking.'; end if;
 update public.settings set bank_name=p_bank,bank_account=p_account,bank_holder=p_holder,support_url=p_support,cancellation_policy=p_policy,policy_version=policy_version+1,ready=p_ready where id;
 insert into public.audit_log(actor_id,action,detail) values(auth.uid(),'SETTINGS_UPDATED','Cập nhật thông tin vận hành.');
end $$;

create or replace function public.booking_action(p_id uuid,p_action text,p_detail text default '') returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings; p public.providers; admin boolean; customer boolean; owner boolean;
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 if p_detail is null or length(p_detail)>2000 then raise exception 'Nội dung quá dài.'; end if;
 select * into b from public.bookings where id=p_id for update;
 if b.id is null then raise exception 'Không tìm thấy booking.'; end if;
 select * into p from public.providers where id=b.provider_id;
 admin:=public.is_admin(); customer:=b.customer_id=auth.uid(); owner:=p.owner_id=auth.uid();
 if not(customer or owner or admin) then raise exception 'Bạn không có quyền thao tác booking này.'; end if;
 if b.status in ('REQUESTED','AWAITING_DEPOSIT') and b.hold_until<now() and p_action not in ('LATE_PAYMENT') then
  update public.bookings set status='EXPIRED',updated_at=now() where id=p_id;
  perform private.event(p_id,'EXPIRED','Hết thời hạn giữ lịch.'); return;
 end if;
 if p_action='ACCEPT' and owner and b.status='REQUESTED' then
  update public.bookings set status='AWAITING_DEPOSIT',hold_until=least(now()+interval '6 hours',b.starts_at-interval '6 hours') where id=p_id;
 elsif p_action='REJECT' and owner and b.status='REQUESTED' and length(trim(p_detail))>=5 then
  update public.bookings set status='REJECTED',hold_until=null where id=p_id;
 elsif p_action='REPORT_PAYMENT' and customer and b.status='AWAITING_DEPOSIT' and length(trim(p_detail))>=6 then
  update public.bookings set status='PAYMENT_REVIEW',payment_status='REPORTED',transfer_reference=p_detail,hold_until=null where id=p_id;
 elsif p_action='VERIFY_PAYMENT' and admin and b.status='PAYMENT_REVIEW' and length(trim(p_detail))>=6 then
  update public.bookings set status='CONFIRMED',payment_status='PAID',hold_until=null where id=p_id;
 elsif p_action='PAYMENT_NOT_FOUND' and admin and b.status='PAYMENT_REVIEW' and length(trim(p_detail))>=5 then
  update public.bookings set status='AWAITING_DEPOSIT',payment_status='UNPAID',hold_until=least(now()+interval '6 hours',b.starts_at-interval '1 hour') where id=p_id;
 elsif p_action='CANCEL' and customer and b.status in ('REQUESTED','AWAITING_DEPOSIT') and b.payment_status='UNPAID' then
  update public.bookings set status='CANCELLED',hold_until=null where id=p_id;
 elsif p_action='COMPLETE' and owner and b.status='CONFIRMED' and b.ends_at<=now() then
  update public.bookings set status='COMPLETED' where id=p_id;
 else raise exception 'Thao tác không hợp lệ hoặc cần bổ sung lý do. Hãy tải lại booking.';
 end if;
 update public.bookings set updated_at=now() where id=p_id;
 perform private.event(p_id,p_action,p_detail);
 if admin then insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),p_action,p_id,p_detail); end if;
end $$;


-- 202610220002_product.sql
-- Combined product invariants after hardening and audit. No demo data.
create or replace function public.booking_action(p_id uuid,p_action text,p_detail text default '') returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings; p public.providers; admin boolean; customer boolean; owner boolean;
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 if p_detail is null or length(p_detail)>2000 then raise exception 'Nội dung quá dài.'; end if;
 select * into b from public.bookings where id=p_id for update;
 if b.id is null then raise exception 'Không tìm thấy booking.'; end if;
 select * into p from public.providers where id=b.provider_id;
 admin:=public.is_admin(); customer:=b.customer_id=auth.uid(); owner:=p.owner_id=auth.uid();
 if not(customer or owner or admin) then raise exception 'Bạn không có quyền thao tác booking này.'; end if;
 if b.status in ('REQUESTED','AWAITING_DEPOSIT') and b.hold_until<now() and p_action not in ('LATE_PAYMENT') then
  update public.bookings set status='EXPIRED',updated_at=now() where id=p_id;
  perform private.event(p_id,'EXPIRED','Hết thời hạn giữ lịch.'); return;
 end if;
 if p_action='ACCEPT' and owner and b.status='REQUESTED' then
  update public.bookings set status='AWAITING_DEPOSIT',hold_until=least(now()+interval '6 hours',b.starts_at-interval '6 hours') where id=p_id;
 elsif p_action='REJECT' and owner and b.status='REQUESTED' and length(trim(p_detail))>=5 then
  update public.bookings set status='REJECTED',hold_until=null where id=p_id;
 elsif p_action='REPORT_PAYMENT' and customer and b.status='AWAITING_DEPOSIT' and length(trim(p_detail))>=6 then
  update public.bookings set status='PAYMENT_REVIEW',payment_status='REPORTED',transfer_reference=p_detail,hold_until=null where id=p_id;
 elsif p_action='VERIFY_PAYMENT' and admin and b.status='PAYMENT_REVIEW' and length(trim(p_detail))>=6 then
  if length(trim(p_detail))>120 then raise exception 'Chỉ nhập mã giao dịch ngân hàng, tối đa 120 ký tự.'; end if;
  if exists(select 1 from public.bookings where id<>p_id and lower(trim(payment_reference))=lower(trim(p_detail))) then raise exception 'Mã giao dịch này đã được dùng cho booking khác.'; end if;
  update public.bookings set status='CONFIRMED',payment_status='PAID',payment_reference=trim(p_detail),hold_until=null where id=p_id;
 elsif p_action='PAYMENT_NOT_FOUND' and admin and b.status='PAYMENT_REVIEW' and length(trim(p_detail))>=5 then
  update public.bookings set status='AWAITING_DEPOSIT',payment_status='UNPAID',hold_until=least(now()+interval '6 hours',b.starts_at-interval '1 hour') where id=p_id;
 elsif p_action='CANCEL' and customer and b.status in ('REQUESTED','AWAITING_DEPOSIT') and b.payment_status='UNPAID' then
  update public.bookings set status='CANCELLED',hold_until=null where id=p_id;
 elsif p_action='COMPLETE' and owner and b.status='CONFIRMED' and b.ends_at<=now() then
  update public.bookings set status='COMPLETED' where id=p_id;
 else raise exception 'Thao tác không hợp lệ hoặc cần bổ sung lý do. Hãy tải lại booking.';
 end if;
 update public.bookings set updated_at=now() where id=p_id;
 perform private.event(p_id,p_action,p_detail);
 if admin then insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),p_action,p_id,p_detail); end if;
end $$;

-- Saved creators are private to the account; the browser cannot bypass RPC limits.
create table public.provider_favorites (
 user_id uuid not null references public.profiles(id) on delete cascade,
 provider_id uuid not null references public.providers(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,provider_id)
);
alter table public.provider_favorites enable row level security;
create policy favorites_read on public.provider_favorites for select to authenticated using(user_id=auth.uid());
revoke all on public.provider_favorites from anon,authenticated;
grant select on public.provider_favorites to authenticated;
create function public.set_favorite(p_provider uuid,p_saved boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập để lưu creator.'; end if;
 if p_saved is null then raise exception 'Lựa chọn lưu creator không hợp lệ.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,4));
 if not p_saved then
  delete from public.provider_favorites where user_id=auth.uid() and provider_id=p_provider;
  return;
 end if;
 if not exists(select 1 from public.providers where id=p_provider and status='APPROVED') then raise exception 'Creator chưa khả dụng.'; end if;
 if exists(select 1 from public.provider_favorites where user_id=auth.uid() and provider_id=p_provider) then return; end if;
 if (select count(*) from public.provider_favorites where user_id=auth.uid())>=100 then raise exception 'Bạn đã lưu 100 creator. Hãy bỏ lưu một người trước khi thêm.'; end if;
 insert into public.provider_favorites(user_id,provider_id) values(auth.uid(),p_provider);
end $$;
revoke all on function public.set_favorite(uuid,boolean) from public,anon;
grant execute on function public.set_favorite(uuid,boolean) to authenticated;

create function public.product_health() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('schema_version','202610220002','product','BeautyHub');
$$;
revoke all on function public.product_health() from public;
grant execute on function public.product_health() to anon,authenticated;

create or replace function public.confirm_refund(p_id uuid,p_reference text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or p_reference is null or length(trim(p_reference)) not between 6 and 120 then raise exception 'Cần admin và mã giao dịch hoàn tiền.'; end if;
 if exists(select 1 from public.bookings where id<>p_id and lower(trim(refund_reference))=lower(trim(p_reference))) then raise exception 'Mã giao dịch hoàn tiền này đã được dùng cho booking khác.'; end if;
 update public.bookings set payment_status='REFUNDED',refund_reference=trim(p_reference),updated_at=now() where id=p_id and payment_status='REFUND_PENDING';
 if not found then raise exception 'Không có khoản hoàn chờ xử lý.'; end if;
 perform private.event(p_id,'REFUNDED',p_reference);
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),'REFUNDED',p_id,p_reference);
end $$;

create or replace function public.reconcile_late_deposit(p_id uuid,p_reference text) returns void
language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 if not public.is_admin() then raise exception 'Chỉ admin được đối soát cọc chuyển muộn.'; end if;
 if p_reference is null or length(trim(p_reference)) not between 6 and 120 then raise exception 'Cần mã giao dịch tiền thực nhận, tối đa 120 ký tự.'; end if;
 select * into b from public.bookings where id=p_id for update;
 if b.id is null or b.status not in ('EXPIRED','CANCELLED','REJECTED') or b.payment_status<>'UNPAID' then raise exception 'Chỉ đối soát một lần cho booking đã kết thúc và chưa ghi nhận tiền.'; end if;
 if exists(select 1 from public.bookings where lower(trim(payment_reference))=lower(trim(p_reference))) then raise exception 'Mã giao dịch này đã được dùng cho booking khác.'; end if;
 update public.bookings set payment_status='REFUND_PENDING',refund_amount=deposit,payment_reference=trim(p_reference),transfer_reference=trim(p_reference),updated_at=now() where id=p_id;
 perform private.event(p_id,'LATE_DEPOSIT','Đã đối soát cọc chuyển muộn; chờ hoàn tiền.');
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),'LATE_DEPOSIT',p_id,p_reference);
end $$;


-- 202610230001_catalog.sql
-- Bounded public catalog. Only approved public content leaves these definers.
create index providers_catalog on public.providers(created_at desc,id) where status='APPROVED';
create index packages_catalog on public.packages(provider_id,price) where active;
create index reviews_catalog on public.reviews(provider_id,created_at desc,id) where not hidden;

create function private.public_provider(p_id uuid,p_detail boolean default false) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',p.id,'slug',p.slug,'name',p.name,'category',p.category,'bio',p.bio,
  'districts',p.districts,'styles',p.styles,'status',p.status,
  'packages',coalesce((select jsonb_agg(to_jsonb(k) order by k.price,k.id) from public.packages k where k.provider_id=p.id and k.active),'[]'::jsonb),
  'portfolio_assets',coalesce((select jsonb_agg(to_jsonb(a)) from (
    select a.id,a.provider_id,a.path,a.caption,a.approved from public.portfolio_assets a
    where a.provider_id=p.id and a.approved order by a.created_at,a.id limit case when p_detail then 12 else 1 end
  ) a),'[]'::jsonb),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from (
    select r.id,r.provider_id,r.author_name,r.rating,r.text,r.hidden,r.created_at from public.reviews r
    where p_detail and r.provider_id=p.id and not r.hidden order by r.created_at desc,r.id limit 20
  ) r),'[]'::jsonb),
  'review_count',(select count(*) from public.reviews r where r.provider_id=p.id and not r.hidden),
  'rating_average',(select coalesce(avg(r.rating),0) from public.reviews r where r.provider_id=p.id and not r.hidden),
  'completed_count',(select count(*) from public.bookings b where b.provider_id=p.id and b.status='COMPLETED')
 ) from public.providers p where p.id=p_id and p.status='APPROVED';
$$;
revoke all on function private.public_provider(uuid,boolean) from public,anon,authenticated;

create function public.provider_catalog(p_filters jsonb default '{}',p_page integer default 1,p_size integer default 12,p_saved boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; q text; budget integer; day date; ordering text;
begin
 if p_filters is null or jsonb_typeof(p_filters)<>'object' or p_page is null or p_page not between 1 and 10000 or p_size is null or p_size not between 1 and 24 or p_saved is null then
  raise exception 'Bộ lọc hoặc trang không hợp lệ.';
 end if;
 q:=coalesce(p_filters->>'query',''); ordering:=coalesce(p_filters->>'sort','recommended');
 if length(p_filters::text)>2000 or length(q)>100 or ordering not in ('recommended','price','rating') then raise exception 'Bộ lọc không hợp lệ.'; end if;
 budget:=coalesce(nullif(p_filters->>'budget','')::integer,100000000);
 if budget not between 0 and 100000000 then raise exception 'Ngân sách không hợp lệ.'; end if;
 day:=nullif(p_filters->>'date','')::date;
 if day is not null and (day<(now() at time zone 'Asia/Ho_Chi_Minh')::date or day>(now() at time zone 'Asia/Ho_Chi_Minh')::date+89) then raise exception 'Ngày ngoài thời gian nhận lịch.'; end if;
 if p_saved and auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 with matching as materialized (
  select p.id,p.created_at,
   (select min(k.price) from public.packages k where k.provider_id=p.id and k.active) min_price,
   (select coalesce(avg(r.rating),0) from public.reviews r where r.provider_id=p.id and not r.hidden) rating
  from public.providers p where p.status='APPROVED'
   and (q='' or strpos(lower(p.name),lower(q))>0)
   and (coalesce(p_filters->>'category','')='' or p.category=p_filters->>'category')
   and (coalesce(p_filters->>'district','')='' or p_filters->>'district'=any(p.districts))
   and (coalesce(p_filters->>'style','')='' or p_filters->>'style'=any(p.styles))
   and (not p_saved or exists(select 1 from public.provider_favorites f where f.user_id=auth.uid() and f.provider_id=p.id))
   and exists(select 1 from public.packages k where k.provider_id=p.id and k.active and k.price<=budget
    and (coalesce(p_filters->>'service','')='' or k.service=p_filters->>'service')
    and (day is null or exists(select 1 from public.free_slots(k.id,day))))
 ), page as (
  select m.id,row_number() over(order by
   case when ordering='price' then m.min_price end asc,
   case when ordering='rating' then m.rating end desc,m.created_at desc,m.id) position
  from matching m order by position limit p_size offset (p_page-1)*p_size
 ) select jsonb_build_object('total',(select count(*) from matching),'page',p_page,'size',p_size,
  'items',coalesce((select jsonb_agg(private.public_provider(page.id) order by page.position) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.provider_catalog(jsonb,integer,integer,boolean) from public;
grant execute on function public.provider_catalog(jsonb,integer,integer,boolean) to anon,authenticated;

create function public.provider_detail(p_slug text default null,p_package uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare pid uuid;
begin
 if (p_slug is null)=(p_package is null) or length(p_slug)>61 then raise exception 'Chọn một hồ sơ hoặc gói dịch vụ.'; end if;
 select p.id into pid from public.providers p where p.status='APPROVED'
  and (p_slug is null or p.slug=p_slug)
  and (p_package is null or exists(select 1 from public.packages k where k.id=p_package and k.provider_id=p.id and k.active));
 return private.public_provider(pid,true);
end $$;
revoke all on function public.provider_detail(text,uuid) from public;
grant execute on function public.provider_detail(text,uuid) to anon,authenticated;

create or replace function public.product_health() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('schema_version','202610230001');
$$;


commit;
