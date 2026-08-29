## Why

Регистрация, логин и logout уже работают, но `POST /accounts` отвечает 404: клиент не может завести счёт и прочитать баланс. Оценка требует модель BankAccount, два аутентифицированных эндпоинта и отказ в балансе чужого счёта (403), без депозита и без переводов на этом этапе.

## What Changes

- Добавить сущность **BankAccount**: UUID `id`, `accountHolder`, `balance` (по умолчанию 0), `currency`, `userId`, `createdAt`. У пользователя может быть несколько счетов. В PostgreSQL баланс — `numeric`, не float; в коде и JSON — строка (или decimal-тип), не IEEE `number`.
- Добавить `POST /accounts` **с auth**: тело `{ accountHolder, currency }` → `{ id, accountHolder, balance, currency }`. Владелец — `userId` из JWT, не из тела. Новый счёт всегда с балансом 0.
- Добавить `GET /accounts/:id/balance` **с auth**: `{ balance }` только для своего счёта. Счёт не найден → **404**; чужой счёт → **403** (не маскировать под 404); без/невалидный токен → **401**; невалидное тело/валюта/`accountHolder` → **400**.
- Миграция TypeORM для таблицы счетов; `synchronize` остаётся выключенным. FK на `users`.
- Unit-тесты service-слоя с замоканным репозиторием: создание, баланс своего счёта, чужой счёт → `ForbiddenError` (403), не найден → `NotFoundError` (404).
- Лог при создании: точно `Account created: accountId=..., userId=...`.
- **BREAKING:** `POST /accounts` больше не unknown-path 404. Без Bearer — 401; с валидным токеном и телом — создание счёта.

## Non-goals

- Переводы, история транзакций, таблица Transaction.
- Seed / ненулевой стартовый баланс (отдельный этап). Эндпоинт депозита.
- Swagger / OpenAPI, README.
- Refresh-токены, OAuth2, подтверждение email, сброс пароля, Redis-сессии.
- NestJS, MongoDB, Redis, GraphQL, Docker-образ приложения, фронтенд.

## Capabilities

### New Capabilities

- `bank-accounts`: аутентифицированное создание счёта для `userId` из JWT (баланс 0, несколько счетов на пользователя), чтение баланса только своего счёта, 403 на чужой / 404 если нет, деньги как numeric/строка, лог создания без секретов, unit-тесты сервиса.

### Modified Capabilities

- `http-runtime`: `POST /accounts` и `GET /accounts/:id/balance` — доменные маршруты с auth (не 404); health / register / login / logout без изменения контракта; `/transactions` по-прежнему недоступны.
- `postgres-typeorm`: таблица счетов только через версионированную миграцию; DataSource регистрирует BankAccount; persistence только в repository; `synchronize` off.

## Impact

- Код: `src/entities` (BankAccount), `src/repositories` (account repository), `src/services` (create + get balance), `src/http/routes` (accounts + `requireAuth`), `src/config/data-source.ts` (entity), `migrations/` (CreateBankAccounts).
- HTTP: новые контракты `POST /accounts` и `GET /accounts/:id/balance`. Существующие auth-маршруты без изменений.
- Зависимости: новых пакетов не требуется (Zod уже есть). Не добавлять decimal.js, если строка + TypeORM `numeric` transformer закрывают критерий «не IEEE float».
- Тесты: unit service (create, own balance, foreign 403, missing 404). Существующий HTTP-тест `POST /accounts` → 404 нужно заменить на всё ещё недоступный путь (`POST /transactions`).
- `ForbiddenError` / `NotFoundError` / `ValidationError` / mapper 403/404/400/401 уже есть.
- Схема БД: новая таблица счетов; таблица `users` без изменений.
