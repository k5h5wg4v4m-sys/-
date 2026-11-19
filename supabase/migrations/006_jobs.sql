-- TABYLGA 006: фоновые задачи и Realtime.
--
-- 1) Автозавершение объявлений каждые 5 минут через pg_cron.
--    Даже если планировщик задержится, истёкшие объявления не видны: RLS и поиск проверяют expires_at > now().
-- 2) Realtime для сообщений, участников чатов (статус прочтения), обращений и уведомлений.
--    Realtime учитывает RLS: каждый получает только то, что ему разрешено читать.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'tabylga-expire-listings';
    perform cron.schedule('tabylga-expire-listings', '*/5 * * * *', 'select public.expire_listings()');
  else
    raise notice 'pg_cron недоступен: включите его в Supabase (Database → Extensions) и примените миграцию снова';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.messages, public.chat_members, public.support_chats, public.notifications;
  end if;
end $$;
