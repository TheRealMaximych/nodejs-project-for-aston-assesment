# Система управления банковскими счетами и переводами

Backend REST API (оценка J3): регистрация и аутентификация, счета, переводы, баланс и история транзакций.

## Стек (зафиксировано)

- Node.js, TypeScript (strict), Express
- PostgreSQL + TypeORM (миграции TypeORM)
- Swagger (OpenAPI)
- Docker Compose — только PostgreSQL
- Seed-данные — стартовые балансы для переводов

Не делаем, пока явно не попросили: NestJS, MongoDB, Redis, GraphQL, OAuth2, refresh-токены, email, сброс пароля, Docker-образ приложения, эндпоинт депозита, фронтенд.

## Архитектура

HTTP (маршруты, middleware, DTO) → service (бизнес-логика) → repository (TypeORM).

Схема БД меняется только миграциями. Секреты — `.env` через валидированный конфиг.

## Домен

- **User**: id, email (unique), password hash, createdAt; инвалидация JWT через `tokenVersion` (или сессию)
- **BankAccount**: id, accountHolder, balance (default 0), currency, userId, createdAt
- **Transaction**: id, fromAccount, toAccount, amount, timestamp, status (`Completed` | `Failed`)

Деньги: `numeric` в БД, не float. Несколько счетов на пользователя. Перевод **на чужой счёт разрешён**; `fromAccount` — только свой. Валюты счетов должны совпадать. Пополнения в API нет — ненулевой баланс через seed.

## REST

- `POST /auth/register` `{ email, password }` → `{ id, email }`
- `POST /auth/login` → `{ accessToken }`
- `POST /auth/logout` (auth) — токен после этого недействителен
- `POST /accounts` (auth) `{ accountHolder, currency }` → `{ id, accountHolder, balance, currency }`
- `GET /accounts/:id/balance` (auth) → `{ balance }` (только свой счёт)
- `POST /transactions` (auth) `{ fromAccount, toAccount, amount }` → `{ transactionId, status }`
- `GET /transactions/:accountId` (auth) — история своего счёта

Ошибки: `{ error, statusCode }`. Insufficient funds → 400, `"Insufficient funds"`. 401 неаутентифицирован, 403 чужой счёт, 404 нет сущности, 409 email занят.

## Логи (без секретов)

`User registered: email=...` · `User login successful: userId=...` · `Account created: accountId=..., userId=...` · `Transfer completed: from=... to=... amount=...` · `Transfer failed: from=..., reason=...`

## Тесты и документация

Unit-тесты service-слоя (переводы, ошибки, auth), репозитории замоканы. Swagger на все эндпоинты. README только про запуск.
