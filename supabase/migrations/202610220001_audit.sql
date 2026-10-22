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
