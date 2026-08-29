## Context

HTTP already returns `{ "error", "statusCode" }` for `AppError` (any caller-supplied status) and for unknown errors (500 + pino with redact). `not-found` throws `AppError("Not Found", 404)`. Доменных маршрутов нет. Контракты — в дельтах `domain-errors` и `http-runtime`. Мотивация — в `proposal.md`.

Ограничения: статус HTTP не должен жить в domain; TypeORM/SQL не в HTTP; JWT и эндпоинты вне скоупа; секреты не в логах.

## Goals / Non-Goals

**Goals:**

- Иерархия `DomainError` без `statusCode`; таблица маппинга только в HTTP.
- Один чистый mapper + Express error middleware; 404 unknown path через `NotFoundError`.
- Unit-тесты mapper/handler без сервера и без БД.

**Non-Goals:**

- Auth middleware, проверка JWT, сервисы, репозитории, миграции, seed, Swagger.
- Логирование каждого 4xx как business event (это этапы auth/transfer).

## Decisions

### 1. DomainError без HTTP-статуса

**Выбор:** заменить `AppError` на базовый `DomainError extends Error` (поле `statusCode` убрать). Классы-наследники: `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `InsufficientFundsError`, `CurrencyMismatchError`, `SameAccountTransferError`. Все — siblings под `DomainError`, не наследовать insufficient funds от validation.

`InsufficientFundsError` задаёт `message` только как `"Insufficient funds"` (конструктор без override). Остальные принимают сообщение; дефолты вроде `"Not Found"` / `"Unauthorized"` допустимы, кроме insufficient funds спека их не фиксирует.

**Почему:** spec запрещает домену нести HTTP-код; `instanceof` даёт устойчивый маппинг.

**Альтернатива:** оставить `AppError(statusCode)` — сервисы снова выбирают 400 vs 403. Отвергнуто.

**Альтернатива:** коды `error.code = "INSUFFICIENT_FUNDS"` без классов. Хуже для TypeScript и `instanceof`. Отвергнуто.

Файлы: `src/domain/errors.ts` (экспорт всех классов) или тонкие файлы рядом; `app-error.ts` удалить после миграции `not-found`.

### 2. Mapper в HTTP, не в domain

**Выбор:** `src/http/map-domain-error.ts` (имя на усмотрение apply) возвращает `{ error, statusCode }` или `null` для не-доменных ошибок. Middleware: если mapper вернул значение — `res.status(statusCode).json({ error, statusCode })` без лога unhandled; иначе лог + 500 `{ error: "Internal Server Error", statusCode: 500 }` (как сейчас: без стека клиенту, без echo `err.message`).

Таблица: validation / insufficient funds / currency mismatch / same-account → 400; unauthorized → 401; forbidden → 403; not-found → 404; conflict → 409.

**Почему:** слойность HTTP → service; тесты могут бить mapper без Express.

**Альтернатива:** switch внутри middleware без отдельной функции — хуже тестировать. Отвергнуто как единственный слой.

`not-found` вызывает `next(new NotFoundError())`.

Доменные 4xx/401/403 **не** логировать как `"Unhandled error"`. Unhandled — только неизвестные ошибки, с существующим pino redact (`password`, `token`, `DATABASE_URL`, `url`, …). Не логировать `err.message` отдельно, если оно может содержать URL (как на initialize БД); для HTTP-500 оставить `{ err }` с redact, как сейчас, потому что handler не должен получать connection string (TypeORM только в config/repositories).

### 3. Тесты: node:test + tsx, без HTTP-сервера

**Выбор:** `npm test` → `tsx --test` по файлам `src/**/*.test.ts`. Кейсы: каждый доменный класс → ожидаемый статус и тело; `InsufficientFundsError` → точная строка; `new Error("stack / sql / secret")` → 500 и `error` не содержит исходное сообщение; handler с mock `req`/`res` для 500 логирует и не отдаёт стек.

**Почему:** Node 24 уже в проекте; без Vitest/Jest. Репозитории мокать нечего.

**Альтернатива:** supertest на живом `app` с фейковым роутом. Можно добавить один smoke, но не обязательно: mapper покрывает контракт, доменных роутов нет.

Не добавлять тестовый эндпоинт в production `app`.

### 4. Сообщения Conflict / Forbidden

**Выбор:** конструктор с текстом; дефолт conflict например `"Email already taken"` — не контракт спеки, только удобство следующих этапов. Forbidden — сообщение без утечки чужого баланса.

## Risks / Trade-offs

- **[Risk]** Сервис следующего этапа бросит `new Error` или старый `AppError` → клиент получит 500. **Mitigation:** удалить `AppError`; тесты на generic `Error`; в apply явно проверить grep `AppError` / `statusCode` в domain.
- **[Risk]** `instanceof` ломается при нескольких копиях класса. **Mitigation:** один пакет, один экспорт из `src/domain`.
- **[Risk]** Pino `{ err }` на 500 может утащить поля из кастомного Error. **Mitigation:** redact уже есть; не класть пароль/JWT в `Error`; 500 body фиксированный.
- **[Trade-off]** Именованные 400 (`CurrencyMismatchError`, `SameAccountTransferError`) шире списка «например» в запросе. Нужны, чтобы спека отличала их от insufficient funds.

## Migration Plan

Локально: заменить импорты `AppError` (сейчас `not-found` и `error-handler`) → новые классы и mapper; `npm test`; `npm run build`. Откат — revert коммита change; HTTP-тело 404/500 того же формата.

## Open Questions

Нет: строки сообщений кроме `"Insufficient funds"` спека не фиксирует; дефолты можно сменить на этапе auth/transfer без смены кодов.
