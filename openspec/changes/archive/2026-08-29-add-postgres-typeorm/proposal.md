## Why

Express-каркас уже слушает HTTP без PostgreSQL, а следующие этапы (счета, переводы) требуют схемы через миграции TypeORM. Сейчас `DATABASE_URL` опционален, DataSource нет, `synchronize` нельзя включить позже «между делом» — нужна явная точка подключения к Postgres с миграциями и без авто-синхронизации схемы.

## What Changes

- Поднять PostgreSQL через `docker-compose.yml` **только** как сервис БД (без образа приложения).
- Сделать `DATABASE_URL` обязательным в валидированном конфиге; `JWT_SECRET` по-прежнему в конфиге и `.env.example`, но **не используется** кодом и **не обязателен** для старта (auth — следующий этап).
- Добавить TypeORM `DataSource` в `src/config` с `synchronize: false`; TypeORM `Repository` / `DataSource` / QueryBuilder — только в `src/repositories` и `src/config`.
- npm-скрипты: generate / run миграций и откат; приложение стартует **после** `DataSource.initialize()`.
- Стартовая миграция: пустая или служебная таблица — **без** User / BankAccount / Transaction.
- Ошибка соединения с БД логируется **без** URL, пароля и прочих секретов; процесс не слушает HTTP, если initialize не удался.

**BREAKING:** процесс больше не стартует без валидного `DATABASE_URL` и без успешного соединения с PostgreSQL (в отличие от этапа bootstrap).

## Non-goals

- Сущности домена User / BankAccount / Transaction и любые доменные эндпоинты (auth, счета, переводы, баланс, история).
- Seed-данные со счетами и балансами.
- Swagger / OpenAPI, README (даже только про запуск).
- Автопрогон миграций при старте приложения; health, который пингует БД.
- NestJS, MongoDB, Redis, GraphQL, OAuth2, refresh-токены, подтверждение email, сброс пароля, Docker-образ приложения, эндпоинт депозита, фронтенд.

## Capabilities

### New Capabilities

- `postgres-typeorm`: Docker Compose PostgreSQL, TypeORM DataSource без `synchronize`, миграции (generate/run/revert), initialize при старте, слойность TypeORM, логирование ошибок соединения без секретов.

### Modified Capabilities

- `app-config`: `DATABASE_URL` обязателен; `.env.example` описывает рабочие ключи подключения (и `JWT_SECRET` как задел под auth). Убирается требование «старт без PostgreSQL / без использования DATABASE_URL».
- `http-runtime`: готовность HTTP **после** успешного соединения с БД; `GET /health` остаётся 200 `{ "status": "ok" }` только у уже стартовавшего процесса. Сценарий «health при выключенной БД» снимается.

## Impact

- Новые файлы: `docker-compose.yml`, `src/config` DataSource, каталог `migrations/` с первой миграцией, npm-скрипты TypeORM.
- Зависимости: `typeorm`, `pg`, `reflect-metadata` (под сущности следующих этапов); CLI TypeORM через существующий `tsx`.
- `src/index.ts`: initialize DataSource → затем `listen`; HTTP-контракт `GET /health` не меняется по телу.
- `tsconfig`: декораторы / `emitDecoratorMetadata` для TypeORM (сущности ещё не добавляются).
- Конфиг: `DATABASE_URL` required; слои `http` / `services` по-прежнему не читают `process.env`.
