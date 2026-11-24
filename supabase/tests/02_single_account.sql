-- 007: закрытый режим. Запускается после 01_flows.sql в той же базе (использует схему t).
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
reset role;

-- Посторонний номер, аккаунт без телефона и смена номера на чужой — отклоняются.
select t.expect_error($$insert into auth.users (phone) values ('996555999999')$$, 'signup_closed');
select t.expect_error($$insert into auth.users (email) values ('x@gmail.com')$$, 'signup_closed');
select t.expect_error($$update auth.users set phone = '996555999999' where phone = '996555000001'$$, 'signup_closed');

-- Разрешённый номер: аккаунт создаётся, профиль и роль admin выдаются автоматически.
insert into auth.users (phone) values ('996700700700');
insert into t.ids select 'owner', id from auth.users where phone = '996700700700';
select t.eq((select phone from public.profiles where id = t.id('owner')), '996700700700', 'профиль владельца создан');
select t.eq((select role::text from public.admins where user_id = t.id('owner')), 'admin', 'владелец получил роль admin');

-- Клиенты не видят и не меняют список разрешённых номеров.
set role authenticated;
select t.as_user('owner');
select t.expect_error($$select * from public.signup_allowlist$$, 'permission denied');
select t.expect_error($$insert into public.signup_allowlist (phone) values ('996555999999')$$, 'permission denied');
select t.expect_error($$select public._enforce_signup_allowlist()$$, 'permission denied');

-- Владелец проходит весь цикл пополнения сам: заявка -> одобрение -> баланс.
select t.eq(public.is_super_admin(), true, 'владелец — admin');
reset role;
update public.payment_methods set recipient_name = 'Тест', account_number = '1234567890', is_enabled = true where code = 'optima';
set role authenticated;
select t.as_user('owner');
insert into t.ids values ('own_topup', public.create_topup_request(
  (select id from public.payment_methods where code = 'optima'), 700, 'TX-OWNER'));
select public.review_topup(t.id('own_topup'), true);
select t.eq((select balance from public.profiles where id = t.id('owner')), 700::bigint, 'баланс владельца пополнен');
select t.expect_error($$select public.review_topup(t.id('own_topup'), true)$$, 'already_reviewed');
reset role;

\o
\echo 'ЗАКРЫТЫЙ РЕЖИМ: ТЕСТЫ ПРОЙДЕНЫ'
