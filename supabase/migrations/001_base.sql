-- TABYLGA 001: базовая схема — профили, роли, справочники, уведомления, журнал модерации.
--
-- Принципы:
--  * RLS включён на всех таблицах.
--  * Клиент (anon/authenticated) не пишет напрямую в денежные и статусные поля:
--    только через SECURITY DEFINER функции, которые сами проверяют права.
--  * Функции с префиксом "_" — внутренние, клиентам недоступны.
--  * Ошибки поднимаются как `raise exception '<код>'`, код совпадает с ключом перевода в dbErrors.
--  * Таблица пользователей — auth.users (Supabase Auth, пароли хранятся там в виде bcrypt-хеша).

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Типы
-- ---------------------------------------------------------------------------
create type public.user_status as enum ('active', 'blocked');
create type public.gender as enum ('male', 'female');
create type public.staff_role as enum ('admin', 'moderator');
create type public.notification_type as enum (
  'new_message',
  'listing_approved',
  'listing_rejected',
  'listing_expiring',
  'listing_expired',
  'listing_removed',
  'topup_approved',
  'topup_rejected',
  'balance_adjusted',
  'account_blocked',
  'account_unblocked',
  'support_reply'
);

-- ---------------------------------------------------------------------------
-- Профили
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  phone        text unique check (phone ~ '^996[0-9]{9}$'),
  email        text check (email ~* '^[a-z0-9._%+-]+@(gmail\.com|googlemail\.com)$'),
  first_name   text check (char_length(btrim(first_name)) between 1 and 50),
  last_name    text check (char_length(btrim(last_name)) between 1 and 50),
  middle_name  text check (middle_name is null or char_length(btrim(middle_name)) between 1 and 50),
  birth_year   smallint check (birth_year between 1900 and 2100),
  gender       public.gender,
  avatar_path  text,
  balance      bigint not null default 0 check (balance >= 0),
  status       public.user_status not null default 'active',
  block_reason text,
  blocked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.profiles.phone is 'Формат Supabase Auth: 996XXXXXXXXX (без плюса)';
comment on column public.profiles.balance is 'Баланс в сомах. Меняется только через public._apply_balance_change';

-- Публичная часть профиля (имя продавца, аватар). Телефон, баланс, год рождения сюда не входят.
create view public.public_profiles as
  select id, first_name, last_name, avatar_path, created_at
  from public.profiles;

-- ---------------------------------------------------------------------------
-- Роли персонала
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  role       public.staff_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

comment on table public.admins is 'admin — полный доступ (деньги, блокировки, реквизиты); moderator — объявления, жалобы, поддержка';

-- ---------------------------------------------------------------------------
-- Справочники
-- ---------------------------------------------------------------------------
create table public.categories (
  id         smallint primary key,
  slug       text not null unique,
  name_ru    text not null,
  name_ky    text not null,
  icon       text not null,
  sort_order smallint not null
);

insert into public.categories (id, slug, name_ru, name_ky, icon, sort_order) values
  (1,  'electronics',      'Электроника',               'Электроника',                    'tv',              1),
  (2,  'phones',           'Телефоны и аксессуары',     'Телефондор жана аксессуарлар',   'smartphone',      2),
  (3,  'computers',        'Компьютеры и ноутбуки',     'Компьютерлер жана ноутбуктар',   'laptop',          3),
  (4,  'appliances',       'Бытовая техника',           'Тиричилик техникасы',            'washing-machine', 4),
  (5,  'clothing',         'Одежда и обувь',            'Кийим жана бут кийим',           'shirt',           5),
  (6,  'beauty-health',    'Красота и здоровье',        'Сулуулук жана ден соолук',       'heart-pulse',     6),
  (7,  'perfume-cosmetics','Парфюмерия и косметика',    'Парфюмерия жана косметика',      'sparkles',        7),
  (8,  'kids',             'Детские товары',            'Балдар үчүн товарлар',           'baby',            8),
  (9,  'furniture',        'Мебель',                    'Эмерек',                         'sofa',            9),
  (10, 'home-garden',      'Дом и сад',                 'Үй жана бакча',                  'flower-2',        10),
  (11, 'construction',     'Строительство и ремонт',    'Курулуш жана оңдоо',             'hammer',          11),
  (12, 'cars',             'Автомобили',                'Унаалар',                        'car',             12),
  (13, 'auto-parts',       'Автозапчасти',              'Автотетиктер',                   'cog',             13),
  (14, 'real-estate',      'Недвижимость',              'Кыймылсыз мүлк',                 'building-2',      14),
  (15, 'animals',          'Животные',                  'Жаныбарлар',                     'paw-print',       15),
  (16, 'sport',            'Спорт и отдых',             'Спорт жана эс алуу',             'dumbbell',        16),
  (17, 'hobby',            'Хобби и развлечения',       'Хобби жана көңүл ачуу',          'gamepad-2',       17),
  (18, 'jobs-services',    'Работа и услуги',           'Жумуш жана кызматтар',           'briefcase',       18),
  (19, 'food',             'Продукты питания',          'Азык-түлүк',                     'apple',           19),
  (20, 'other',            'Другие товары',             'Башка товарлар',                 'package',         20);

