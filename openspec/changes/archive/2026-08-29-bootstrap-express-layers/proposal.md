## Why

Репозиторий пока содержит только заготовку `package.json` без приложения: нельзя проверить TypeScript, HTTP-слой и единый формат ошибок. Первый этап нужен, чтобы поднять собираемый Express-сервер без PostgreSQL и без доменного API, на котором дальше наращивать config, слои и домен.

## What Changes

- Инициализировать Node.js + TypeScript (strict) проект со скриптами `dev` / `build` / `start`.
- Ввести слоистую структуру каталогов под код в `src/` (`config`, `http`, `services`, `repositories`, `domain`, `entities`) и пустые `migrations/` и `seeds/`.
- Добавить валидируемый env-конфиг (без чтения `process.env` в http/services).
- Поднять HTTP-сервер Express с JSON, единым error handler и телом `{ "error": string, "statusCode": number }`.
- Добавить единственный публичный маршрут этапа: `GET /health` → `200 { "status": "ok" }`.
- Неизвестный путь и необработанные ошибки отдавать тем же JSON-форматом; клиенту на 500 не отдавать стек и внутренние детали.
- Подключить логгер ошибок без логирования пароля, хэша, JWT и токенов.

## Non-goals

- TypeORM, DataSource, `synchronize`, миграции, Docker Compose / образ приложения.
- Сущности User / BankAccount / Transaction и доменные эндпоинты auth, счетов, переводов, баланса, истории.
- Swagger / OpenAPI, README с описанием архитектуры, unit-тесты домена.
- NestJS, MongoDB, Redis, GraphQL, OAuth2, refresh-токены, подтверждение email, сброс пароля, эндпоинт депозита, фронтенд.

## Capabilities

### New Capabilities

- `app-config`: загрузка и валидация переменных окружения; приложение стартует без PostgreSQL.
- `http-runtime`: Express HTTP-сервер, JSON, единый формат ошибок, health, логирование ошибок без секретов.

### Modified Capabilities

- (нет существующих specs)

## Impact

- Новый код в `src/` (точка входа, config, HTTP middleware/маршруты); пустые каталоги слоёв, `migrations/`, `seeds/`.
- Зависимости: Express, dotenv, zod (или аналог), pino или winston; TypeScript, tsx/ts-node-dev, `@types/*`.
- `package.json` скрипты `dev`, `build`, `start`; `tsconfig` со `strict`.
- Публичный HTTP: только `GET /health`; прочие пути — JSON-ошибка (как правило 404).
- TypeORM и БД не подключаются; процесс не требует живого PostgreSQL для старта.
