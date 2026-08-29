## Why

Счета создаются с балансом `0.00`, а эндпоинта депозита нет: после `migration:run` нельзя проверить `POST /transactions` на чужой счёт без ручной правки БД. Оценка требует seed минимум двух счетов разных пользователей с ненулевым балансом и одной валютой.

## What Changes

- Добавить каталог `seeds/` и CLI, который создаёт **двух пользователей** и **по одному счёту** у каждого: ненулевой `numeric` баланс, **одна** валюта, фиксированные идентификаторы (чтобы без `GET /accounts` знать `fromAccount` / `toAccount`).
- Пароли в БД только как **асинхронный bcrypt-хеш**; plaintext и хеш **не логировать**. Известные демо-пароли остаются константами в seed-коде (README в этом change не трогаем).
- Идемпотентность: повторный `npm run seed` не создаёт бесконечные дубликаты (фиксированные email/UUID + upsert). Повторный запуск восстанавливает канонические балансы, чтобы демо перевода снова работало после списаний.
- npm-скрипт `seed` (`tsx` по файлу в `seeds/`). Скрипт инициализирует тот же DataSource, что и приложение, **не** поднимает HTTP.
- Новых миграций нет: таблицы `users` и `bank_accounts` уже есть. `synchronize` остаётся выключенным.

## Non-goals

- Эндпоинт депозита, список счетов, Swagger / OpenAPI, правки README (скрипт `seed` попадёт в README отдельным этапом).
- Docker-образ приложения; Compose по-прежнему только PostgreSQL.
- Seed-строки Transaction / Failed; изменение контрактов REST.
- Refresh-токены, OAuth2, подтверждение email, сброс пароля, Redis-сессии.
- NestJS, MongoDB, Redis, GraphQL, фронтенд.

## Capabilities

### New Capabilities

- `demo-seed`: CLI-seed двух пользователей и двух профинансированных счетов (разные владельцы, одна валюта, numeric-строки); идемпотентный upsert по фиксированным email/UUID; пароли только хеши; логи без секретов; npm-скрипт `seed` без HTTP-сервера.

### Modified Capabilities

- `postgres-typeorm`: TypeORM DataSource / Repository / QueryBuilder **разрешены в CLI `seeds/`** (как в config/repositories), по-прежнему запрещены в HTTP; npm-скрипт `seed` рядом с migration-скриптами; схема по-прежнему только миграциями, без новой миграции в этом change.

## Impact

- Код: `seeds/` (точка входа seed), `package.json` (`seed`). Импорт существующего DataSource, сущностей и `hashPassword`. HTTP-маршруты, сервисы переводов и Swagger без изменений.
- API: контракты не меняются. После `migration:run` + `seed` можно `POST /auth/login` двумя демо-пользователями и `POST /transactions` с чужим `toAccount`.
- Зависимости: новых пакетов нет (`tsx`, TypeORM, bcrypt уже есть).
- Тесты: отдельный HTTP/БД integration-тест не обязателен (критерий — ручной migrate+seed+login+transfer). Unit-тесты сервисов не расширяем ради seed. При выносе чистой функции идемпотентности — опциональный unit без PostgreSQL.
- Схема БД: не меняется; меняются только строки users/bank_accounts.
