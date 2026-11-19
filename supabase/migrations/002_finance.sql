-- TABYLGA 002: деньги — транзакции (финансовый журнал), способы оплаты, заявки на пополнение.
--
-- Любое изменение баланса идёт ТОЛЬКО через public._apply_balance_change:
-- блокировка строки профиля (FOR UPDATE), проверка неотрицательного баланса,
-- запись в transactions со старым и новым балансом, исполнителем и причиной — атомарно.

create type public.transaction_type as enum (
  'topup',            -- пополнение (одобренная заявка)
  'listing_payment',  -- оплата размещения объявления
  'refund',           -- возврат за неиспользованный срок
  'admin_credit',     -- ручное начисление администратором
  'admin_debit'       -- ручное списание администратором
);
create type public.topup_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Транзакции = журнал всех изменений баланса
-- ---------------------------------------------------------------------------
create table public.transactions (
  id               bigint generated always as identity primary key,
  user_id          uuid references public.profiles (id) on delete set null,
  type             public.transaction_type not null,
  amount           bigint not null check (amount <> 0),
  balance_before   bigint not null check (balance_before >= 0),
  balance_after    bigint not null check (balance_after >= 0),
  status           text not null default 'completed' check (status = 'completed'),
  description      text,
  listing_id       uuid,
  payment_no       integer,
  topup_request_id uuid,
  actor_id         uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint transactions_balance_math check (balance_after = balance_before + amount),
  constraint transactions_sign check (
    (type in ('topup', 'refund', 'admin_credit') and amount > 0) or
    (type in ('listing_payment', 'admin_debit') and amount < 0)
  ),
  -- listing_id может стать NULL, если объявление физически удалено вместе с аккаунтом; запись в журнале остаётся.
  constraint transactions_listing_ref check ((type in ('listing_payment', 'refund')) = (payment_no is not null)),
  constraint transactions_topup_ref check ((type = 'topup') = (topup_request_id is not null))
);

comment on table public.transactions is 'Финансовый журнал: кто (actor_id), кому (user_id), старый/новый баланс, сумма, причина (description), время';

create index transactions_user_idx on public.transactions (user_id, created_at desc);
-- Защита от двойного зачисления одной заявки.
create unique index transactions_topup_once on public.transactions (topup_request_id) where type = 'topup';
-- Защита от двойного списания и двойного возврата за один и тот же оплаченный период объявления.
create unique index transactions_listing_payment_once on public.transactions (listing_id, payment_no) where type = 'listing_payment';
create unique index transactions_listing_refund_once on public.transactions (listing_id, payment_no) where type = 'refund';

create function public._apply_balance_change(
  p_user uuid,
  p_amount bigint,
  p_type public.transaction_type,
  p_description text default null,
  p_listing uuid default null,
  p_payment_no integer default null,
  p_topup uuid default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_before bigint;
  v_after  bigint;
begin
  if p_amount is null or p_amount = 0 then raise exception 'bad_amount'; end if;

  select balance into v_before from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found'; end if;

  v_after := v_before + p_amount;
  if v_after < 0 then raise exception 'insufficient_funds'; end if;

  perform set_config('tabylga.privileged', 'on', true);
  update public.profiles set balance = v_after where id = p_user;
  perform set_config('tabylga.privileged', 'off', true);

  insert into public.transactions
    (user_id, type, amount, balance_before, balance_after, description, listing_id, payment_no, topup_request_id, actor_id)
  values
    (p_user, p_type, p_amount, v_before, v_after, nullif(btrim(p_description), ''), p_listing, p_payment_no, p_topup, auth.uid());

  return v_after;
end $$;

-- ---------------------------------------------------------------------------
-- Способы оплаты (реквизиты заполняет администратор)
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[a-z0-9_]{2,32}$'),
  name            text not null check (char_length(btrim(name)) between 1 and 60),
  recipient_name  text check (recipient_name is null or char_length(btrim(recipient_name)) between 1 and 100),
  account_number  text check (account_number is null or char_length(btrim(account_number)) between 4 and 64),
  instructions_ru text check (instructions_ru is null or char_length(instructions_ru) <= 1000),
  instructions_ky text check (instructions_ky is null or char_length(instructions_ky) <= 1000),
  qr_path         text,
  is_enabled      boolean not null default false,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Включить способ можно только с заполненными реквизитами.
  constraint payment_methods_enabled_complete check (
    not is_enabled or (recipient_name is not null and account_number is not null)
  )
);

