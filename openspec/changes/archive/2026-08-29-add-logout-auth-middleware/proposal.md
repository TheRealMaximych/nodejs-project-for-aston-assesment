## Why

Логин уже выдаёт JWT с `userId` и `tokenVersion`, но `POST /auth/logout` отвечает 404, а защищённых маршрутов нет: токен нельзя проверить и нельзя отозвать на сервере. Оценка требует logout с инвалидацией текущего access token и auth middleware (401 без/с невалидным токеном, `userId` на `req`).

## What Changes

- Добавить **auth middleware**: заголовок `Authorization: Bearer <accessToken>`; нет Bearer / нет токена / невалидная или просроченная подпись → **401** `{ "error", "statusCode" }`; `tokenVersion` в токене не совпадает с БД → **401**; в `req` — `userId` для следующих хендлеров. JWT и значение `Authorization` не логировать.
- Добавить `POST /auth/logout` **с auth**. Успех повышает `tokenVersion` пользователя в БД; тот же JWT после этого не проходит middleware. Предпочтение — `tokenVersion`, не отдельная таблица сессий.
- Пока нет других защищённых доменных эндпоинтов: middleware проверяется самим logout. Счета и переводы не добавлять.
- Unit-тесты service-слоя с замоканным репозиторием: logout инвалидирует токен (версия растёт); повторное использование старого `tokenVersion` отклоняется (`UnauthorizedError`).
- **BREAKING:** `POST /auth/logout` больше не unknown-path 404. Без Bearer — 401; с валидным токеном — успешный logout; после logout тот же `accessToken` даёт 401.

## Non-goals

- Refresh-токены, OAuth2, подтверждение email, сброс пароля, чёрный список JWT, Redis-сессии.
- Счета, баланс, переводы, история, seed.
- Swagger / OpenAPI, README.
- NestJS, MongoDB, Redis, GraphQL, Docker-образ приложения, эндпоинт депозита, фронтенд.

## Capabilities

### New Capabilities

- `request-auth`: проверка Bearer JWT (подпись, срок, `tokenVersion` против БД), 401 на отсутствие/невалидность/просрочку/рассинхрон версии, `userId` на запросе, без логирования JWT.
- `user-logout`: аутентифицированный `POST /auth/logout` повышает `tokenVersion`; текущий access token становится недействителен; лог без секретов; unit-тесты сервиса.

### Modified Capabilities

- `http-runtime`: `POST /auth/logout` — доменный маршрут с auth (не 404); health / register / login без изменений; `/accounts` и `/transactions` по-прежнему недоступны.

## Impact

- Код: `src/http/middleware` (auth), `src/http/routes/auth.ts` (logout), `src/services` (verify + logout), `src/repositories` (чтение/инкремент `tokenVersion` по `userId`).
- Зависимости: `jsonwebtoken` уже есть (добавить verify через callback/`await`). Новых пакетов не требуется.
- HTTP: новый контракт `POST /auth/logout`; `GET /health`, `POST /auth/register`, `POST /auth/login` без изменений контракта.
- Тесты: unit service (logout + stale `tokenVersion`); существующий HTTP-тест «logout → 404» нужно снять/заменить, иначе он сломается. HTTP/БД не обязательны как новые интеграционные тесты.
- `UnauthorizedError` / mapper 401 уже есть — middleware и logout их используют.
- Схема БД: колонка `token_version` уже есть; новой миграции нет.
- Express `Request`: типизированное поле `userId` после успешного auth.
