## Why

Оценка требует Swagger / OpenAPI на все боевые эндпоинты, а сейчас HTTP-слой их не описывает: клиент и проверяющий видят только JSON API без схем тел, кодов ошибок и Bearer JWT. Нужно подключить документацию к уже существующим маршрутам, не расширяя домен.

## What Changes

- Подключить OpenAPI 3 и Swagger UI по фиксированному пути **`GET /api-docs`** (без аутентификации, как `/health`).
- Описать **только существующие** маршруты: `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /accounts`, `GET /accounts/:id/balance`, `POST /transactions`, `GET /transactions/:accountId`. Не добавлять в документ несуществующие эндпоинты (список счетов, депозит, refresh и т.п.).
- Для каждого операции: схемы request/response, применимые **400 / 401 / 403 / 404 / 409**, единый пример ошибки `{ "error": string, "statusCode": number }`, Bearer JWT на защищённых.
- Контракты тел совпадают с уже зафиксированными в AGENTS.md и существующих specs (деньги — decimal string; logout — 204 без тела).
- **BREAKING:** `GET /api-docs` больше не unknown-path 404 — отдаёт Swagger UI (HTML). Доменные JSON-контракты не меняются.

## Non-goals

- Новые фичи API, новые доменные маршруты, эндпоинт депозита.
- Правки README (даже строка про `/api-docs`).
- Refresh-токены, OAuth2, подтверждение email, сброс пароля.
- NestJS, MongoDB, Redis, GraphQL, фронтенд.
- Docker-образ приложения; Compose по-прежнему только PostgreSQL.
- Миграции схемы, seed, изменение бизнес-логики сервисов.

## Capabilities

### New Capabilities

- `openapi-swagger`: OpenAPI-документ и Swagger UI на `/api-docs`; покрытие всех боевых эндпоинтов из AGENTS.md плюс существующий `GET /health`; схемы тел; применимые 4xx; Bearer JWT; единый формат ошибки; запрет описывать несуществующие маршруты.

### Modified Capabilities

- `http-runtime`: `GET /api-docs` — известный публичный маршрут (не 404); UI без Bearer; JSON остаётся форматом доменного API, HTML допускается только для Swagger UI.

## Impact

- Код: HTTP-слой (`src/http`) — OpenAPI-документ и монтирование UI; `src/http/app.ts`. Сервисы, репозитории, сущности, миграции, seed без изменений.
- Зависимости: пакет(ы) Swagger UI / OpenAPI для Express (выбор в design).
- API: новые пути только под `/api-docs` (UI и служебные статические ресурсы UI). Контракты register/login/logout/accounts/transactions/health не меняются.
- Тесты: лёгкая проверка, что документ содержит обязательные paths и схему ошибки; новые service unit-тесты не нужны (бизнес-логика не меняется). `npm test` и `npm run build` должны остаться зелёными.
- README не трогаем.
