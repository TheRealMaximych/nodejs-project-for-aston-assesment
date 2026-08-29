## Why

Счета уже создаются и баланс читается, но `POST /transactions` отвечает 404: клиент не может перевести деньги, в том числе на чужой счёт той же валюты. Оценка требует модель Transaction, атомарный перевод с блокировкой (чтобы гонки не давали отрицательный баланс) и строгий контракт ошибок, без депозита и без истории на этом этапе.

## What Changes

- Добавить сущность **Transaction**: UUID `id`, `fromAccount`, `toAccount`, `amount`, `timestamp`, `status` (`Completed` | `Failed`). В PostgreSQL `amount` — `numeric`, не float; в коде и JSON — строка (или decimal-тип), не IEEE `number`.
- Добавить `POST /transactions` **с auth**: тело `{ fromAccount, toAccount, amount }` → `{ transactionId, status }`. `fromAccount` принадлежит текущему пользователю; `toAccount` может быть чужим. Нет эндпоинта депозита.
- Правила: `amount` > 0; `from` ≠ `to`; валюты счетов совпадают — иначе **400**. Чужой `fromAccount` → **403**. Счёт не найден → **404**. Недостаточный баланс → **400**, `error` строго `"Insufficient funds"`. Без/невалидный токен → **401**.
- Атомарно: списание, зачисление и запись транзакции в одной DB-транзакции с `SELECT FOR UPDATE` (или условным `UPDATE` баланса), чтобы параллельные переводы не оставляли отрицательный баланс.
- Миграция TypeORM для таблицы транзакций; `synchronize` остаётся выключенным. FK на счета.
- Unit-тесты service-слоя с замоканным репозиторием: успешный перевод (в том числе на чужой счёт той же валюты), insufficient funds, чужой from, разная валюта, from = to, не найден и прочие доменные ошибки.
- Логи: точно `Transfer completed: from=... to=... amount=...` и `Transfer failed: from=..., reason=...` (например `insufficient funds`); без паролей, хешей, JWT и токенов.
- **BREAKING:** `POST /transactions` больше не unknown-path 404. Без Bearer — 401; с валидным токеном и телом — перевод (или доменная ошибка 400/403/404).

## Non-goals

- `GET /transactions/:accountId` (история). Seed / ненулевой стартовый баланс.
- Эндпоинт депозита, Swagger / OpenAPI, README.
- Refresh-токены, OAuth2, подтверждение email, сброс пароля, Redis-сессии.
- NestJS, MongoDB, Redis, GraphQL, Docker-образ приложения, фронтенд.

## Capabilities

### New Capabilities

- `money-transfers`: аутентифицированный перевод со своего `fromAccount` на любой `toAccount` той же валюты; атомарное списание/зачисление/запись Transaction; 400/403/404 по правилам задания; деньги как numeric/строка; логи без секретов; unit-тесты сервиса.

### Modified Capabilities

- `http-runtime`: `POST /transactions` — доменный маршрут с auth (не 404); health / register / login / logout / accounts без изменения контракта; `GET /transactions/:accountId` по-прежнему недоступен.
- `postgres-typeorm`: таблица транзакций только через версионированную миграцию; DataSource регистрирует Transaction; persistence и блокировки строк только в repository; `synchronize` off.

## Impact

- Код: `src/entities` (Transaction), `src/repositories` (transfer + lock/update баланса), `src/services` (transfer), `src/http/routes` (transactions + `requireAuth`), `src/config/data-source.ts` (entity), `migrations/` (CreateTransactions).
- HTTP: новый контракт `POST /transactions`. Существующие auth- и account-маршруты без изменений.
- Зависимости: новых пакетов не требуется (Zod уже есть). Не добавлять decimal.js, если строка + целочисленные минорные единицы / SQL `numeric` закрывают критерий «не IEEE float».
- Тесты: unit service (успех, insufficient funds, чужой from, разная валюта, from=to, не найден). Существующий HTTP-тест `POST /transactions` → 404 нужно заменить на всё ещё недоступный путь (`GET /transactions/:accountId`).
- `InsufficientFundsError` / `CurrencyMismatchError` / `SameAccountTransferError` / `ForbiddenError` / `NotFoundError` / `ValidationError` и mapper 400/403/404/401 уже есть.
- Схема БД: новая таблица транзакций; `bank_accounts.balance` меняется только этим переводом (депозита нет).
