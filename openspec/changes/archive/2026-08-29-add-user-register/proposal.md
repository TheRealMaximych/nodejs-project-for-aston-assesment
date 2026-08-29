## Why

Каркас уже отдаёт единые ошибки и умеет мапить `ConflictError` на 409, но `POST /auth/register` по-прежнему 404: нет сущности User, миграции `users` и сервисного слоя. Без регистрации нельзя переходить к login/JWT и счетам, а оценка требует создания пользователя с хэшем пароля и отказа по занятому email.

## What Changes

- Добавить `POST /auth/register` без auth: вход `{ email, password }` → **201** `{ id, email }`. В JSON нет `password`, хэша и `tokenVersion`.
- Модель User в БД: UUID `id`, unique `email`, password hash, `createdAt`, `tokenVersion` (задел под logout; не отдавать и не логировать).
- Пароль хэшировать асинхронно (bcrypt или argon2), никогда plaintext; синхронный crypto на запросе запрещён.
- Занятый email → 409 в теле `{ "error", "statusCode" }`; невалидное тело → 400 (`ValidationError`).
- Лог успеха: `User registered: email=...` без пароля и хэша.
- Слойность HTTP → service → repository; TypeORM только в repository/config.
- Миграция TypeORM для таблицы `users`; сущность регистрируется в DataSource.
- Unit-тесты service-слоя с замоканным репозиторием: успех, email занят, валидация.
- **BREAKING:** `POST /auth/register` больше не unknown-path 404; при валидном теле создаёт пользователя (201) или отдаёт 400/409.

## Non-goals

- Login, logout, JWT middleware, подпись/проверка токенов, обязательный `JWT_SECRET`.
- Счета, баланс, переводы, история, seed.
- Swagger / OpenAPI, README.
- NestJS, MongoDB, Redis, GraphQL, OAuth2, refresh-токены, подтверждение email, сброс пароля, Docker-образ приложения, эндпоинт депозита, фронтенд.

## Capabilities

### New Capabilities

- `user-registration`: публичная регистрация, persist User с хэшем и `tokenVersion`, контракт 201 `{ id, email }`, 400/409, лог без секретов, unit-тесты сервиса.

### Modified Capabilities

- `http-runtime`: `POST /auth/register` — успешный публичный маршрут (не 404); health остаётся без auth; остальные assignment-маршруты по-прежнему недоступны.
- `postgres-typeorm`: схема `users` только миграцией (не первой no-op); DataSource регистрирует сущность User; TypeORM по-прежнему вне HTTP/service.

## Impact

- Код: `src/entities` (User), `src/repositories`, `src/services`, `src/http/routes` (auth/register), DataSource `entities`.
- Миграции: новая TypeORM-миграция таблицы `users` (unique email, UUID PK, `tokenVersion`).
- Зависимости: bcrypt или argon2 (async API) + типы.
- HTTP: новый контракт `POST /auth/register`; `GET /health` без изменений.
- Тесты: unit service с моком репозитория; HTTP/БД в этом change не обязательны.
- `ConflictError` / mapper 409 уже есть — регистрация их использует, не дублирует.
