-- TABYLGA 003: объявления, фото, избранное, жалобы; оплата публикации и модерация.
--
-- Жизненный цикл: create_listing (списание дни × 20 сом) -> pending_moderation
--   -> moderate_listing(approve) -> active (срок считается с момента одобрения, по времени сервера)
--   -> expire_listings() -> expired -> relist_listing (новая оплата) -> pending_moderation …
--   moderate_listing(reject): из pending — полный возврат; из active — возврат за неиспользованные полные дни.
--   delete_listing владельцем: из pending — полный возврат (размещение не оказано); иначе без возврата.

create type public.listing_status as enum
  ('draft', 'pending_moderation', 'active', 'rejected', 'expired', 'deleted');
create type public.report_reason as enum
  ('prohibited', 'fraud', 'spam', 'wrong_category', 'offensive', 'other');
create type public.report_status as enum ('open', 'resolved_removed', 'resolved_kept');

-- Цена одного дня размещения — единственный источник правды. Клиент берёт её отсюда только для показа.
create function public.listing_day_price() returns integer
language sql immutable as $$ select 20 $$;

create function public.listing_max_days() returns integer
language sql immutable as $$ select 30 $$;

-- ---------------------------------------------------------------------------
-- Объявления
-- ---------------------------------------------------------------------------
create table public.listings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  category_id        smallint not null references public.categories (id),
  title              text not null check (char_length(title) between 3 and 100),
  description        text not null default '' check (char_length(description) <= 5000),
  price              bigint check (price between 0 and 1000000000000),
  price_negotiable   boolean not null default false,
  phone              text not null check (phone ~ '^996[0-9]{9}$'),
  whatsapp           text not null check (whatsapp ~ '^[1-9][0-9]{9,14}$'),
  region             text not null references public.regions (code),
  city               text not null check (char_length(city) between 1 and 100),
  street             text not null check (char_length(street) between 1 and 100),
  house              text check (house is null or char_length(house) between 1 and 20),
  status             public.listing_status not null default 'draft',
  days               smallint not null check (days between 1 and 30),
  paid_amount        bigint not null default 0 check (paid_amount >= 0),
  payment_count      integer not null default 0 check (payment_count >= 0),
  submitted_at       timestamptz,
  published_at       timestamptz,
  expires_at         timestamptz,
  rejection_reason   text,
  expiring_notified  boolean not null default false,
  client_request_id  uuid,
  search_vector      tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint listings_price_choice check (price_negotiable = (price is null)),
  constraint listings_active_dates check (status <> 'active' or (published_at is not null and expires_at is not null)),
  constraint listings_client_request unique (user_id, client_request_id)
);

comment on column public.listings.whatsapp is 'Международный формат, только цифры без плюса (например 996555123456)';
comment on column public.listings.client_request_id is 'Ключ идемпотентности: повторная отправка той же формы не создаёт второе объявление и не списывает деньги';

create index listings_active_idx on public.listings (published_at desc) where status = 'active';
create index listings_category_idx on public.listings (category_id, published_at desc) where status = 'active';
create index listings_region_idx on public.listings (region) where status = 'active';
create index listings_user_idx on public.listings (user_id, created_at desc);
create index listings_expires_idx on public.listings (expires_at) where status = 'active';
create index listings_moderation_idx on public.listings (submitted_at) where status = 'pending_moderation';
create index listings_search_idx on public.listings using gin (search_vector);
create index listings_title_trgm_idx on public.listings using gin (title extensions.gin_trgm_ops);

create trigger listings_updated_at before update on public.listings
  for each row execute function public._set_updated_at();

create table public.listing_images (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  path       text not null unique,
  position   smallint not null check (position between 0 and 9),
  is_main    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);
create unique index listing_images_one_main on public.listing_images (listing_id) where is_main;

create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites (listing_id);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  reporter_id  uuid references public.profiles (id) on delete set null,
  reason       public.report_reason not null,
  comment      text check (comment is null or char_length(comment) <= 1000),
  status       public.report_status not null default 'open',
  resolved_by  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create unique index reports_one_open_per_user on public.reports (listing_id, reporter_id) where status = 'open';