create table public.regions (
  code       text primary key,
  name_ru    text not null,
  name_ky    text not null,
  sort_order smallint not null
);

insert into public.regions (code, name_ru, name_ky, sort_order) values
  ('bishkek',     'Бишкек',                  'Бишкек',                1),
  ('osh_city',    'Ош',                      'Ош',                    2),
  ('chui',        'Чуйская область',         'Чүй облусу',            3),
  ('osh',         'Ошская область',          'Ош облусу',             4),
  ('issyk_kul',   'Иссык-Кульская область',  'Ысык-Көл облусу',       5),
  ('naryn',       'Нарынская область',       'Нарын облусу',          6),
  ('talas',       'Таласская область',       'Талас облусу',          7),
  ('jalal_abad',  'Джалал-Абадская область', 'Жалал-Абад облусу',     8),
  ('batken',      'Баткенская область',      'Баткен облусу',         9);

-- ---------------------------------------------------------------------------
-- Уведомления и журнал модерации
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

comment on column public.notifications.data is 'Параметры для текста уведомления (listing_id, title, reason, amount, chat_id…). Текст переводит клиент по type.';

create table public.moderation_logs (
  id               bigint generated always as identity primary key,
  actor_id         uuid references public.profiles (id) on delete set null,
  action           text not null,
  target_user_id   uuid references public.profiles (id) on delete set null,
  listing_id       uuid,
  topup_request_id uuid,
  report_id        uuid,
  reason           text,
  details          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index moderation_logs_created_idx on public.moderation_logs (created_at desc);
create index moderation_logs_target_idx on public.moderation_logs (target_user_id);

-- ---------------------------------------------------------------------------
-- Вспомогательные функции
-- ---------------------------------------------------------------------------
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.role = 'admin');
$$;

create function public._require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'forbidden'; end if;
  return v;
end $$;

create function public._require_staff() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return auth.uid();
end $$;

create function public._require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  return auth.uid();
end $$;

-- Проверяет, что текущий пользователь не заблокирован и (опционально) заполнил профиль.
create function public._require_active_user(p_need_complete boolean default true) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public._require_user();
  p public.profiles;
begin
  select * into p from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if p.status = 'blocked' then raise exception 'account_blocked'; end if;
  if p_need_complete and (p.first_name is null or p.last_name is null
      or p.birth_year is null or p.gender is null) then
    raise exception 'profile_incomplete';
  end if;
  return v_uid;
end $$;

create function public._notify(p_user uuid, p_type public.notification_type, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, data) values (p_user, p_type, coalesce(p_data, '{}'::jsonb));
$$;

create function public._log(
  p_action text,
  p_target_user uuid default null,
  p_listing uuid default null,
  p_topup uuid default null,
  p_report uuid default null,
  p_reason text default null,
  p_details jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.moderation_logs (actor_id, action, target_user_id, listing_id, topup_request_id, report_id, reason, details)
  values (auth.uid(), p_action, p_target_user, p_listing, p_topup, p_report, nullif(btrim(p_reason), ''), coalesce(p_details, '{}'::jsonb));
$$;

create function public._set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Защита профиля
-- ---------------------------------------------------------------------------
-- Баланс и статус можно менять только внутри доверенных функций, которые выставляют
-- флаг tabylga.privileged на время транзакции. Это работает даже для service_role.
create function public._profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.balance is distinct from old.balance
      or new.status is distinct from old.status
      or new.block_reason is distinct from old.block_reason
      or new.blocked_at is distinct from old.blocked_at
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at)
     and coalesce(current_setting('tabylga.privileged', true), '') <> 'on' then
    raise exception 'forbidden';
  end if;

  if new.phone is distinct from old.phone
     and coalesce(current_setting('tabylga.privileged', true), '') <> 'on'
     and coalesce(current_setting('tabylga.auth_sync', true), '') <> 'on' then
    raise exception 'forbidden';
  end if;

  new.first_name  := nullif(btrim(new.first_name), '');
  new.last_name   := nullif(btrim(new.last_name), '');
  new.middle_name := nullif(btrim(new.middle_name), '');
  new.email       := nullif(lower(btrim(new.email)), '');

  if new.birth_year is not null
     and (new.birth_year < 1900 or new.birth_year > extract(year from now() at time zone 'Asia/Bishkek')::int) then
    raise exception 'bad_birth_year';
  end if;

  if new.avatar_path is not null and new.avatar_path not like new.id::text || '/%' then
    raise exception 'bad_image';
  end if;

  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public._profiles_guard();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public._set_updated_at();

