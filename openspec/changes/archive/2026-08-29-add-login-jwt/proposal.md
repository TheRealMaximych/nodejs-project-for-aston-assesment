## Why

Регистрация уже создаёт User с хэшем и `tokenVersion`, но `POST /auth/login` отвечает 404. Без логина клиент не получает JWT `accessToken`, а оценка требует входа `{ email, password }` → `{ accessToken }` и задела в payload для будущего logout через `tokenVersion`.

## What Changes

- Добавить `POST /auth/login` без auth: вход `{ email, password }` → **200** `{ accessToken }`. В JSON нет других полей (нет `id`, email, пароля, хэша, `tokenVersion`).
- Подписать JWT access token (без refresh). Payload содержит `userId` и `tokenVersion`. Секрет и срок жизни только из валидированного конфига (`JWT_SECRET` и TTL в экспортируемом config); HTTP и services не читают `process.env`.
- Неверный email или пароль → **401** в теле `{ "error", "statusCode" }` с одним и тем же смыслом, без утечки, существует ли пользователь.
- Невалидное тело логина (нет `email`/`password`, не email) → **400** (`ValidationError`), как остальная валидация API.
- Лог успеха: `User login successful: userId=...`. Не логировать пароль, хэш, JWT/`accessToken`.
- Сравнение пароля только async (`bcrypt.compare`); синхронный crypto на запросе запрещён.
- Unit-тесты service-слоя с замоканным репозиторием: успех и неверные credentials.
- **BREAKING:** `POST /auth/login` больше не unknown-path 404: при верных данных — 200 `{ accessToken }`, при неверных credentials — 401, при невалидном теле — 400.
- **BREAKING:** процесс не стартует без непустого `JWT_SECRET` в валидированном конфиге (сейчас секрет опционален).

## Non-goals

- Logout, повышение `tokenVersion`, auth middleware на защищённых маршрутах, проверка JWT на `/accounts` и `/transactions`.
- Refresh-токены, OAuth2, подтверждение email, сброс пароля.
- Счета, баланс, переводы, история, seed.
- Swagger / OpenAPI, README.
- NestJS, MongoDB, Redis, GraphQL, Docker-образ приложения, эндпоинт депозита, фронтенд.

## Capabilities

### New Capabilities

- `user-login`: публичный логин, JWT access token с `userId` и `tokenVersion`, секрет/TTL из валидированного конфига, 401 без enumeration, лог без секретов, async compare, unit-тесты сервиса.

### Modified Capabilities

- `http-runtime`: `POST /auth/login` — успешный публичный маршрут (не 404); health и register без изменений; остальные assignment-маршруты (logout, accounts, transactions) по-прежнему недоступны; `JWT_SECRET` обязателен при старте.

## Impact

- Код: `src/config/env.ts` (обязательный `JWT_SECRET`, TTL в config), `src/services` (login, compare, JWT sign), `src/repositories` (lookup хэша и `tokenVersion` без отдачи в HTTP), `src/http/routes/auth.ts` (login).
- Зависимости: `jsonwebtoken` + `@types/jsonwebtoken` (подпись HMAC); bcrypt уже есть — добавить async `compare`.
- HTTP: новый контракт `POST /auth/login`; `GET /health` и `POST /auth/register` без изменений контракта.
- Тесты: unit service с моком репозитория; существующий HTTP-тест «login → 404» нужно снять/заменить, иначе он сломается. HTTP/БД не обязательны как новые интеграционные тесты.
- `UnauthorizedError` / mapper 401 уже есть — логин их использует, не дублирует таблицу статусов.
- `.env.example`: `JWT_SECRET` больше не «unused until auth».