create index reports_open_idx on public.reports (created_at) where status = 'open';

alter table public.transactions
  add constraint transactions_listing_fk foreign key (listing_id)
  references public.listings (id) on delete set null;
alter table public.moderation_logs
  add constraint moderation_logs_listing_fk foreign key (listing_id)
  references public.listings (id) on delete set null,
  add constraint moderation_logs_report_fk foreign key (report_id)
  references public.reports (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Создание объявления с оплатой
-- ---------------------------------------------------------------------------
create function public.create_listing(
  p_title text,
  p_category_id smallint,
  p_description text,
  p_price bigint,
  p_price_negotiable boolean,
  p_phone text,
  p_whatsapp text,
  p_region text,
  p_city text,
  p_street text,
  p_house text,
  p_days integer,
  p_images text[],
  p_main_image integer default 0,
  p_client_request_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := public._require_active_user(true);
  v_title  text := btrim(coalesce(p_title, ''));
  v_desc   text := btrim(coalesce(p_description, ''));
  v_city   text := btrim(coalesce(p_city, ''));
  v_street text := btrim(coalesce(p_street, ''));
  v_house  text := nullif(btrim(p_house), '');
  v_count  integer := coalesce(array_length(p_images, 1), 0);
  v_cost   bigint;
  v_id     uuid;
  i        integer;
begin
  -- Повторная отправка той же формы: возвращаем уже созданное объявление, без второго списания.
  if p_client_request_id is not null then
    select id into v_id from public.listings where user_id = v_uid and client_request_id = p_client_request_id;
    if found then return v_id; end if;
  end if;

  if char_length(v_title) not between 3 and 100 then raise exception 'bad_title'; end if;
  if char_length(v_desc) > 5000 then raise exception 'bad_description'; end if;
  if not exists (select 1 from public.categories where id = p_category_id) then raise exception 'bad_category'; end if;
  if coalesce(p_price_negotiable, false) then
    if p_price is not null then raise exception 'bad_price'; end if;
  elsif p_price is null or p_price < 0 or p_price > 1000000000000 then
    raise exception 'bad_price';
  end if;
  if p_phone is null or p_phone !~ '^996[0-9]{9}$' then raise exception 'bad_phone'; end if;
  if p_whatsapp is null or p_whatsapp !~ '^[1-9][0-9]{9,14}$' then raise exception 'bad_phone'; end if;
  if not exists (select 1 from public.regions where code = p_region) then raise exception 'bad_region'; end if;
  if char_length(v_city) not between 1 and 100 or char_length(v_street) not between 1 and 100
     or (v_house is not null and char_length(v_house) > 20) then
    raise exception 'bad_address';
  end if;
  if p_days is null or p_days < 1 or p_days > public.listing_max_days() then raise exception 'bad_days'; end if;

  if v_count < 1 or v_count > 10 or coalesce(p_main_image, -1) not between 0 and v_count - 1 then
    raise exception 'bad_images';
  end if;
  if (select count(distinct x) from unnest(p_images) x) <> v_count then raise exception 'bad_images'; end if;
  for i in 1 .. v_count loop
    if p_images[i] is null
       or p_images[i] not like v_uid::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'listing-images' and o.name = p_images[i])
       or exists (select 1 from public.listing_images li where li.path = p_images[i]) then
      raise exception 'bad_image';
    end if;
  end loop;

  v_cost := p_days::bigint * public.listing_day_price();

  insert into public.listings (
    user_id, category_id, title, description, price, price_negotiable, phone, whatsapp,
    region, city, street, house, status, days, paid_amount, payment_count, submitted_at, client_request_id)
  values (
    v_uid, p_category_id, v_title, v_desc, case when p_price_negotiable then null else p_price end,
    coalesce(p_price_negotiable, false), p_phone, p_whatsapp,
    p_region, v_city, v_street, v_house, 'pending_moderation', p_days, v_cost, 1, now(), p_client_request_id)
  returning id into v_id;

  -- Списание. При нехватке средств — исключение insufficient_funds и откат всей транзакции
  -- (объявление не создаётся, деньги не списываются).
  perform public._apply_balance_change(v_uid, -v_cost, 'listing_payment',
    'Размещение объявления на ' || p_days || ' дн.', p_listing => v_id, p_payment_no => 1);

  for i in 1 .. v_count loop
    insert into public.listing_images (listing_id, path, position, is_main)
    values (v_id, p_images[i], i - 1, (i - 1) = p_main_image);
  end loop;

  return v_id;
end $$;

-- Повторное размещение завершённого или отклонённого объявления с новой оплатой.
create function public.relist_listing(p_listing_id uuid, p_days integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public._require_active_user(true);
  l      public.listings;
  v_cost bigint;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found or l.status = 'deleted' then raise exception 'not_found'; end if;
  if l.user_id <> v_uid then raise exception 'forbidden'; end if;
  if l.status not in ('expired', 'rejected') then raise exception 'bad_status'; end if;
  if p_days is null or p_days < 1 or p_days > public.listing_max_days() then raise exception 'bad_days'; end if;

  v_cost := p_days::bigint * public.listing_day_price();

  update public.listings
     set status = 'pending_moderation', days = p_days, paid_amount = v_cost,
         payment_count = l.payment_count + 1, submitted_at = now(),
         published_at = null, expires_at = null, rejection_reason = null, expiring_notified = false
   where id = l.id;

  perform public._apply_balance_change(v_uid, -v_cost, 'listing_payment',
    'Повторное размещение на ' || p_days || ' дн.', p_listing => l.id, p_payment_no => l.payment_count + 1);
end $$;

-- Возврат за неиспользованные полные дни текущего оплаченного периода (или полностью, если не начинался).
create function public._refund_listing(l public.listings, p_full boolean, p_description text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_refund bigint;
  v_days_left integer;
begin
  if l.paid_amount <= 0 or l.payment_count < 1 then return 0; end if;
  if p_full then
    v_refund := l.paid_amount;
  else
    v_days_left := greatest(0, floor(extract(epoch from (l.expires_at - now())) / 86400))::integer;
    v_refund := least(l.paid_amount, (l.paid_amount / l.days) * v_days_left);
  end if;
  if v_refund > 0 then
    perform public._apply_balance_change(l.user_id, v_refund, 'refund', p_description,
      p_listing => l.id, p_payment_no => l.payment_count);
  end if;
  return v_refund;
end $$;

-- Модерация: одобрить (pending -> active) или отклонить (pending/active -> rejected, с возвратом).
create function public.moderate_listing(p_listing_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public._require_staff();
  v_reason text := nullif(btrim(p_reason), '');
  l        public.listings;
  v_refund bigint;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then raise exception 'not_found'; end if;

  if p_approve then
    if l.status <> 'pending_moderation' then raise exception 'bad_status'; end if;
    update public.listings
       set status = 'active', published_at = now(), expires_at = now() + make_interval(days => l.days),
           rejection_reason = null, expiring_notified = false
     where id = l.id;
    perform public._notify(l.user_id, 'listing_approved', jsonb_build_object('listing_id', l.id, 'title', l.title));
    perform public._log('listing_approve', p_target_user => l.user_id, p_listing => l.id);
  else
    if v_reason is null then raise exception 'reason_required'; end if;
    if l.status not in ('pending_moderation', 'active') then raise exception 'bad_status'; end if;
    v_refund := public._refund_listing(l, l.status = 'pending_moderation', 'Возврат: объявление отклонено');
    update public.listings set status = 'rejected', rejection_reason = v_reason where id = l.id;
    perform public._notify(l.user_id, 'listing_rejected',
      jsonb_build_object('listing_id', l.id, 'title', l.title, 'reason', v_reason, 'refund', v_refund));
    perform public._log('listing_reject', p_target_user => l.user_id, p_listing => l.id, p_reason => v_reason,
      p_details => jsonb_build_object('refund', v_refund, 'from_status', l.status));
  end if;
end $$;

-- Удаление: владелец — своё объявление; персонал — любое (причина обязательна, без возврата).
create function public.delete_listing(p_listing_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := public._require_user();
  v_reason text := nullif(btrim(p_reason), '');
  l        public.listings;
  v_refund bigint := 0;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found or l.status = 'deleted' then raise exception 'not_found'; end if;

  if l.user_id = v_uid then
    if l.status = 'pending_moderation' then
      v_refund := public._refund_listing(l, true, 'Возврат: объявление удалено до модерации');
    end if;
    update public.listings set status = 'deleted' where id = l.id;
  elsif public.is_staff() then
    if v_reason is null then raise exception 'reason_required'; end if;
    update public.listings set status = 'deleted', rejection_reason = v_reason where id = l.id;
    perform public._notify(l.user_id, 'listing_removed',
      jsonb_build_object('listing_id', l.id, 'title', l.title, 'reason', v_reason));
    perform public._log('listing_delete', p_target_user => l.user_id, p_listing => l.id, p_reason => v_reason);
  else
    raise exception 'forbidden';
  end if;
end $$;

-- Автозавершение по сроку + напоминание за сутки. Запускается по расписанию (006_jobs).
create function public.expire_listings() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with soon as (
    update public.listings
       set expiring_notified = true
     where status = 'active' and not expiring_notified
       and expires_at > now() and expires_at <= now() + interval '24 hours'
    returning id, user_id, title, expires_at
  )
  insert into public.notifications (user_id, type, data)
  select user_id, 'listing_expiring', jsonb_build_object('listing_id', id, 'title', title, 'expires_at', expires_at)
  from soon;

  with done as (
    update public.listings
       set status = 'expired'
     where status = 'active' and expires_at <= now()
    returning id, user_id, title
  ), n as (
    insert into public.notifications (user_id, type, data)
    select user_id, 'listing_expired', jsonb_build_object('listing_id', id, 'title', title)
    from done
    returning 1
  )
  select count(*) into v_count from n;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Жалобы
-- ---------------------------------------------------------------------------
create function public.report_listing(p_listing_id uuid, p_reason public.report_reason, p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._require_user();
  l public.listings;
  v_id uuid;
begin
  select * into l from public.listings where id = p_listing_id;
  if not found or l.status <> 'active' or l.expires_at <= now() then raise exception 'listing_not_available'; end if;
  if l.user_id = v_uid then raise exception 'own_listing'; end if;
  if p_reason is null then raise exception 'reason_required'; end if;

  select id into v_id from public.reports
   where listing_id = l.id and reporter_id = v_uid and status = 'open';
  if found then return v_id; end if;

  insert into public.reports (listing_id, reporter_id, reason, comment)
  values (l.id, v_uid, p_reason, nullif(btrim(left(p_comment, 1000)), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Решение по жалобе: удалить объявление (закрывает все открытые жалобы на него) или оставить.
create function public.resolve_report(p_report_id uuid, p_remove boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := public._require_staff();
  v_reason text := nullif(btrim(p_reason), '');
  r public.reports;
  l public.listings;
begin
  select * into r from public.reports where id = p_report_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'open' then raise exception 'already_reviewed'; end if;

  if p_remove then
    if v_reason is null then raise exception 'reason_required'; end if;
    select * into l from public.listings where id = r.listing_id for update;
    if l.status <> 'deleted' then
      update public.listings set status = 'deleted', rejection_reason = v_reason where id = l.id;
      perform public._notify(l.user_id, 'listing_removed',
        jsonb_build_object('listing_id', l.id, 'title', l.title, 'reason', v_reason));
    end if;
    update public.reports
       set status = 'resolved_removed', resolved_by = v_actor, resolved_at = now()
     where listing_id = r.listing_id and status = 'open';
  else
    update public.reports
       set status = 'resolved_kept', resolved_by = v_actor, resolved_at = now()
     where id = r.id;
  end if;

  perform public._log(case when p_remove then 'report_remove' else 'report_keep' end,
    p_target_user => (select user_id from public.listings where id = r.listing_id),
    p_listing => r.listing_id, p_report => r.id, p_reason => v_reason);
end $$;

-- ---------------------------------------------------------------------------
-- Поиск и ленты (вызывается с правами пользователя: RLS действует)
-- ---------------------------------------------------------------------------
-- p_sort: 'new' — новые сверху; 'random' — перемешано по p_seed (стабильно при пагинации,
-- клиент меняет seed, чтобы перемешать заново).
create function public.search_listings(
  p_query text default null,
  p_category_id smallint default null,
  p_region text default null,
  p_sort text default 'new',
  p_seed text default null,
  p_limit integer default 20,
  p_offset integer default 0
) returns setof public.listings
language plpgsql stable set search_path = '' as $$
declare
  v_q text := nullif(btrim(left(coalesce(p_query, ''), 100)), '');
  v_like text;
  v_tsq tsquery;
begin
  if v_q is not null then
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    select to_tsquery('simple', string_agg(w || ':*', ' & '))
      into v_tsq
      from (select regexp_replace(w, '[^[:alnum:]]', '', 'g') as w
              from regexp_split_to_table(lower(v_q), '\s+') w) t
     where w <> '';
  end if;

  return query
  select l.*
    from public.listings l
   where l.status = 'active'
     and l.expires_at > now()
     and (p_category_id is null or l.category_id = p_category_id)
     and (p_region is null or l.region = p_region)
     and (v_q is null
          or (v_tsq is not null and l.search_vector @@ v_tsq)
          or l.title ilike v_like
          or l.category_id in (select c.id from public.categories c
                                where c.name_ru ilike v_like or c.name_ky ilike v_like))
   order by
     case when p_sort = 'random' then md5(l.id::text || coalesce(p_seed, '')) end,
     l.published_at desc, l.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- ---------------------------------------------------------------------------
-- RLS и права
-- ---------------------------------------------------------------------------
alter table public.listings       enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites      enable row level security;
alter table public.reports        enable row level security;

revoke all on public.listings, public.listing_images, public.favorites, public.reports from anon, authenticated;

-- Активные (и не истёкшие по времени, даже если планировщик ещё не отработал) видят все;
-- свои — владелец (кроме удалённых); все — персонал. Запись только через функции.
grant select on public.listings to anon, authenticated;
create policy listings_public on public.listings for select to anon, authenticated
  using (status = 'active' and expires_at > now());
create policy listings_own on public.listings for select to authenticated
  using (user_id = auth.uid() and status <> 'deleted');
create policy listings_staff on public.listings for select to authenticated
  using (public.is_staff());

grant select on public.listing_images to anon, authenticated;
create policy listing_images_read on public.listing_images for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

grant select, insert, delete on public.favorites to authenticated;
create policy favorites_select on public.favorites for select to authenticated
  using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.listings l
                           where l.id = listing_id and l.status = 'active' and l.expires_at > now()));
create policy favorites_delete on public.favorites for delete to authenticated
  using (user_id = auth.uid());

grant select on public.reports to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());

revoke execute on function
  public._refund_listing(public.listings, boolean, text),
  public.expire_listings()
  from public, anon, authenticated;

grant execute on function public.listing_day_price(), public.listing_max_days() to anon, authenticated;
grant execute on function
  public.search_listings(text, smallint, text, text, text, integer, integer)
  to anon, authenticated;

revoke execute on function
  public.create_listing(text, smallint, text, bigint, boolean, text, text, text, text, text, text, integer, text[], integer, uuid),
  public.relist_listing(uuid, integer),
  public.moderate_listing(uuid, boolean, text),
  public.delete_listing(uuid, text),
  public.report_listing(uuid, public.report_reason, text),
  public.resolve_report(uuid, boolean, text)
  from public, anon;
grant execute on function
  public.create_listing(text, smallint, text, bigint, boolean, text, text, text, text, text, text, integer, text[], integer, uuid),
  public.relist_listing(uuid, integer),
  public.moderate_listing(uuid, boolean, text),
  public.delete_listing(uuid, text),
  public.report_listing(uuid, public.report_reason, text),
  public.resolve_report(uuid, boolean, text)
  to authenticated;