create trigger payment_methods_updated_at before update on public.payment_methods
  for each row execute function public._set_updated_at();

-- Банки из ТЗ. Реквизитов нет — способы выключены, пока администратор их не заполнит.
insert into public.payment_methods (code, name, sort_order) values
  ('mbank',     'M BANK',      1),
  ('obank',     'O BANK',      2),
  ('simbank',   'SIMBANK',     3),
  ('bakai',     'BAKAI BANK',  4),
  ('optima',    'OPTIMA BANK', 5),
  ('kompanion', 'KOMPANION',   6),
  ('demirbank', 'DEMIRBANK',   7);

-- Все изменения реквизитов пишутся в журнал.
create function public._payment_methods_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public._log(
    'payment_method_' || lower(tg_op),
    p_details => jsonb_build_object(
      'id', coalesce(new.id, old.id),
      'old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
      'new', case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return coalesce(new, old);
end $$;

create trigger payment_methods_audit after insert or update or delete on public.payment_methods
  for each row execute function public._payment_methods_audit();

-- ---------------------------------------------------------------------------
-- Заявки на пополнение
-- ---------------------------------------------------------------------------
create table public.topup_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete set null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  method_name       text not null,
  amount            bigint not null check (amount between 1 and 1000000),
  transaction_ref   text check (transaction_ref is null or char_length(transaction_ref) between 1 and 100),
  receipt_path      text,
  status            public.topup_status not null default 'pending',
  reject_reason     text,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  constraint topup_proof check (transaction_ref is not null or receipt_path is not null),
  constraint topup_review check (
    (status = 'pending' and reviewed_at is null) or
    (status <> 'pending' and reviewed_at is not null) ),
  constraint topup_reject_reason check (status <> 'rejected' or reject_reason is not null)
);
create index topup_requests_user_idx on public.topup_requests (user_id, created_at desc);
create index topup_requests_pending_idx on public.topup_requests (created_at) where status = 'pending';

alter table public.transactions
  add constraint transactions_topup_fk foreign key (topup_request_id)
  references public.topup_requests (id) on delete restrict;
alter table public.moderation_logs
  add constraint moderation_logs_topup_fk foreign key (topup_request_id)
  references public.topup_requests (id) on delete set null;

create function public.create_topup_request(
  p_payment_method_id uuid,
  p_amount bigint,
  p_transaction_ref text default null,
  p_receipt_path text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._require_user();
  v_ref text := nullif(btrim(p_transaction_ref), '');
  v_receipt text := nullif(btrim(p_receipt_path), '');
  m public.payment_methods;
  v_id uuid;
begin
  select * into m from public.payment_methods where id = p_payment_method_id and is_enabled;
  if not found then raise exception 'bad_method'; end if;

  if p_amount is null or p_amount < 1 or p_amount > 1000000 then raise exception 'bad_amount'; end if;
  if v_ref is null and v_receipt is null then raise exception 'proof_required'; end if;
  if v_ref is not null and char_length(v_ref) > 100 then raise exception 'proof_required'; end if;

  if v_receipt is not null then
    if v_receipt not like v_uid::text || '/%' or not exists (
        select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = v_receipt) then
      raise exception 'bad_image';
    end if;
  end if;

  insert into public.topup_requests (user_id, payment_method_id, method_name, amount, transaction_ref, receipt_path)
  values (v_uid, m.id, m.name, p_amount, v_ref, v_receipt)
  returning id into v_id;
  return v_id;
end $$;

-- Одобрение / отклонение заявки. Только admin. Одна заявка — одно решение.
create function public.review_topup(p_request_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public._require_admin();
  v_reason text := nullif(btrim(p_reason), '');
  r public.topup_requests;
begin
  select * into r from public.topup_requests where id = p_request_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pending' then raise exception 'already_reviewed'; end if;
  if r.user_id is null then raise exception 'not_found'; end if;

  if p_approve then
    perform public._apply_balance_change(r.user_id, r.amount, 'topup',
      'Пополнение через ' || r.method_name, p_topup => r.id);
    update public.topup_requests
       set status = 'approved', reviewed_by = v_actor, reviewed_at = now()
     where id = r.id;
    perform public._notify(r.user_id, 'topup_approved',
      jsonb_build_object('topup_request_id', r.id, 'amount', r.amount));
    perform public._log('topup_approve', p_target_user => r.user_id, p_topup => r.id,
      p_details => jsonb_build_object('amount', r.amount));
  else
    if v_reason is null then raise exception 'reason_required'; end if;
    update public.topup_requests
       set status = 'rejected', reject_reason = v_reason, reviewed_by = v_actor, reviewed_at = now()
     where id = r.id;
    perform public._notify(r.user_id, 'topup_rejected',
      jsonb_build_object('topup_request_id', r.id, 'amount', r.amount, 'reason', v_reason));
    perform public._log('topup_reject', p_target_user => r.user_id, p_topup => r.id, p_reason => v_reason,
      p_details => jsonb_build_object('amount', r.amount));
  end if;
end $$;

-- Ручное начисление (+) или списание (−). Только admin, причина обязательна.
create function public.admin_adjust_balance(p_user_id uuid, p_amount bigint, p_reason text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public._require_admin();
  v_reason text := nullif(btrim(p_reason), '');
  v_new bigint;
begin
  if p_amount is null or p_amount = 0 or abs(p_amount) > 10000000 then raise exception 'bad_amount'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'not_found'; end if;

  v_new := public._apply_balance_change(p_user_id, p_amount,
    case when p_amount > 0 then 'admin_credit' else 'admin_debit' end::public.transaction_type,
    v_reason);

  perform public._notify(p_user_id, 'balance_adjusted',
    jsonb_build_object('amount', p_amount, 'reason', v_reason, 'balance', v_new));
  perform public._log('balance_adjust', p_target_user => p_user_id, p_reason => v_reason,
    p_details => jsonb_build_object('amount', p_amount, 'new_balance', v_new, 'old_balance', v_new - p_amount));
  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- RLS и права
-- ---------------------------------------------------------------------------
alter table public.transactions    enable row level security;
alter table public.payment_methods enable row level security;
alter table public.topup_requests  enable row level security;

revoke all on public.transactions, public.payment_methods, public.topup_requests from anon, authenticated;

-- Пользователь видит только свои операции; финансы всех — только admin (не moderator).
grant select on public.transactions to authenticated;
create policy transactions_select on public.transactions for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

grant select on public.topup_requests to authenticated;
create policy topup_requests_select on public.topup_requests for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- Реквизиты: включённые видят все вошедшие; admin видит и правит всё.
grant select on public.payment_methods to authenticated;
grant insert, delete on public.payment_methods to authenticated;
grant update (name, recipient_name, account_number, instructions_ru, instructions_ky, qr_path, is_enabled, sort_order)
  on public.payment_methods to authenticated;
create policy payment_methods_select on public.payment_methods for select to authenticated
  using (is_enabled or public.is_super_admin());
create policy payment_methods_admin_insert on public.payment_methods for insert to authenticated
  with check (public.is_super_admin());
create policy payment_methods_admin_update on public.payment_methods for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy payment_methods_admin_delete on public.payment_methods for delete to authenticated
  using (public.is_super_admin());

revoke execute on function
  public._apply_balance_change(uuid, bigint, public.transaction_type, text, uuid, integer, uuid),
  public._payment_methods_audit()
  from public, anon, authenticated;

revoke execute on function
  public.create_topup_request(uuid, bigint, text, text),
  public.review_topup(uuid, boolean, text),
  public.admin_adjust_balance(uuid, bigint, text)
  from public, anon;
grant execute on function
  public.create_topup_request(uuid, bigint, text, text),
  public.review_topup(uuid, boolean, text),
  public.admin_adjust_balance(uuid, bigint, text)
  to authenticated;
