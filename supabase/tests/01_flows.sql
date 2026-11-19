-- Сценарные тесты TABYLGA. Запуск: supabase/tests/run.sh (локальный PostgreSQL + 00_supabase_shim.sql).
-- Каждый шаг выполняется под ролью authenticated/anon от имени конкретного пользователя, как через supabase.rpc.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create schema t;
grant usage on schema t to anon, authenticated;

-- Выполнить SQL и убедиться, что он упал с ожидаемым кодом ошибки.
create function t.expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ожидалась ошибка %, но запрос прошёл: %', p_code, p_sql;
exception when others then
  if sqlerrm not like '%' || p_code || '%' then
    raise exception 'ожидалась ошибка %, получено "%" в: %', p_code, sqlerrm, p_sql;
  end if;
end $$;
grant execute on function t.expect_error(text, text) to anon, authenticated;

create function t.eq(p_actual anyelement, p_expected anyelement, p_msg text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: ожидалось %, получено %', p_msg, p_expected, p_actual;
  end if;
end $$;
grant execute on function t.eq(anyelement, anyelement, text) to anon, authenticated;

create table t.ids (name text primary key, id uuid);
grant select, insert, update on t.ids to anon, authenticated;
create function t.id(p text) returns uuid language sql stable as $$ select id from t.ids where name = p $$;
grant execute on function t.id(text) to anon, authenticated;

-- Переключение пользователя (как JWT в Supabase).
create function t.as_user(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from t.ids where name = p_name), 'role', 'authenticated')::text, false);
end $$;
grant execute on function t.as_user(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Подготовка: пользователи (регистрация через auth.users создаёт профиль триггером)
-- ---------------------------------------------------------------------------
insert into auth.users (phone) values ('996555000001'), ('996555000002'), ('996555000003'),
  ('996555000004'), ('996555000005'), ('996555000006');
insert into t.ids select 'seller', id from auth.users where phone = '996555000001';
insert into t.ids select 'buyer',  id from auth.users where phone = '996555000002';
insert into t.ids select 'admin',  id from auth.users where phone = '996555000003';
insert into t.ids select 'moder',  id from auth.users where phone = '996555000004';
insert into t.ids select 'newbie', id from auth.users where phone = '996555000005';
insert into t.ids select 'outsider', id from auth.users where phone = '996555000006';

select t.eq((select count(*) from public.profiles)::int, 6, 'профили созданы триггером');
select t.eq((select phone from public.profiles where id = t.id('seller')), '996555000001', 'телефон перенесён в профиль');

insert into public.admins (user_id, role) values (t.id('admin'), 'admin'), (t.id('moder'), 'moderator');

-- Фото, «загруженные» в Storage.
insert into storage.objects (bucket_id, name, owner)
select 'listing-images', t.id('seller')::text || '/' || gen_random_uuid() || '.jpg', t.id('seller')
from generate_series(1, 12);
insert into storage.objects (bucket_id, name, owner)
values ('listing-images', t.id('buyer')::text || '/11111111-1111-1111-1111-111111111111.jpg', t.id('buyer')),
       ('receipts', t.id('seller')::text || '/22222222-2222-2222-2222-222222222222.jpg', t.id('seller'));

create table t.imgs as
  select name, row_number() over (order by name) as n from storage.objects
  where bucket_id = 'listing-images' and owner = (select id from t.ids where name = 'seller');
grant select on t.imgs to authenticated;
create function t.imgs(p_from int, p_to int) returns text[] language sql stable as $$
  select array_agg(name order by n) from t.imgs where n between p_from and p_to $$;
grant execute on function t.imgs(int, int) to authenticated;

-- Хелпер вызова create_listing с разумными значениями по умолчанию.
create function t.create(p_days int, p_imgs text[], p_title text default 'iPhone 13 Pro 256GB',
  p_req uuid default null, p_phone text default '996555000001', p_region text default 'bishkek',
  p_price bigint default 45000, p_neg boolean default false, p_cat smallint default 2)
returns uuid language sql as $$
  select public.create_listing(p_title, p_cat, 'Отличное состояние, полный комплект', p_price, p_neg,
    p_phone, '996555000001', p_region, 'Бишкек', 'Чуй', '120', p_days, p_imgs, 0, p_req)
$$;
grant execute on function t.create(int, text[], text, uuid, text, text, bigint, boolean, smallint) to authenticated;

-- ===========================================================================
\echo '1. Анонимный посетитель'
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select t.eq((select count(*) from public.categories)::int, 20, 'anon видит 20 категорий');
select t.eq((select count(*) from public.regions)::int, 9, 'anon видит 9 регионов');
select t.expect_error('select count(*) from public.profiles', 'permission denied');
select t.expect_error($$select public.create_listing('x',1::smallint,'',1,false,'996555000001','996555000001','bishkek','a','b',null,1,array['x'],0,null)$$, 'permission denied');
select t.expect_error('select public.review_topup(gen_random_uuid(), true, null)', 'permission denied');
reset role;

-- ===========================================================================
\echo '2. Профиль: только свои поля, баланс и статус недоступны'
set role authenticated;
select t.as_user('seller');
update public.profiles set first_name = ' Азамат ', last_name = 'Токтогулов', birth_year = 1995, gender = 'male'
 where id = t.id('seller');
select t.eq((select first_name from public.profiles where id = t.id('seller')), 'Азамат', 'имя сохранено и обрезано');
select t.expect_error($$update public.profiles set balance = 100000 where id = t.id('seller')$$, 'permission denied');
select t.expect_error($$update public.profiles set status = 'active' where id = t.id('seller')$$, 'permission denied');
select t.expect_error($$update public.profiles set phone = '996700000000' where id = t.id('seller')$$, 'permission denied');
select t.expect_error($$update public.profiles set birth_year = 2999 where id = t.id('seller')$$, 'birth_year');
select t.expect_error($$update public.profiles set email = 'a@mail.ru' where id = t.id('seller')$$, 'profiles_email_check');
update public.profiles set email = 'Azamat@Gmail.com' where id = t.id('seller');
select t.eq((select email from public.profiles where id = t.id('seller')), 'azamat@gmail.com', 'gmail сохранён');
-- Чужой профиль не виден и не меняется.
select t.eq((select count(*) from public.profiles)::int, 1, 'видит только свой профиль');
update public.profiles set first_name = 'Hacker' where id = t.id('buyer');
select t.expect_error($$insert into public.transactions (user_id, type, amount, balance_before, balance_after) values (t.id('seller'), 'topup', 1000, 0, 1000)$$, 'permission denied');
select t.expect_error($$insert into public.admins (user_id, role) values (t.id('seller'), 'admin')$$, 'permission denied');
select t.eq(public.is_staff(), false, 'продавец не персонал');
-- Публичный профиль: только имя и аватар.
select t.eq((select first_name from public.public_profiles where id = t.id('seller')), 'Азамат', 'публичное имя');
select t.expect_error('select phone from public.public_profiles', 'column "phone" does not exist');

select t.as_user('buyer');
update public.profiles set first_name = 'Бакыт', last_name = 'Осмонов', birth_year = 2000, gender = 'female' where id = t.id('buyer');
select t.as_user('outsider');
update public.profiles set first_name = 'Чужой', last_name = 'Человек', birth_year = 1990, gender = 'male' where id = t.id('outsider');
reset role;
select t.eq((select first_name from public.profiles where id = t.id('buyer')), 'Бакыт', 'чужой профиль не перезаписан');

-- Даже service-код без доверенной функции не может менять баланс.
select t.expect_error($$update public.profiles set balance = 5 where id = (select id from t.ids where name='seller')$$, 'forbidden');

-- ===========================================================================
\echo '3. Публикация без денег: ничего не создаётся и не списывается'
set role authenticated;
select t.as_user('seller');
select t.expect_error($$select t.create(7, t.imgs(1,3))$$, 'insufficient_funds');
select t.eq((select count(*) from public.listings)::int, 0, 'объявление не создано');
select t.eq((select balance from public.profiles where id = t.id('seller')), 0::bigint, 'баланс не изменился');

\echo '4. Валидация объявления'
select t.expect_error($$select t.create(0, t.imgs(1,3))$$, 'bad_days');
select t.expect_error($$select t.create(31, t.imgs(1,3))$$, 'bad_days');
select t.expect_error($$select t.create(7, t.imgs(1,3), 'ab')$$, 'bad_title');
select t.expect_error($$select t.create(7, t.imgs(1,3), p_phone => '+996555000001')$$, 'bad_phone');
select t.expect_error($$select t.create(7, t.imgs(1,3), p_region => 'moscow')$$, 'bad_region');
select t.expect_error($$select t.create(7, t.imgs(1,3), p_price => -5)$$, 'bad_price');
select t.expect_error($$select t.create(7, t.imgs(1,3), p_price => 100, p_neg => true)$$, 'bad_price');
select t.expect_error($$select t.create(7, t.imgs(1,3), p_cat => 99::smallint)$$, 'bad_category');
select t.expect_error($$select t.create(7, t.imgs(1,11))$$, 'bad_images');
select t.expect_error($$select t.create(7, array[]::text[])$$, 'bad_images');
select t.expect_error($$select t.create(7, array[(select name from storage.objects where owner = t.id('buyer') limit 1)])$$, 'bad_image');
select t.expect_error($$select t.create(7, array[t.id('seller')::text || '/nonexistent.jpg'])$$, 'bad_image');
reset role;

-- ===========================================================================
\echo '5. Пополнение баланса'
set role authenticated;
select t.as_user('seller');
select t.eq((select count(*) from public.payment_methods)::int, 0, 'выключенные способы не видны пользователю');
select t.expect_error($$select public.create_topup_request((select id from public.payment_methods limit 1), 1000, 'TX1')$$, 'bad_method');

select t.as_user('moder');
select t.expect_error($$update public.payment_methods set is_enabled = true where code = 'mbank'$$, 'permission denied');
select t.as_user('admin');
select t.eq((select count(*) from public.payment_methods)::int, 7, 'admin видит все 7 банков');
select t.expect_error($$update public.payment_methods set is_enabled = true where code = 'mbank'$$, 'payment_methods_enabled_complete');
update public.payment_methods set recipient_name = 'ОсОО Табылга', account_number = '1234567890123456', is_enabled = true where code = 'mbank';
reset role;
insert into t.ids select 'mbank', id from public.payment_methods where code = 'mbank';
select t.eq((select count(*) from public.moderation_logs where action = 'payment_method_update')::int, 1, 'изменение реквизитов в журнале');

set role authenticated;
select t.as_user('seller');
select t.eq((select count(*) from public.payment_methods)::int, 1, 'пользователь видит включённый банк');
select t.expect_error($$update public.payment_methods set account_number = '0000' where code = 'mbank'$$, 'permission denied');
select t.expect_error($$select public.create_topup_request(t.id('mbank'), 1000)$$, 'proof_required');
select t.expect_error($$select public.create_topup_request(t.id('mbank'), 0, 'TX1')$$, 'bad_amount');
select t.expect_error($$select public.create_topup_request(t.id('mbank'), 1000, null, (select id from t.ids where name='buyer')::text || '/x.jpg')$$, 'bad_image');
insert into t.ids values ('topup1', public.create_topup_request(t.id('mbank'), 1000, 'TX-777'));
insert into t.ids values ('topup2', public.create_topup_request(t.id('mbank'), 500, null,
  t.id('seller')::text || '/22222222-2222-2222-2222-222222222222.jpg'));
select t.eq((select status::text from public.topup_requests where id = t.id('topup1')), 'pending', 'заявка на проверке');
select t.eq((select balance from public.profiles where id = t.id('seller')), 0::bigint, 'чек сам по себе денег не даёт');
select t.expect_error($$select public.review_topup(t.id('topup1'), true)$$, 'forbidden');

select t.as_user('moder');
select t.expect_error($$select public.review_topup(t.id('topup1'), true)$$, 'forbidden');
select t.eq((select count(*) from public.topup_requests)::int, 0, 'модератор не видит заявки');

select t.as_user('admin');
select public.review_topup(t.id('topup1'), true);
select t.expect_error($$select public.review_topup(t.id('topup1'), true)$$, 'already_reviewed');
select t.expect_error($$select public.review_topup(t.id('topup1'), false, 'дубль')$$, 'already_reviewed');
select t.expect_error($$select public.review_topup(t.id('topup2'), false)$$, 'reason_required');
select public.review_topup(t.id('topup2'), false, 'Чек не читается');
reset role;
select t.eq((select balance from public.profiles where id = t.id('seller')), 1000::bigint, 'зачислено ровно один раз');
select t.eq((select count(*) from public.transactions where topup_request_id = t.id('topup1'))::int, 1, 'одна транзакция пополнения');
select t.eq((select reject_reason from public.topup_requests where id = t.id('topup2')), 'Чек не читается', 'причина отказа сохранена');
select t.eq((select count(*) from public.notifications where user_id = t.id('seller') and type in ('topup_approved','topup_rejected'))::int, 2, 'уведомления о заявках');
-- Защита на уровне базы: вторая транзакция по той же заявке невозможна.
select t.expect_error($$select public._apply_balance_change((select id from t.ids where name='seller'), 1000, 'topup', 'дубль', p_topup => (select id from t.ids where name='topup1'))$$, 'transactions_topup_once');

-- ===========================================================================
\echo '6. Публикация с оплатой и идемпотентность'
set role authenticated;
select t.as_user('seller');
insert into t.ids values ('req1', gen_random_uuid());
insert into t.ids values ('l1', t.create(7, t.imgs(1,3), p_req => t.id('req1')));
select t.eq((select balance from public.profiles where id = t.id('seller')), 860::bigint, 'списано 7 × 20 = 140');
select t.eq(t.create(7, t.imgs(4,6), p_req => t.id('req1')), t.id('l1'), 'повтор формы возвращает то же объявление');
select t.eq((select balance from public.profiles where id = t.id('seller')), 860::bigint, 'повтор не списал второй раз');
select t.eq((select status::text from public.listings where id = t.id('l1')), 'pending_moderation', 'ждёт модерации');
select t.eq((select count(*) from public.listing_images where listing_id = t.id('l1') and is_main)::int, 1, 'одно главное фото');
select t.expect_error($$select t.create(7, t.imgs(1,1))$$, 'bad_image');  -- фото уже в другом объявлении
select t.eq((select balance_before || '->' || balance_after from public.transactions where listing_id = t.id('l1')), '1000->860', 'журнал: старый и новый баланс');
select t.expect_error($$select public.moderate_listing(t.id('l1'), true)$$, 'forbidden');

select t.as_user('buyer');
select t.eq((select count(*) from public.listings)::int, 0, 'чужое объявление на модерации не видно');
select t.eq((select count(*) from public.transactions)::int, 0, 'чужие транзакции не видны');
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select t.eq((select count(*) from public.listings)::int, 0, 'anon не видит неодобренное');
reset role;

-- ===========================================================================
\echo '7. Модерация и выдача'
set role authenticated;
select t.as_user('moder');
select public.moderate_listing(t.id('l1'), true);
select t.expect_error($$select public.moderate_listing(t.id('l1'), true)$$, 'bad_status');
reset role;
select t.eq((select status::text from public.listings where id = t.id('l1')), 'active', 'активно');
select t.eq((select round(extract(epoch from expires_at - published_at) / 86400) from public.listings where id = t.id('l1')), 7::numeric, 'срок 7 дней от одобрения');

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select t.eq((select count(*) from public.listings)::int, 1, 'anon видит активное');
select t.eq((select count(*) from public.listing_images)::int, 3, 'anon видит фото активного');
select t.eq((select count(*) from public.search_listings('iphone'))::int, 1, 'поиск по названию');
select t.eq((select count(*) from public.search_listings('комплект'))::int, 1, 'поиск по описанию');
select t.eq((select count(*) from public.search_listings('телефон'))::int, 1, 'поиск по категории');
select t.eq((select count(*) from public.search_listings('ipho'))::int, 1, 'поиск по началу слова');
select t.eq((select count(*) from public.search_listings('samsung'))::int, 0, 'нет лишних совпадений');
select t.eq((select count(*) from public.search_listings(null, 2::smallint))::int, 1, 'фильтр категории');
select t.eq((select count(*) from public.search_listings(null, 3::smallint))::int, 0, 'другая категория пуста');
select t.eq((select count(*) from public.search_listings(null, null, 'osh'))::int, 0, 'фильтр региона');
select t.eq((select count(*) from public.search_listings('%_\'))::int, 0, 'спецсимволы в поиске безопасны');
select t.eq((select count(*) from public.search_listings(null, null, null, 'random', 'seed1'))::int, 1, 'рекомендации');
reset role;

-- ===========================================================================
\echo '8. Избранное'
set role authenticated;
select t.as_user('buyer');
insert into public.favorites (user_id, listing_id) values (t.id('buyer'), t.id('l1'));
select t.expect_error($$insert into public.favorites (user_id, listing_id) values (t.id('seller'), t.id('l1'))$$, 'row-level security');
select t.eq((select count(*) from public.favorites)::int, 1, 'избранное сохранено');
select t.as_user('seller');
select t.eq((select count(*) from public.favorites)::int, 0, 'чужое избранное не видно');
reset role;

-- ===========================================================================
\echo '9. Чат'
set role authenticated;
select t.as_user('seller');
select t.expect_error($$select public.start_chat(t.id('l1'))$$, 'own_listing');
select t.as_user('buyer');
insert into t.ids values ('chat1', public.start_chat(t.id('l1')));
select t.eq(public.start_chat(t.id('l1')), t.id('chat1'), 'повторно — тот же чат');
select t.expect_error($$select public.send_message(t.id('chat1'), '   ')$$, 'bad_message');
select public.send_message(t.id('chat1'), 'Здравствуйте! Хочу купить «iPhone 13 Pro 256GB».');
select public.send_message(t.id('chat1'), 'Ещё актуально?');
select t.as_user('seller');
select t.eq((select unread_count from public.get_my_chats() where chat_id = t.id('chat1')), 2, '2 непрочитанных у продавца');
select t.eq((select other_first_name from public.get_my_chats()), 'Бакыт', 'имя собеседника');
select t.eq((select count(*) from public.notifications where type = 'new_message' and read_at is null)::int, 1, 'одно уведомление на чат');
select public.mark_chat_read(t.id('chat1'));
select t.eq((select unread_count from public.get_my_chats() where chat_id = t.id('chat1')), 0, 'прочитано');
select public.send_message(t.id('chat1'), 'Да, актуально');
select t.as_user('outsider');
select t.eq((select count(*) from public.messages)::int, 0, 'посторонний не видит сообщения');
select t.eq((select count(*) from public.chats)::int, 0, 'посторонний не видит чат');
select t.expect_error($$select public.send_message(t.id('chat1'), 'спам')$$, 'forbidden');
select t.as_user('admin');
select t.eq((select count(*) from public.messages where chat_id is not null)::int, 0, 'персонал не читает личную переписку');
reset role;

-- ===========================================================================
\echo '10. Жалобы'
set role authenticated;
select t.as_user('seller');
select t.expect_error($$select public.report_listing(t.id('l1'), 'fraud')$$, 'own_listing');
select t.as_user('buyer');
insert into t.ids values ('rep1', public.report_listing(t.id('l1'), 'fraud', 'Подозрительно низкая цена'));
select t.eq(public.report_listing(t.id('l1'), 'spam'), t.id('rep1'), 'вторая открытая жалоба не дублируется');
select t.expect_error($$select public.resolve_report(t.id('rep1'), false)$$, 'forbidden');
select t.as_user('moder');
select public.resolve_report(t.id('rep1'), false);
select t.expect_error($$select public.resolve_report(t.id('rep1'), true, 'x')$$, 'already_reviewed');
reset role;
select t.eq((select status::text from public.listings where id = t.id('l1')), 'active', 'после жалобы оставлено');

-- ===========================================================================
\echo '11. Отклонение активного: возврат за неиспользованные дни'
set role authenticated;
select t.as_user('moder');
select t.expect_error($$select public.moderate_listing(t.id('l1'), false)$$, 'reason_required');
select public.moderate_listing(t.id('l1'), false, 'Запрещённый товар');
select t.expect_error($$select public.moderate_listing(t.id('l1'), false, 'ещё раз')$$, 'bad_status');
reset role;
-- Прошло несколько секунд из 7 дней: полных неиспользованных дней 6 → 6 × 20 = 120.
select t.eq((select balance from public.profiles where id = t.id('seller')), 980::bigint, '860 + 120 возврат');
select t.eq((select count(*) from public.transactions where listing_id = t.id('l1') and type = 'refund')::int, 1, 'один возврат');
select t.expect_error($$select public._refund_listing((select l from public.listings l where id = (select id from t.ids where name='l1')), true, 'дубль')$$, 'transactions_listing_refund_once');

\echo '12. Повторное размещение и удаление до модерации'
set role authenticated;
select t.as_user('buyer');
select t.expect_error($$select public.relist_listing(t.id('l1'), 3)$$, 'forbidden');
select t.as_user('seller');
select t.eq((select rejection_reason from public.listings where id = t.id('l1')), 'Запрещённый товар', 'причина видна владельцу');
select t.expect_error($$select public.relist_listing(t.id('l1'), 99)$$, 'bad_days');
select public.relist_listing(t.id('l1'), 3);
select t.eq((select balance from public.profiles where id = t.id('seller')), 920::bigint, 'списано 60');
select t.expect_error($$select public.relist_listing(t.id('l1'), 3)$$, 'bad_status');
select public.delete_listing(t.id('l1'));
select t.eq((select balance from public.profiles where id = t.id('seller')), 980::bigint, 'удаление до модерации — полный возврат');
select t.eq((select count(*) from public.listings where id = t.id('l1'))::int, 0, 'удалённое скрыто от владельца');
select t.expect_error($$select public.delete_listing(t.id('l1'))$$, 'not_found');
reset role;

-- ===========================================================================
\echo '13. Автозавершение по сроку'
set role authenticated;
select t.as_user('seller');
insert into t.ids values ('l2', t.create(1, t.imgs(7,8), 'Велосипед горный'));
select t.as_user('moder');
select public.moderate_listing(t.id('l2'), true);
reset role;
select t.eq((select balance from public.profiles where id = t.id('seller')), 960::bigint, 'списано 20 за 1 день');
select t.eq(public.expire_listings(), 0, 'пока рано завершать');
select t.eq((select count(*) from public.notifications where type = 'listing_expiring')::int, 1, 'напоминание за сутки');
select t.eq(public.expire_listings(), 0, 'напоминание не дублируется');
select t.eq((select count(*) from public.notifications where type = 'listing_expiring')::int, 1, 'одно напоминание');
update public.listings set expires_at = now() - interval '1 minute' where id = t.id('l2');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select t.eq((select count(*) from public.listings)::int, 0, 'истёкшее скрыто ещё до планировщика');
reset role;
select t.eq(public.expire_listings(), 1, 'одно завершено');
select t.eq((select status::text from public.listings where id = t.id('l2')), 'expired', 'статус expired');
select t.eq((select count(*) from public.notifications where type = 'listing_expired')::int, 1, 'уведомление о завершении');

-- ===========================================================================
\echo '14. Блокировка и ручная корректировка баланса'
set role authenticated;
select t.as_user('moder');
select t.expect_error($$select public.admin_set_block(t.id('buyer'), true, 'спам')$$, 'forbidden');
select t.expect_error($$select public.admin_adjust_balance(t.id('buyer'), 100, 'бонус')$$, 'forbidden');
select t.as_user('admin');
select t.expect_error($$select public.admin_set_block(t.id('buyer'), true)$$, 'reason_required');
select t.expect_error($$select public.admin_set_block(t.id('admin'), true, 'сам себя')$$, 'forbidden');
select public.admin_set_block(t.id('buyer'), true, 'Мошенничество');
select t.expect_error($$select public.admin_adjust_balance(t.id('buyer'), -50, 'штраф')$$, 'insufficient_funds');
select t.expect_error($$select public.admin_adjust_balance(t.id('buyer'), 50, '  ')$$, 'reason_required');
select t.expect_error($$select public.admin_adjust_balance(t.id('buyer'), 0, 'ноль')$$, 'bad_amount');
select t.eq(public.admin_adjust_balance(t.id('buyer'), 300, 'Компенсация'), 300::bigint, 'начислено');
select t.eq(public.admin_adjust_balance(t.id('buyer'), -100, 'Корректировка'), 200::bigint, 'списано');

select t.as_user('buyer');
select t.expect_error($$select public.send_message(t.id('chat1'), 'привет')$$, 'account_blocked');
select t.expect_error($$select public.create_listing('Товар', 1::smallint, '', 100, false, '996555000002', '996555000002', 'bishkek', 'Бишкек', 'Ленина', null, 1, array[t.id('buyer')::text || '/11111111-1111-1111-1111-111111111111.jpg'], 0, null)$$, 'account_blocked');
-- В поддержку писать можно.
insert into t.ids values ('sup1', public.open_support_chat('block'));
select public.send_support_message(t.id('sup1'), 'Почему меня заблокировали?');
select t.eq((select count(*) from public.notifications where type = 'account_blocked')::int, 1, 'уведомление о блокировке');
select t.eq((select string_agg(type::text || ':' || amount, ',' order by id) from public.transactions), 'admin_credit:300,admin_debit:-100', 'своя история операций');

select t.as_user('moder');
select public.send_support_message(t.id('sup1'), 'Ваш аккаунт проверяется.');
select t.as_user('outsider');
select t.expect_error($$select public.send_support_message(t.id('sup1'), 'я тоже')$$, 'forbidden');
select t.eq((select count(*) from public.support_chats)::int, 0, 'чужие обращения не видны');
select t.as_user('buyer');
select t.eq((select count(*) from public.messages where support_chat_id = t.id('sup1'))::int, 2, 'переписка с поддержкой');
select t.eq((select count(*) from public.notifications where type = 'support_reply')::int, 1, 'уведомление об ответе поддержки');
select t.as_user('admin');
select public.admin_set_block(t.id('buyer'), false);
reset role;
select t.eq((select status::text from public.profiles where id = t.id('buyer')), 'active', 'разблокирован');

-- ===========================================================================
\echo '15. Профиль не заполнен'
set role authenticated;
select t.as_user('newbie');
select t.expect_error($$select public.create_listing('Товар', 1::smallint, '', 100, false, '996555000005', '996555000005', 'bishkek', 'Бишкек', 'Ленина', null, 1, array['x'], 0, null)$$, 'profile_incomplete');
reset role;

-- ===========================================================================
\echo '16. Финансовый журнал сходится с балансами'
select t.eq(
  (select count(*) from public.profiles p
    where p.balance <> coalesce((select sum(amount) from public.transactions x where x.user_id = p.id), 0))::int,
  0, 'сумма операций = баланс у всех пользователей');
select t.eq(
  (select count(*) from public.transactions where balance_after <> balance_before + amount)::int, 0, 'арифметика журнала');
select t.eq(
  (select count(*) from public.moderation_logs where actor_id is null)::int, 0, 'у каждого действия есть исполнитель');

-- ===========================================================================
\echo '17. Хранилище: только своя папка, чеки приватны'
set role authenticated;
select t.as_user('buyer');
insert into storage.objects (bucket_id, name, owner)
values ('listing-images', t.id('buyer')::text || '/33333333-3333-3333-3333-333333333333.webp', t.id('buyer'));
select t.expect_error($$insert into storage.objects (bucket_id, name) values ('listing-images', t.id('seller')::text || '/44444444-4444-4444-4444-444444444444.jpg')$$, 'row-level security');
select t.expect_error($$insert into storage.objects (bucket_id, name) values ('listing-images', t.id('buyer')::text || '/evil.php')$$, 'row-level security');
select t.expect_error($$insert into storage.objects (bucket_id, name) values ('payment-qr', t.id('buyer')::text || '/55555555-5555-5555-5555-555555555555.png')$$, 'row-level security');
select t.eq((select count(*) from storage.objects where bucket_id = 'receipts')::int, 0, 'чужие чеки не видны');
select t.as_user('seller');
select t.eq((select count(*) from storage.objects where bucket_id = 'receipts')::int, 1, 'свой чек виден');
-- Фото, привязанное к объявлению, удалить нельзя (иначе объявление «сломается»).
delete from storage.objects where name = (select path from public.listing_images where listing_id = t.id('l2') limit 1);
select t.as_user('admin');
select t.eq((select count(*) from storage.objects where bucket_id = 'receipts')::int, 1, 'admin видит чек');
reset role;
select t.eq((select count(*) from storage.objects o join public.listing_images li on li.path = o.name where li.listing_id = t.id('l2'))::int, 2, 'фото объявления на месте');

\echo 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ'
