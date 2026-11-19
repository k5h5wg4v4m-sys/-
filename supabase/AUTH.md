# Вход по телефону: настройка Supabase Auth и SMS

Регистрация в TABYLGA идёт так: номер +996 → SMS-код → пароль (дважды) → анкета (год рождения, имя, фамилия, отчество, пол) → главная.
Восстановление пароля: номер → SMS-код → новый пароль.
Пароли хранит Supabase Auth (bcrypt), приложение их не видит.

## 1. Ключи проекта

Supabase → Project Settings → API. Скопируйте в `.env.local` (файл не попадает в git):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

`service_role` для этого этапа не нужен. Не вставляйте его в переменные `NEXT_PUBLIC_*`.

## 2. Настройки Authentication

Supabase → Authentication:

| Где | Что поставить |
|---|---|
| Sign In / Providers → **Phone** | Включить. Выбрать SMS-провайдера (раздел 3). |
| Sign In / Providers → **Email** | Можно выключить: Gmail добавляется позже в настройках профиля. |
| Sign In / Providers → **Allow new users to sign up** | Включено. |
| Phone → **SMS OTP Expiry** | 300 секунд (5 минут). |
| Phone → **SMS OTP Length** | **6** (форма ждёт 6 цифр). |
| Phone → **SMS Message** | `TABYLGA: ваш код {{ .Code }}. Никому не сообщайте его.` |
| Passwords → **Minimum password length** | **8** |
| Passwords → **Password requirements** | **Lowercase, uppercase letters, digits and symbols** |
| Rate Limits → **SMS sent** | например, 30 в час (защита от расходов на SMS) |
| URL Configuration → **Site URL** | адрес сайта, например `https://tabylga.kg` |

Сервер Supabase сам проверяет длину и набор символов пароля. Запрет кириллицы и пробелов проверяет форма в браузере: Supabase Auth не умеет запрещать символы.

## 3. SMS-провайдер

Supabase отправляет SMS через внешнего провайдера. Нужен аккаунт у одного из них. Ключи вводятся в Supabase (Authentication → Providers → Phone) и в код проекта не попадают.

| Провайдер | Что понадобится | Замечания для Кыргызстана |
|---|---|---|
| **Twilio** (Programmable Messaging) | Account SID, Auth Token, Message Service SID | Доставляет на +996. Буквенное имя отправителя (Sender ID) нужно регистрировать заранее, иначе SMS придёт с номера. |
| **Twilio Verify** | Account SID, Auth Token, Verify Service SID | Twilio сам генерирует код. Удобно, но дороже за SMS. |
| **Vonage** | API Key, API Secret, From | Работает с +996. |
| **MessageBird** | Access Key, Originator | Работает с +996. |
| **Местный шлюз** (например, Nikita.kg) | Свой API-ключ | Подключается через **Send SMS Hook** (Authentication → Hooks): Supabase вызывает вашу Edge Function, та отправляет SMS через API шлюза. Обычно дешевле и с лучшей доставкой внутри КР. Нужна Edge Function: сделаю её отдельно, когда выберете шлюз. |

Перед запуском проверьте стоимость одной SMS на +996 и пополните баланс у провайдера.

### Тестирование без реальных SMS

Authentication → Providers → Phone → **Test Phone Numbers and OTPs**, например:

```
996555000001=123456
```

На этот номер SMS не отправляется, код всегда `123456`. Удалите тестовые номера перед запуском.

## 4. Проверка

1. `npm run dev`, откройте `/register`.
2. Введите тестовый номер `555 000 001` и код `123456`.
3. Задайте пароль, например `Tabylga@2026`, и заполните анкету. Вы окажетесь на главной.
4. В Supabase → Table Editor → `profiles` появится строка с телефоном `996555000001` и вашими данными.
5. Профиль → «Выйти из аккаунта», затем войдите на `/login` с тем же номером и паролем.
6. `/forgot`: тот же номер и код. Задайте новый пароль и войдите с ним.

## Как это устроено в коде

| Файл | Назначение |
|---|---|
| `src/app/(auth)/login`, `register`, `forgot`, `set-password`, `onboarding` | Экраны входа и регистрации (без нижнего меню) |
| `src/components/auth/*` | Формы, поле телефона +996, поле кода, пароль с индикатором надёжности |
| `src/lib/password.ts` | Правила пароля и уровень надёжности |
| `src/lib/auth-errors.ts` | Ошибки Supabase Auth → понятный текст (`authErrors` в `messages/*.json`) |
| `src/lib/auth.ts` | Текущий пользователь и профиль на сервере, шаг незаконченной регистрации |
| `src/middleware.ts` | Обновление сессии; гостей с `/new`, `/favorites`, `/chats`, `/profile`, `/notifications` ведёт на `/login?next=…` |
| `src/app/(main)/layout.tsx` | Не пускает в приложение, пока не задан пароль и не заполнена анкета |

Анкета сохраняется прямым `update` своей строки `profiles`. Разрешены только личные поля (имя, фамилия, отчество, год рождения, пол, аватар, email). Баланс, статус и телефон защищены правами колонок и триггером `_profiles_guard`. Телефон в профиль копирует триггер из Supabase Auth.
