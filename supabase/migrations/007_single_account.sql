-- TABYLGA 007: закрытый режим — войти можно только с разрешённых номеров.
--
-- Решение владельца: пока работает один аккаунт +996 700 700 700 (роль admin), регистрации нет.
-- Защита в два слоя:
--   1) в Supabase Auth выключено «Allow new users to sign up» (настройка проекта);
--   2) здесь: триггер на auth.users отклоняет любой номер, которого нет в signup_allowlist,
--      даже если аккаунт создают через панель Supabase или service_role.
-- Чтобы позже открыть регистрацию для всех, нужна новая миграция, которая удалит триггеры
-- auth_users_allowlist_*; таблицу можно оставить для выдачи ролей.

create table public.signup_allowlist (
  phone      text primary key check (phone ~ '^996[0-9]{9}$'),
  role       public.staff_role,
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.signup_allowlist is 'Номера (формат 996XXXXXXXXX), которым разрешено иметь аккаунт; role — роль, выдаваемая при создании';

-- RLS без политик: клиенты (anon/authenticated) таблицу не видят и не меняют.
alter table public.signup_allowlist enable row level security;
revoke all on public.signup_allowlist from anon, authenticated;

insert into public.signup_allowlist (phone, role, note)
values ('996700700700', 'admin', 'Единственный аккаунт: закрытое тестирование');

-- Пропускаем в auth.users только номера из списка.
create function public._enforce_signup_allowlist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(new.phone, '') is null
     or not exists (select 1 from public.signup_allowlist a where a.phone = new.phone) then
    raise exception 'signup_closed';
  end if;
  return new;
end $$;

create trigger auth_users_allowlist_insert before insert on auth.users
  for each row execute function public._enforce_signup_allowlist();
create trigger auth_users_allowlist_phone before update of phone on auth.users
  for each row when (old.phone is distinct from new.phone)
  execute function public._enforce_signup_allowlist();

-- Роль из списка выдаётся сразу после создания профиля.
-- Имя триггера по алфавиту идёт после on_auth_user_created (001), поэтому профиль уже есть.
create function public._grant_allowlisted_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_role public.staff_role;
begin
  select a.role into v_role from public.signup_allowlist a where a.phone = new.phone;
  if v_role is not null then
    insert into public.admins (user_id, role) values (new.id, v_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
  return new;
end $$;

create trigger on_auth_user_created_role after insert on auth.users
  for each row execute function public._grant_allowlisted_role();

-- Если аккаунт с этим номером уже был создан до миграции — выдаём роль.
insert into public.admins (user_id, role)
select p.id, a.role
  from public.profiles p
  join public.signup_allowlist a on a.phone = p.phone
 where a.role is not null
on conflict (user_id) do update set role = excluded.role;

revoke execute on function public._enforce_signup_allowlist(), public._grant_allowlisted_role()
  from public, anon, authenticated;
