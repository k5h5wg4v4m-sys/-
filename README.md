# Tabylga

Маркетплейс объявлений Кыргызстана. Правила разработки: `CLAUDE.md`.

## Запуск

```bash
npm install
cp .env.example .env.local   # заполните NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

## Вход по телефону

Настройка Supabase Auth, SMS-провайдера и тестовых номеров: `supabase/AUTH.md`.

## Структура

- `src/app/(main)` — экраны с навигацией (нижнее меню на телефоне, боковое на компьютере)
- `src/app/(auth)` — вход, регистрация, восстановление пароля, анкета (без меню)
- `messages/ru.json`, `messages/ky.json` — все тексты интерфейса (next-intl, язык в cookie)
- `src/lib/supabase` — клиенты Supabase (браузер / сервер), только anon key
- `src/lib/format.ts` — цена в сомах, даты в Asia/Bishkek, телефон +996
- `src/lib/db-errors.ts` — коды ошибок SQL-функций (переводы в `dbErrors`)
