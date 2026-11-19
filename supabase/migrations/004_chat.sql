-- TABYLGA 004: чаты покупатель–продавец и чат поддержки.
--
-- Чат создаётся при первом обращении покупателя по объявлению (start_chat).
-- Сообщения пишутся только через функции: проверка участия, блокировки, фото.
-- Заблокированный пользователь не может писать продавцам, но может писать в поддержку.

create type public.support_topic as enum ('topup', 'listing', 'block', 'other');
create type public.support_status as enum ('open', 'closed');

create table public.chats (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references public.listings (id) on delete set null,
  buyer_id        uuid references public.profiles (id) on delete set null,
  seller_id       uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  unique (listing_id, buyer_id)
);

create table public.chat_members (
  chat_id      uuid not null references public.chats (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  joined_at    timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index chat_members_user_idx on public.chat_members (user_id);

create table public.support_chats (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  topic             public.support_topic not null,
  status            public.support_status not null default 'open',
  created_at        timestamptz not null default now(),
  last_message_at   timestamptz,
  user_last_read_at timestamptz,
  staff_last_read_at timestamptz
);
create index support_chats_user_idx on public.support_chats (user_id);
create index support_chats_open_idx on public.support_chats (last_message_at desc) where status = 'open';

create table public.messages (
  id              bigint generated always as identity primary key,
  chat_id         uuid references public.chats (id) on delete cascade,
  support_chat_id uuid references public.support_chats (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,
  is_staff_reply  boolean not null default false,
  body            text check (body is null or char_length(body) between 1 and 4000),
  image_path      text,
  created_at      timestamptz not null default now(),
  constraint messages_one_target check ((chat_id is null) <> (support_chat_id is null)),
  constraint messages_not_empty check (body is not null or image_path is not null)
);
create index messages_chat_idx on public.messages (chat_id, created_at desc) where chat_id is not null;
create index messages_support_idx on public.messages (support_chat_id, created_at desc) where support_chat_id is not null;
create index messages_image_idx on public.messages (image_path) where image_path is not null;

-- ---------------------------------------------------------------------------
-- Хелперы (SECURITY DEFINER, чтобы политики не зацикливались)
-- ---------------------------------------------------------------------------
create function public.is_chat_member(p_chat_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_members m where m.chat_id = p_chat_id and m.user_id = auth.uid());
$$;

create function public.can_access_support_chat(p_support_chat_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff()
      or exists (select 1 from public.support_chats s where s.id = p_support_chat_id and s.user_id = auth.uid());
$$;

create function public._check_chat_image(p_uid uuid, p_path text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text := nullif(btrim(p_path), '');
begin
  if v is null then return null; end if;
  if v not like p_uid::text || '/%' or not exists (
      select 1 from storage.objects o where o.bucket_id = 'chat-images' and o.name = v) then
    raise exception 'bad_image';
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Чаты покупатель–продавец
-- ---------------------------------------------------------------------------
create function public.start_chat(p_listing_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._require_active_user(false);
  l public.listings;
  v_chat uuid;
begin
  select * into l from public.listings where id = p_listing_id;
  if not found then raise exception 'listing_not_available'; end if;
  if l.user_id = v_uid then raise exception 'own_listing'; end if;

  select id into v_chat from public.chats where listing_id = l.id and buyer_id = v_uid;
  if found then return v_chat; end if;

  if l.status <> 'active' or l.expires_at <= now() then raise exception 'listing_not_available'; end if;

  insert into public.chats (listing_id, buyer_id, seller_id)
  values (l.id, v_uid, l.user_id)
  on conflict (listing_id, buyer_id) do update set listing_id = excluded.listing_id
  returning id into v_chat;

  insert into public.chat_members (chat_id, user_id) values (v_chat, v_uid), (v_chat, l.user_id)
  on conflict do nothing;
  return v_chat;
end $$;

create function public.send_message(p_chat_id uuid, p_body text default null, p_image_path text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := public._require_active_user(false);
  v_body  text := nullif(btrim(p_body), '');
  v_image text;
  v_id    bigint;
  v_other uuid;
begin
  if not exists (select 1 from public.chat_members where chat_id = p_chat_id and user_id = v_uid) then
    raise exception 'forbidden';
  end if;
  if v_body is not null and char_length(v_body) > 4000 then raise exception 'bad_message'; end if;
  v_image := public._check_chat_image(v_uid, p_image_path);
  if v_body is null and v_image is null then raise exception 'bad_message'; end if;

  insert into public.messages (chat_id, sender_id, body, image_path)
  values (p_chat_id, v_uid, v_body, v_image)
  returning id into v_id;

  update public.chats set last_message_at = now() where id = p_chat_id;
  update public.chat_members set last_read_at = now() where chat_id = p_chat_id and user_id = v_uid;

  -- Одно непрочитанное уведомление на чат: обновляем его, а не плодим новые.
  for v_other in select user_id from public.chat_members where chat_id = p_chat_id and user_id <> v_uid loop
    update public.notifications
       set created_at = now(), data = data || jsonb_build_object('message_id', v_id)
     where user_id = v_other and type = 'new_message' and read_at is null
       and data->>'chat_id' = p_chat_id::text;
    if not found then
      perform public._notify(v_other, 'new_message',
        jsonb_build_object('chat_id', p_chat_id, 'message_id', v_id, 'sender_id', v_uid));
    end if;
  end loop;

  return v_id;
end $$;

create function public.mark_chat_read(p_chat_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public._require_user();
begin
  update public.chat_members set last_read_at = now() where chat_id = p_chat_id and user_id = v_uid;
  if not found then raise exception 'forbidden'; end if;
  update public.notifications set read_at = now()
   where user_id = v_uid and type = 'new_message' and read_at is null and data->>'chat_id' = p_chat_id::text;
end $$;

-- Список чатов пользователя: собеседник, товар, последнее сообщение, непрочитанные.
create function public.get_my_chats()
returns table (
  chat_id            uuid,
  listing_id         uuid,
  listing_title      text,
  listing_image      text,
  other_user_id      uuid,
  other_first_name   text,
  other_last_name    text,
  other_avatar_path  text,
  last_message_body  text,
  last_message_image text,
  last_message_at    timestamptz,
  last_message_mine  boolean,
  unread_count       integer
)
language sql stable security definer set search_path = '' as $$
  select c.id,
         c.listing_id,
         l.title,
         (select li.path from public.listing_images li where li.listing_id = l.id order by li.is_main desc, li.position limit 1),
         o.user_id,
         p.first_name,
         p.last_name,
         p.avatar_path,
         lm.body,
         lm.image_path,
         lm.created_at,
         lm.sender_id = auth.uid(),
         (select count(*)::integer from public.messages m
           where m.chat_id = c.id and m.sender_id is distinct from auth.uid()
             and m.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz))
    from public.chat_members me
    join public.chats c on c.id = me.chat_id
    left join public.listings l on l.id = c.listing_id
    left join public.chat_members o on o.chat_id = c.id and o.user_id <> me.user_id
    left join public.profiles p on p.id = o.user_id
    left join lateral (
      select m.body, m.image_path, m.created_at, m.sender_id
        from public.messages m where m.chat_id = c.id
       order by m.created_at desc, m.id desc limit 1) lm on true
   where me.user_id = auth.uid()
     and c.last_message_at is not null
   order by c.last_message_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Поддержка
-- ---------------------------------------------------------------------------
create function public.open_support_chat(p_topic public.support_topic) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._require_user();
  v_id uuid;
begin
  if p_topic is null then raise exception 'reason_required'; end if;
  select id into v_id from public.support_chats
   where user_id = v_uid and topic = p_topic and status = 'open'
   order by created_at desc limit 1;
  if found then return v_id; end if;
  insert into public.support_chats (user_id, topic) values (v_uid, p_topic) returning id into v_id;
  return v_id;
end $$;

-- Пишет владелец обращения (даже заблокированный) или персонал.
create function public.send_support_message(p_support_chat_id uuid, p_body text default null, p_image_path text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := public._require_user();
  v_body  text := nullif(btrim(p_body), '');
  v_image text;
  s public.support_chats;
  v_staff boolean;
  v_id bigint;
begin
  select * into s from public.support_chats where id = p_support_chat_id for update;
  if not found then raise exception 'not_found'; end if;

  if s.user_id = v_uid then
    v_staff := false;
  elsif public.is_staff() then
    v_staff := true;
  else
    raise exception 'forbidden';
  end if;

  if v_body is not null and char_length(v_body) > 4000 then raise exception 'bad_message'; end if;
  v_image := public._check_chat_image(v_uid, p_image_path);
  if v_body is null and v_image is null then raise exception 'bad_message'; end if;

  insert into public.messages (support_chat_id, sender_id, is_staff_reply, body, image_path)
  values (s.id, v_uid, v_staff, v_body, v_image)
  returning id into v_id;

  update public.support_chats
     set last_message_at = now(),
         status = 'open',
         user_last_read_at  = case when v_staff then user_last_read_at else now() end,
         staff_last_read_at = case when v_staff then now() else staff_last_read_at end
   where id = s.id;

  if v_staff then
    perform public._notify(s.user_id, 'support_reply', jsonb_build_object('support_chat_id', s.id, 'message_id', v_id));
    perform public._log('support_reply', p_target_user => s.user_id, p_details => jsonb_build_object('support_chat_id', s.id));
  end if;
  return v_id;
end $$;

create function public.mark_support_read(p_support_chat_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._require_user();
  s public.support_chats;
begin
  select * into s from public.support_chats where id = p_support_chat_id;
  if not found then raise exception 'not_found'; end if;
  if s.user_id = v_uid then
    update public.support_chats set user_last_read_at = now() where id = s.id;
    update public.notifications set read_at = now()
     where user_id = v_uid and type = 'support_reply' and read_at is null and data->>'support_chat_id' = s.id::text;
  elsif public.is_staff() then
    update public.support_chats set staff_last_read_at = now() where id = s.id;
  else
    raise exception 'forbidden';
  end if;
end $$;

create function public.close_support_chat(p_support_chat_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public._require_staff();
begin
  update public.support_chats set status = 'closed' where id = p_support_chat_id and status = 'open';
  if not found then raise exception 'bad_status'; end if;
  perform public._log('support_close', p_target_user => (select user_id from public.support_chats where id = p_support_chat_id),
    p_details => jsonb_build_object('support_chat_id', p_support_chat_id));
end $$;

-- ---------------------------------------------------------------------------
-- RLS и права
-- ---------------------------------------------------------------------------
alter table public.chats         enable row level security;
alter table public.chat_members  enable row level security;
alter table public.support_chats enable row level security;
alter table public.messages      enable row level security;

revoke all on public.chats, public.chat_members, public.support_chats, public.messages from anon, authenticated;

-- Переписку покупателя и продавца видят только участники (персонал — нет).
grant select on public.chats, public.chat_members, public.support_chats, public.messages to authenticated;
create policy chats_member on public.chats for select to authenticated
  using (public.is_chat_member(id));
create policy chat_members_member on public.chat_members for select to authenticated
  using (public.is_chat_member(chat_id));
create policy support_chats_access on public.support_chats for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy messages_access on public.messages for select to authenticated
  using ((chat_id is not null and public.is_chat_member(chat_id))
      or (support_chat_id is not null and public.can_access_support_chat(support_chat_id)));

revoke execute on function public._check_chat_image(uuid, text) from public, anon, authenticated;

revoke execute on function
  public.is_chat_member(uuid), public.can_access_support_chat(uuid),
  public.start_chat(uuid), public.send_message(uuid, text, text), public.mark_chat_read(uuid),
  public.get_my_chats(),
  public.open_support_chat(public.support_topic), public.send_support_message(uuid, text, text),
  public.mark_support_read(uuid), public.close_support_chat(uuid)
  from public, anon;
grant execute on function
  public.is_chat_member(uuid), public.can_access_support_chat(uuid),
  public.start_chat(uuid), public.send_message(uuid, text, text), public.mark_chat_read(uuid),
  public.get_my_chats(),
  public.open_support_chat(public.support_topic), public.send_support_message(uuid, text, text),
  public.mark_support_read(uuid), public.close_support_chat(uuid)
  to authenticated;