-- Профиль создаётся автоматически при регистрации в Supabase Auth.
create function public._handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, nullif(new.phone, ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public._handle_new_user();

-- Смена телефона проходит через Supabase Auth (с SMS) — переносим номер в профиль.
create function public._handle_user_phone_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('tabylga.auth_sync', 'on', true);
  update public.profiles set phone = nullif(new.phone, '') where id = new.id;
  perform set_config('tabylga.auth_sync', 'off', true);
  return new;
end $$;

create trigger on_auth_user_phone_changed after update of phone on auth.users
  for each row when (old.phone is distinct from new.phone)
  execute function public._handle_user_phone_change();

-- ---------------------------------------------------------------------------
-- Блокировка пользователей (только admin)
-- ---------------------------------------------------------------------------
create function public.admin_set_block(p_user_id uuid, p_blocked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public._require_admin();
  v_reason text := nullif(btrim(p_reason), '');
  p public.profiles;
begin
  if p_user_id = v_actor then raise exception 'forbidden'; end if;
  select * into p from public.profiles where id = p_user_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_blocked and v_reason is null then raise exception 'reason_required'; end if;
  if (p.status = 'blocked') = p_blocked then raise exception 'bad_status'; end if;

  perform set_config('tabylga.privileged', 'on', true);
  update public.profiles
     set status       = case when p_blocked then 'blocked' else 'active' end::public.user_status,
         block_reason = case when p_blocked then v_reason end,
         blocked_at   = case when p_blocked then now() end
   where id = p_user_id;
  perform set_config('tabylga.privileged', 'off', true);

  perform public._notify(p_user_id,
    case when p_blocked then 'account_blocked' else 'account_unblocked' end::public.notification_type,
    jsonb_build_object('reason', v_reason));
  perform public._log(case when p_blocked then 'user_block' else 'user_unblock' end,
    p_target_user => p_user_id, p_reason => v_reason);
end $$;

-- ---------------------------------------------------------------------------
-- Уведомления: отметка о прочтении
-- ---------------------------------------------------------------------------
create function public.mark_notifications_read(p_ids bigint[] default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public._require_user();
begin
  update public.notifications
     set read_at = now()
   where user_id = v_uid and read_at is null
     and (p_ids is null or id = any (p_ids));
end $$;

-- ---------------------------------------------------------------------------
-- RLS и права
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.admins          enable row level security;
alter table public.categories      enable row level security;
alter table public.regions         enable row level security;
alter table public.notifications   enable row level security;
alter table public.moderation_logs enable row level security;

revoke all on public.profiles, public.admins, public.categories, public.regions,
              public.notifications, public.moderation_logs, public.public_profiles
  from anon, authenticated;

-- profiles: свой профиль (или персонал). Менять можно только личные поля.
grant select on public.profiles to authenticated;
grant update (first_name, last_name, middle_name, birth_year, gender, avatar_path, email)
  on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select on public.public_profiles to anon, authenticated;

-- admins: пользователь видит свою роль, admin видит всех. Назначение ролей — только через SQL (service role).
grant select on public.admins to authenticated;
create policy admins_select on public.admins for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

grant select on public.categories, public.regions to anon, authenticated;
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy regions_read on public.regions for select to anon, authenticated using (true);

grant select on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated
  using (user_id = auth.uid());

grant select on public.moderation_logs to authenticated;
create policy moderation_logs_staff on public.moderation_logs for select to authenticated
  using (public.is_staff());

-- Функции: внутренние закрыты, публичные — только для вошедших.
revoke execute on function
  public._require_user(), public._require_staff(), public._require_admin(),
  public._require_active_user(boolean), public._notify(uuid, public.notification_type, jsonb),
  public._log(text, uuid, uuid, uuid, uuid, text, jsonb), public._set_updated_at(),
  public._profiles_guard(), public._handle_new_user(), public._handle_user_phone_change()
  from public, anon, authenticated;

-- is_staff / is_super_admin нужны в политиках RLS, в том числе для anon (вернут false).
grant execute on function public.is_staff(), public.is_super_admin() to anon, authenticated;

revoke execute on function
  public.admin_set_block(uuid, boolean, text), public.mark_notifications_read(bigint[])
  from public, anon;
grant execute on function
  public.admin_set_block(uuid, boolean, text), public.mark_notifications_read(bigint[])
  to authenticated;
