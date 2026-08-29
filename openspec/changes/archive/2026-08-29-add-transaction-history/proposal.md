## Why

Переводы уже пишут строки Transaction, но `GET /transactions/:accountId` отвечает 404: клиент не может прочитать историю своего счёта. Оценка требует массив с фиксированными полями, отказ в чужой истории (403) и 404, если счёта нет.

## What Changes

- Добавить `GET /transactions/:accountId` **с auth**: ответ — JSON-массив объектов `{ transactionId, fromAccount, toAccount, amount, timestamp, status }`. Только свой счёт. В выборку входят транзакции, где `:accountId` — `fromAccount` **или** `toAccount`. Сортировка: `timestamp` по убыванию.
- Ошибки: без/невалидный токен → **401**; чужой счёт → **403** (не маскировать под 404); счёт не найден → **404**. Пустая история своего счёта → **200** и `[]`.
- `amount` в JSON — десятичная строка, не IEEE `number`. `timestamp` — строка ISO 8601. `status` — `Completed` или `Failed`, как в хранилище. Новых таблиц и миграций нет: используется существующая `transactions`.
- Unit-тесты service-слоя с замоканным репозиторием: свой счёт с операциями; чужой → `ForbiddenError` (403); не найден → `NotFoundError` (404); пустая история.
- **BREAKING:** `GET /transactions/:accountId` больше не unknown-path 404. Без Bearer — 401; со своим счётом — массив истории (возможно пустой).

## Non-goals

- Seed / ненулевой стартовый баланс. Swagger / OpenAPI. README.
- Новые эндпоинты (в том числе депозит, пагинация, фильтры). Новая миграция схемы.
- Refresh-токены, OAuth2, подтверждение email, сброс пароля, Redis-сессии.
- NestJS, MongoDB, Redis, GraphQL, Docker-образ приложения, фронтенд.

## Capabilities

### New Capabilities

- `transaction-history`: аутентифицированная история операций по своему счёту (from или to), сортировка по timestamp DESC, контракт полей задания, 401/403/404, пустой массив для своего счёта без операций, unit-тесты сервиса.

### Modified Capabilities

- `http-runtime`: `GET /transactions/:accountId` — доменный маршрут с auth (не unknown-path 404); health / register / login / logout / accounts / `POST /transactions` без изменения контракта.
- `money-transfers`: снять запрет на успешный `GET /transactions/:accountId`; создание перевода без изменения контракта.

## Impact

- Код: `src/repositories` (list по счёту), `src/services` (get history), `src/http/routes/transactions.ts` (`GET /:accountId` + `requireAuth`). Сущность Transaction и миграция `CreateTransactions` без изменений.
- HTTP: новый контракт `GET /transactions/:accountId`. `POST /transactions` без изменений.
- Зависимости: новых пакетов не требуется.
- Тесты: unit service (свой счёт с операциями, чужой 403, не найден 404, пустая история). Существующий HTTP-тест `GET /transactions/:accountId` → 404 нужно заменить на 401 без Bearer.
- `ForbiddenError` / `NotFoundError` / `ValidationError` / mapper 403/404/400/401 уже есть.
- Схема БД: без изменений; индексы `from_account` / `to_account` уже есть.
