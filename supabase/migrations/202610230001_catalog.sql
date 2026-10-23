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
