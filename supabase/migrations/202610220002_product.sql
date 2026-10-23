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
