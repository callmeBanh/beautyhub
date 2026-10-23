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
