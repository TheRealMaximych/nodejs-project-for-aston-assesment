## Why

Оценка требует README **только про запуск**, а в репозитории его нет: новый человек не видит цепочку `.env` → Compose PostgreSQL → миграции → seed → `dev` → JWT и Swagger. Архитектура уже в `AGENTS.md`; README не должен её дублировать.

## What Changes

- Добавить корневой `README.md` как runbook: переменные окружения (копия `.env.example` в локальный `.env`), Docker Compose только для PostgreSQL, миграции, seed, npm-скрипты (`dev`, `build`, `test`, `migrate`, `seed`), путь Swagger UI, как получить JWT через `POST /auth/login`.
- Добавить npm-скрипт **`migrate`**, который применяет pending TypeORM-миграции (тот же эффект, что существующий `migration:run`).
- В README указать демо-email и демо-пароль из seed, чтобы можно было получить `accessToken` без чтения исходников; реальный `.env` и секреты не коммитить.
- Не описывать архитектуру, слои, обоснование стека и не копировать `AGENTS.md`.

## Non-goals

- Рефакторинг кода, новые эндпоинты, эндпоинт депозита.
- Docker-образ приложения; Compose по-прежнему только PostgreSQL.
- NestJS, MongoDB, Redis, GraphQL, OAuth2, refresh-токены, подтверждение email, сброс пароля, фронтенд.
- Правки `AGENTS.md`, OpenAPI-документа, сервисов, репозиториев, миграций схемы и seed-логики (кроме того, что README ссылается на уже существующие команды и демо-учётные данные).

## Capabilities

### New Capabilities

- `runbook-readme`: корневой README только про запуск — env, Compose PostgreSQL, migrate, seed, npm-скрипты, JWT через login, путь Swagger UI; без архитектуры и без коммита секретов.

### Modified Capabilities

- `postgres-typeorm`: документированная команда применения pending-миграций доступна как npm-скрипт `migrate` (эквивалент существующего `migration:run`).
- `demo-seed`: демо-email и plaintext демо-пароль MUST быть указаны в README как локальные credentials для `POST /auth/login`; по-прежнему не логируются и не пишутся в БД в открытом виде.

## Impact

- Файлы: `README.md`, `package.json` (скрипт `migrate`). `.env.example`, `docker-compose.yml`, `seeds/`, маршруты и Swagger без смысловых правок.
- API: контракты не меняются.
- Зависимости: новых пакетов нет.
- Тесты: новых service unit-тестов нет. `npm test` и `npm run build` остаются зелёными. Проверка README — по чеклисту tasks (обязательные секции и команды).
- Секреты: `.env` уже в `.gitignore`; README указывает копировать `.env.example` и не коммитить локальный `.env` / реальный `JWT_SECRET`.
