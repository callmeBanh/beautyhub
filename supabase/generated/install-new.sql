-- Generated; review on a separate class/staging project. Never includes users or payments.
begin;
do $$ begin
 if exists(select 1 from information_schema.tables where table_schema='public' and table_name='bookings') then
  raise exception 'Database đã có bảng bookings. Không dùng bản cài mới; kiểm tra migration hiện có trước.';
 end if;
end $$;

-- 202610050001_beta.sql
-- BeautyHub: run once on a new Supabase project. No demo users or payments.
create schema if not exists private;
create extension if not exists btree_gist with schema extensions;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default '', phone text not null default '',
 role text not null default 'CUSTOMER' check(role in ('CUSTOMER','PROVIDER','ADMIN')),
 created_at timestamptz not null default now()
);
create function private.new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),100));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_user();
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='ADMIN');
$$;

create table public.providers (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references public.profiles,
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
 name text not null check(length(name) between 2 and 100), category text not null check(category in ('Photographer','Makeup Artist')),
 bio text not null default '' check(length(bio)<=2000), districts text[] not null default '{}', styles text[] not null default '{}',
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING','APPROVED','REJECTED','SUSPENDED')),
 created_at timestamptz not null default now()
);
create table public.packages (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.providers,
 name text not null check(length(name) between 2 and 100), service text not null,
 description text not null check(length(description) between 10 and 2000),
 duration integer not null check(duration between 30 and 480), price integer not null check(price between 100000 and 100000000),
 delivery_days integer not null default 7 check(delivery_days between 0 and 60),
 includes text not null default '', exclusions text not null default '', active boolean not null default true
);
create table public.portfolio_assets (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.providers,
 path text not null unique, caption text not null default '' check(length(caption)<=200),
 approved boolean not null default false, created_at timestamptz not null default now()
);
create table public.availability (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.providers,
 starts_at timestamptz not null, ends_at timestamptz not null, check(ends_at>starts_at),
 exclude using gist(provider_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
);
create table public.settings (
 id boolean primary key default true check(id), bank_name text not null default '', bank_account text not null default '',
 bank_holder text not null default '', support_url text not null default '',
 cancellation_policy text not null default '', policy_version integer not null default 1,
 ready boolean not null default false
);
insert into public.settings(id) values(true);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles,
 provider_id uuid not null references public.providers, package_id uuid not null references public.packages,
 request_key uuid not null, snapshot jsonb not null, customer_name text not null, phone text not null,
 district text not null, address text not null, notes text not null default '',
 starts_at timestamptz not null, ends_at timestamptz not null, check(ends_at>starts_at),
 price integer not null check(price>0), deposit integer not null check(deposit>0 and deposit<=price),
 status text not null default 'REQUESTED' check(status in ('REQUESTED','AWAITING_DEPOSIT','PAYMENT_REVIEW','CONFIRMED','COMPLETED','CANCELLED','REJECTED','EXPIRED')),
 payment_status text not null default 'UNPAID' check(payment_status in ('UNPAID','REPORTED','PAID','REFUND_PENDING','REFUNDED')),
 hold_until timestamptz, transfer_reference text, refund_amount integer check(refund_amount>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(customer_id,request_key),
 exclude using gist(provider_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
 where(status in ('REQUESTED','AWAITING_DEPOSIT','PAYMENT_REVIEW','CONFIRMED'))
);
create index bookings_customer on public.bookings(customer_id,created_at desc);
create index bookings_provider on public.bookings(provider_id,starts_at);
create table public.booking_events (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings,
 actor_id uuid references public.profiles, action text not null, detail text not null default '', created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 booking_id uuid references public.bookings, text text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.support_requests (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings,
 author_id uuid not null references public.profiles, kind text not null check(kind in ('CANCEL','RESCHEDULE','DISPUTE','HELP')),
 message text not null check(length(message) between 10 and 2000),
 status text not null default 'OPEN' check(status in ('OPEN','RESOLVED')),
 resolution text, assigned_to uuid references public.profiles, created_at timestamptz not null default now()
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings,
 provider_id uuid not null references public.providers, author_id uuid not null references public.profiles,
 author_name text not null, quality integer not null check(quality between 1 and 5),
 communication integer not null check(communication between 1 and 5), punctuality integer not null check(punctuality between 1 and 5),
 accuracy integer not null check(accuracy between 1 and 5),
 rating numeric generated always as ((quality+communication+punctuality+accuracy)::numeric/4) stored,
 text text not null check(length(text) between 10 and 2000), hidden boolean not null default false, created_at timestamptz not null default now()
);
create table public.audit_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles,
 action text not null, target_id uuid, detail text not null, created_at timestamptz not null default now()
);
create table public.analytics_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles,
 event text not null check(event in ('search','provider_view','package_view','booking_started','booking_submitted')),
 created_at timestamptz not null default now()
);

-- Browser tables are SELECT-only. All changes pass through checked functions.
alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.packages enable row level security;
alter table public.portfolio_assets enable row level security;
alter table public.availability enable row level security;
alter table public.settings enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.notifications enable row level security;
alter table public.support_requests enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_log enable row level security;
alter table public.analytics_events enable row level security;
create policy profiles_read on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy providers_read on public.providers for select using(status='APPROVED' or owner_id=auth.uid() or public.is_admin());
create policy packages_read on public.packages for select using(exists(select 1 from public.providers p where p.id=provider_id and (p.status='APPROVED' or p.owner_id=auth.uid() or public.is_admin())));
create policy portfolio_read on public.portfolio_assets for select using((approved and exists(select 1 from public.providers p where p.id=provider_id and p.status='APPROVED')) or exists(select 1 from public.providers p where p.id=provider_id and p.owner_id=auth.uid()) or public.is_admin());
create policy availability_read on public.availability for select using(exists(select 1 from public.providers p where p.id=provider_id));
create policy settings_read on public.settings for select using(true);
create function public.can_read_booking(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bookings b join public.providers p on p.id=b.provider_id where b.id=p_id and (b.customer_id=auth.uid() or p.owner_id=auth.uid() or public.is_admin()));
$$;
create policy bookings_read on public.bookings for select using(public.can_read_booking(id));
create policy events_read on public.booking_events for select using(public.can_read_booking(booking_id));
create policy notifications_read on public.notifications for select using(user_id=auth.uid());
create policy support_read on public.support_requests for select using(author_id=auth.uid() or public.is_admin());
create policy reviews_read on public.reviews for select using(not hidden or author_id=auth.uid() or public.is_admin());
create policy audit_read on public.audit_log for select using(public.is_admin());
create policy analytics_read on public.analytics_events for select using(public.is_admin());
revoke all on all tables in schema public from anon,authenticated;
grant select on public.providers,public.packages,public.portfolio_assets,public.availability,public.settings,public.reviews to anon,authenticated;
grant select on public.profiles,public.bookings,public.booking_events,public.notifications,public.support_requests,public.audit_log,public.analytics_events to authenticated;

create function private.event(p_booking uuid,p_action text,p_detail text default '') returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings; owner uuid;
begin
 select * into b from public.bookings where id=p_booking;
 select owner_id into owner from public.providers where id=b.provider_id;
 insert into public.booking_events(booking_id,actor_id,action,detail) values(p_booking,auth.uid(),p_action,p_detail);
 insert into public.notifications(user_id,booking_id,text) values(b.customer_id,p_booking,p_action),(owner,p_booking,p_action);
end $$;
create function private.expire_holds(p_provider uuid) returns void language plpgsql security definer set search_path='' as $$
declare b record;
begin
 for b in update public.bookings set status='EXPIRED',updated_at=now() where provider_id=p_provider and status in ('REQUESTED','AWAITING_DEPOSIT') and hold_until<now() returning id loop
  perform private.event(b.id,'EXPIRED','Hết thời hạn giữ lịch.');
 end loop;
end $$;
create function public.free_slots(p_package uuid,p_day date) returns table(starts_at timestamptz,ends_at timestamptz) language sql stable security definer set search_path='' as $$
 select s.t,s.t+make_interval(mins=>pk.duration) from public.packages pk
 join public.providers p on p.id=pk.provider_id and p.status='APPROVED'
 join public.availability a on a.provider_id=p.id
 cross join lateral generate_series(a.starts_at,a.ends_at-make_interval(mins=>pk.duration),interval '30 minutes') as s(t)
 where pk.id=p_package and pk.active and (s.t at time zone 'Asia/Ho_Chi_Minh')::date=p_day
 and s.t>=now()+interval '24 hours' and s.t<now()+interval '90 days'
 and not exists(select 1 from public.bookings b where b.provider_id=p.id
  and (b.status in ('PAYMENT_REVIEW','CONFIRMED') or (b.status in ('REQUESTED','AWAITING_DEPOSIT') and b.hold_until>now()))
  and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(s.t,s.t+make_interval(mins=>pk.duration),'[)')) order by s.t;
$$;
create function public.create_booking(p_package uuid,p_start timestamptz,p_name text,p_phone text,p_district text,p_address text,p_notes text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare pk public.packages; p public.providers; cfg public.settings; bid uuid; finish timestamptz;
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 -- Serializes retries per customer before checking the idempotency key.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into bid from public.bookings where customer_id=auth.uid() and request_key=p_key;
 if bid is not null then return bid; end if;
 select * into cfg from public.settings where id;
 if not cfg.ready then raise exception 'BeautyHub chưa mở nhận booking. Vui lòng quay lại sau.'; end if;
 select * into pk from public.packages where id=p_package and active for share;
 if pk.id is null then raise exception 'Gói dịch vụ không còn khả dụng.'; end if;
 select * into p from public.providers where id=pk.provider_id for update;
 if p.status<>'APPROVED' or p.owner_id=auth.uid() then raise exception 'Không thể đặt creator này.'; end if;
 perform private.expire_holds(p.id);
 if p_name is null or length(trim(p_name)) not between 2 and 100 or p_phone is null or p_phone !~ '^\+?[0-9]{9,15}$' or p_address is null or length(trim(p_address)) not between 10 and 500 or p_notes is null or length(p_notes)>2000 or p_district is null or not(p_district=any(p.districts)) or p_key is null then raise exception 'Thông tin liên hệ hoặc địa điểm chưa hợp lệ.'; end if;
 if (select count(*) from public.bookings where customer_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau.'; end if;
 if not exists(select 1 from public.free_slots(p_package,(p_start at time zone 'Asia/Ho_Chi_Minh')::date) f where f.starts_at=p_start) then raise exception 'Khung giờ không còn trống. Vui lòng chọn lại.'; end if;
 finish:=p_start+make_interval(mins=>pk.duration);
 insert into public.bookings(customer_id,provider_id,package_id,request_key,snapshot,customer_name,phone,district,address,notes,starts_at,ends_at,price,deposit,hold_until)
 values(auth.uid(),p.id,pk.id,p_key,jsonb_build_object('provider_name',p.name,'package',to_jsonb(pk),'policy',cfg.cancellation_policy,'policy_version',cfg.policy_version,'bank_name',cfg.bank_name,'bank_account',cfg.bank_account,'bank_holder',cfg.bank_holder),trim(p_name),p_phone,p_district,trim(p_address),p_notes,p_start,finish,pk.price,ceil(pk.price*0.3),least(now()+interval '12 hours',p_start-interval '12 hours')) returning id into bid;
 perform private.event(bid,'REQUESTED','Đã gửi yêu cầu. Creator phản hồi trong 12 giờ.');
 return bid;
exception when exclusion_violation then raise exception 'Khung giờ vừa có người đặt. Vui lòng chọn lại.';
end $$;

create function public.booking_action(p_id uuid,p_action text,p_detail text default '') returns void language plpgsql security definer set search_path='' as $$
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
create function public.request_support(p_booking uuid,p_kind text,p_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if auth.uid() is null or not public.can_read_booking(p_booking) then raise exception 'Không có quyền truy cập.'; end if;
 if (select count(*) from public.support_requests where author_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Vui lòng chờ bộ phận hỗ trợ phản hồi.'; end if;
 insert into public.support_requests(booking_id,author_id,kind,message) values(p_booking,auth.uid(),p_kind,trim(p_message)) returning id into rid;
 insert into public.notifications(user_id,booking_id,text) select id,p_booking,'SUPPORT_REQUEST' from public.profiles where role='ADMIN';
 perform private.event(p_booking,'SUPPORT_REQUEST',p_message);
 return rid;
end $$;
create function public.resolve_support(p_id uuid,p_resolution text,p_cancel boolean default false,p_refund integer default 0) returns void language plpgsql security definer set search_path='' as $$
declare r public.support_requests; b public.bookings;
begin
 if not public.is_admin() then raise exception 'Chỉ admin được xử lý hỗ trợ.'; end if;
 if length(trim(p_resolution))<10 then raise exception 'Cần ghi rõ kết quả xử lý.'; end if;
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
create function public.confirm_refund(p_id uuid,p_reference text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or length(trim(p_reference))<6 then raise exception 'Cần admin và mã giao dịch hoàn tiền.'; end if;
 update public.bookings set payment_status='REFUNDED',updated_at=now() where id=p_id and payment_status='REFUND_PENDING';
 if not found then raise exception 'Không có khoản hoàn chờ xử lý.'; end if;
 perform private.event(p_id,'REFUNDED',p_reference);
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),'REFUNDED',p_id,p_reference);
end $$;
create function public.submit_review(p_booking uuid,p_quality integer,p_communication integer,p_punctuality integer,p_accuracy integer,p_text text) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=p_booking and customer_id=auth.uid() and status='COMPLETED';
 if b.id is null then raise exception 'Chỉ khách của booking hoàn thành được đánh giá.'; end if;
 insert into public.reviews(booking_id,provider_id,author_id,author_name,quality,communication,punctuality,accuracy,text)
 values(b.id,b.provider_id,auth.uid(),split_part(b.customer_name,' ',1),p_quality,p_communication,p_punctuality,p_accuracy,trim(p_text));
 perform private.event(b.id,'REVIEWED','Khách đã gửi đánh giá.');
end $$;
create function public.booking_contact(p_id uuid) returns text language sql stable security definer set search_path='' as $$
 select pr.phone from public.bookings b join public.providers p on p.id=b.provider_id join public.profiles pr on pr.id=p.owner_id
 where b.id=p_id and public.can_read_booking(p_id) and b.status in ('CONFIRMED','COMPLETED');
$$;
create function public.mark_notifications_read() returns void language sql security definer set search_path='' as $$
 update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null;
$$;

create function public.save_profile(p_name text,p_phone text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or length(trim(p_name)) not between 2 and 100 or p_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Họ tên hoặc số điện thoại chưa hợp lệ.'; end if;
 update public.profiles set display_name=trim(p_name),phone=p_phone where id=auth.uid();
end $$;
create function public.save_provider(p_slug text,p_name text,p_category text,p_bio text,p_districts text[],p_styles text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 if cardinality(p_styles) not between 2 and 4 or cardinality(p_districts)<1 then raise exception 'Chọn khu vực và từ 2 đến 4 phong cách.'; end if;
 insert into public.providers(owner_id,slug,name,category,bio,districts,styles) values(auth.uid(),p_slug,p_name,p_category,p_bio,p_districts,p_styles)
 on conflict(owner_id) do update set slug=excluded.slug,name=excluded.name,category=excluded.category,bio=excluded.bio,districts=excluded.districts,styles=excluded.styles,status=case when public.providers.status='SUSPENDED' then 'SUSPENDED' else 'DRAFT' end returning id into pid;
 update public.profiles set role='PROVIDER' where id=auth.uid() and role='CUSTOMER';
 return pid;
end $$;
create function public.save_package(p_id uuid,p_name text,p_service text,p_description text,p_duration integer,p_price integer,p_days integer,p_includes text,p_exclusions text,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid; result uuid;
begin
 select id into pid from public.providers where owner_id=auth.uid();
 if pid is null then raise exception 'Hãy tạo hồ sơ creator trước.'; end if;
 if p_id is not null then
  update public.packages set name=p_name,service=p_service,description=p_description,duration=p_duration,price=p_price,delivery_days=p_days,includes=p_includes,exclusions=p_exclusions,active=p_active where id=p_id and provider_id=pid returning id into result;
  if result is null then raise exception 'Không có quyền sửa gói này.'; end if;
 else
  if (select count(*) from public.packages where provider_id=pid)>=10 then raise exception 'Tối đa 10 gói dịch vụ.'; end if;
  insert into public.packages(provider_id,name,service,description,duration,price,delivery_days,includes,exclusions,active) values(pid,p_name,p_service,p_description,p_duration,p_price,p_days,p_includes,p_exclusions,p_active) returning id into result;
 end if;
 return result;
end $$;
create function public.add_availability(p_start timestamptz,p_end timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 select id into pid from public.providers where owner_id=auth.uid() for update;
 if pid is null or p_start<now() or p_end<=p_start or p_end-p_start>interval '16 hours' or p_end>now()+interval '91 days' then raise exception 'Khoảng giờ chưa hợp lệ; chỉ mở lịch trong 90 ngày tới.'; end if;
 insert into public.availability(provider_id,starts_at,ends_at) values(pid,p_start,p_end);
exception when exclusion_violation then raise exception 'Khoảng giờ trùng với lịch đã mở.';
end $$;
create function public.remove_availability(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare pid uuid; a public.availability;
begin
 select id into pid from public.providers where owner_id=auth.uid() for update;
 select * into a from public.availability where id=p_id and provider_id=pid;
 if a.id is null then raise exception 'Không có quyền sửa lịch.'; end if;
 delete from public.availability where id=p_id;
 -- Existing bookings remain valid and cannot be silently cancelled by closing hours.
end $$;
create function public.add_portfolio(p_path text,p_caption text) returns void language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 select id into pid from public.providers where owner_id=auth.uid() for update;
 if pid is null or split_part(p_path,'/',1)<>auth.uid()::text then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
 if (select count(*) from public.portfolio_assets where provider_id=pid)>=12 then raise exception 'Tối đa 12 ảnh mỗi creator.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='portfolio' and name=p_path) then raise exception 'Chưa tải ảnh lên.'; end if;
 insert into public.portfolio_assets(provider_id,path,caption) values(pid,p_path,p_caption);
end $$;
create function public.submit_provider() returns void language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 select id into pid from public.providers where owner_id=auth.uid() and status in ('DRAFT','REJECTED') for update;
 if pid is null then raise exception 'Hồ sơ chưa thể gửi duyệt.'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and length(phone)>=9)
 or not exists(select 1 from public.packages where provider_id=pid and active)
 or (select count(*) from public.portfolio_assets where provider_id=pid)<3
 or not exists(select 1 from public.availability where provider_id=pid and starts_at>now()) then raise exception 'Cần số điện thoại, gói dịch vụ, ít nhất 3 ảnh và lịch trống trước khi gửi duyệt.'; end if;
 update public.providers set status='PENDING' where id=pid;
end $$;
create function public.moderate_provider(p_id uuid,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or p_status not in ('APPROVED','REJECTED','SUSPENDED') or length(trim(p_reason))<5 then raise exception 'Không có quyền hoặc thiếu lý do duyệt.'; end if;
 if p_status='APPROVED' and (select count(*) from public.portfolio_assets where provider_id=p_id)<3 then raise exception 'Cần kiểm tra ít nhất 3 ảnh thật.'; end if;
 update public.providers set status=p_status where id=p_id;
 update public.portfolio_assets set approved=(p_status='APPROVED') where provider_id=p_id;
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),p_status,p_id,p_reason);
 insert into public.notifications(user_id,text) select owner_id,'Hồ sơ: '||p_status||'. '||p_reason from public.providers where id=p_id;
end $$;
create function public.moderate_content(p_id uuid,p_kind text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() or length(trim(p_reason))<5 then raise exception 'Cần admin và lý do kiểm duyệt.'; end if;
 if p_kind='review' then update public.reviews set hidden=true where id=p_id;
 elsif p_kind='portfolio' then update public.portfolio_assets set approved=false where id=p_id;
 else raise exception 'Loại nội dung không hợp lệ.'; end if;
 insert into public.audit_log(actor_id,action,target_id,detail) values(auth.uid(),'HIDE_'||p_kind,p_id,p_reason);
end $$;
create function public.save_settings(p_bank text,p_account text,p_holder text,p_support text,p_policy text,p_ready boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Chỉ admin được cấu hình.'; end if;
 if p_ready and (length(trim(p_bank))<2 or length(trim(p_account))<5 or length(trim(p_holder))<2 or p_support !~ '^https://' or length(trim(p_policy))<100) then raise exception 'Cần tài khoản nhận tiền, kênh hỗ trợ HTTPS và chính sách đầy đủ trước khi mở booking.'; end if;
 update public.settings set bank_name=p_bank,bank_account=p_account,bank_holder=p_holder,support_url=p_support,cancellation_policy=p_policy,policy_version=policy_version+1,ready=p_ready where id;
 insert into public.audit_log(actor_id,action,detail) values(auth.uid(),'SETTINGS_UPDATED','Cập nhật thông tin vận hành.');
end $$;

-- Private originals. Signed URLs can only be requested for approved assets or by the owner/admin.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portfolio','portfolio',false,524288,array['image/webp','image/jpeg','image/png']) on conflict(id) do nothing;
create function public.can_upload_portfolio(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and split_part(p_name,'/',1)=auth.uid()::text
 and exists(select 1 from public.providers where owner_id=auth.uid())
 and (select count(*) from storage.objects o where o.bucket_id='portfolio' and split_part(o.name,'/',1)=auth.uid()::text)<12;
$$;
create policy portfolio_upload on storage.objects for insert to authenticated with check(bucket_id='portfolio' and public.can_upload_portfolio(name));
create policy portfolio_download on storage.objects for select to anon,authenticated using(bucket_id='portfolio' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin() or exists(select 1 from public.portfolio_assets a join public.providers p on p.id=a.provider_id where a.path=storage.objects.name and a.approved and p.status='APPROVED')));

-- Revoke the default PUBLIC execute privilege, including future functions.
revoke all on schema private from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin(),public.can_read_booking(uuid) to anon,authenticated;
grant execute on function public.free_slots(uuid,date) to anon,authenticated;
grant execute on function public.can_upload_portfolio(text) to authenticated;
grant execute on function public.create_booking(uuid,timestamptz,text,text,text,text,text,uuid),public.booking_action(uuid,text,text),public.request_support(uuid,text,text),public.resolve_support(uuid,text,boolean,integer),public.confirm_refund(uuid,text),public.submit_review(uuid,integer,integer,integer,integer,text),public.booking_contact(uuid),public.mark_notifications_read(),public.save_profile(text,text),public.save_provider(text,text,text,text,text[],text[]),public.save_package(uuid,text,text,text,integer,integer,integer,text,text,boolean),public.add_availability(timestamptz,timestamptz),public.remove_availability(uuid),public.add_portfolio(text,text),public.submit_provider(),public.moderate_provider(uuid,text,text),public.moderate_content(uuid,text,text),public.save_settings(text,text,text,text,text,boolean) to authenticated;
alter default privileges in schema public revoke execute on functions from public;


-- 202610050002_operations.sql
-- Scheduled work has no public/browser entry point. Run as postgres only.
alter table public.bookings add column reminded_at timestamptz;
create index notifications_inbox on public.notifications(user_id,created_at desc);
create index booking_events_timeline on public.booking_events(booking_id,created_at);
create index support_queue on public.support_requests(status,created_at);
create index analytics_actor_time on public.analytics_events(actor_id,created_at);

create function private.maintenance() returns void language plpgsql security definer set search_path='' as $$
declare p record; b record;
begin
 if not pg_try_advisory_xact_lock(78231005) then return; end if;
 for p in select distinct provider_id from public.bookings where status in ('REQUESTED','AWAITING_DEPOSIT') and hold_until<now() loop
  perform private.expire_holds(p.provider_id);
 end loop;
 for b in update public.bookings set reminded_at=now() where status='CONFIRMED' and reminded_at is null and starts_at>now() and starts_at<=now()+interval '24 hours' returning id loop
  perform private.event(b.id,'UPCOMING','Buổi hẹn sẽ diễn ra trong 24 giờ tới. Vui lòng kiểm tra giờ và địa điểm.');
 end loop;
 -- Retain only anonymous-free funnel events for a bounded 90-day beta window.
 delete from public.analytics_events where created_at<now()-interval '90 days';
end $$;
revoke execute on function private.maintenance() from public,anon,authenticated;

create function public.provider_stats() returns table(provider_id uuid,completed_count bigint) language sql stable security definer set search_path='' as $$
 select p.id,count(b.id) from public.providers p left join public.bookings b on b.provider_id=p.id and b.status='COMPLETED'
 where p.status='APPROVED' group by p.id;
$$;
grant execute on function public.provider_stats() to anon,authenticated;

-- No search terms, URLs, contact details or third-party SDK are recorded.
-- These counts cover signed-in users only, not all website visitors.
create function public.track_event(p_event text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return; end if;
 if p_event not in ('search','provider_view','package_view','booking_started','booking_submitted') then raise exception 'Unknown event'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if (select count(*) from public.analytics_events where actor_id=auth.uid() and created_at>now()-interval '1 day')>=100 then return; end if;
 if exists(select 1 from public.analytics_events where actor_id=auth.uid() and event=p_event and created_at>now()-interval '10 seconds') then return; end if;
 insert into public.analytics_events(actor_id,event) values(auth.uid(),p_event);
end $$;
grant execute on function public.track_event(text) to authenticated;

create function public.admin_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Không có quyền.'; end if;
 return jsonb_build_object(
 'users',(select count(*) from public.profiles),
 'active_providers',(select count(*) from public.providers where status='APPROVED'),
 'requests',(select count(*) from public.bookings),
 'paid',(select count(*) from public.bookings where payment_status='PAID'),
 'completed',(select count(*) from public.bookings where status='COMPLETED'),
 'gmv',(select coalesce(sum(price),0) from public.bookings where status='COMPLETED'),
 'cancellation_rate',(select coalesce(round(100.0*count(*) filter(where status='CANCELLED')/nullif(count(*),0),1),0) from public.bookings),
 'funnel',(select coalesce(jsonb_object_agg(event,n),'{}') from (select event,count(*) n from public.analytics_events where created_at>now()-interval '90 days' group by event) x));
end $$;
grant execute on function public.admin_metrics() to authenticated;


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
