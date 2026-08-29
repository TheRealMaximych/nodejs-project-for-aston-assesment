## Why

Сейчас HTTP знает только общий `AppError` со статусом в конструкторе. Следующие этапы (auth, счета, переводы) должны бросать доменные ошибки без знания Express; иначе каждый сервис начнёт дублировать коды и сломает единое тело `{ "error", "statusCode" }`. Инфраструктуру маппинга нужно зафиксировать до эндпоинтов.

## What Changes

- Ввести типизированные доменные ошибки в `src/domain` (как минимум `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `InsufficientFundsError`; для правил перевода — именованные 400: разная валюта и перевод на тот же счёт).
- HTTP error middleware мапит известные доменные типы на статус и тело `{ "error": string, "statusCode": number }`; неизвестный `Error` → 500 без стека и внутренних деталей клиенту, плюс лог без секретов.
- Сообщение insufficient funds строго `"Insufficient funds"` (400). Остальные коды: 400 валидация / валюта / тот же счёт; 401 нет или невалидный токен; 403 чужой счёт; 404 сущность не найдена; 409 email занят.
- 404 неизвестного пути идёт через `NotFoundError`, не через произвольный статус в конструкторе.
- Unit-тесты маппинга/handler: каждый доменный тип → свой статус и тело; произвольный `Error` → 500 без внутренностей.
- **BREAKING** (внутреннее): вызывающий код больше не задаёт HTTP-статус в доменной ошибке; статус определяет только HTTP-слой.

## Non-goals

- Эндпоинты и сервисы регистрации, логина, logout, JWT, счетов, баланса, переводов и истории.
- Seed, новые миграции, сущности User / BankAccount / Transaction, Swagger, README.
- NestJS, MongoDB, Redis, GraphQL, OAuth2, refresh-токены, подтверждение email, сброс пароля, Docker-образ приложения, эндпоинт депозита, фронтенд.

## Capabilities

### New Capabilities

- `domain-errors`: типизированные ошибки домена и контракт, что сервисы бросают только их; insufficient funds — фиксированная строка; 400-кейсы перевода (валюта, тот же счёт) отличимы от generic validation.

### Modified Capabilities

- `http-runtime`: error middleware мапит доменные ошибки на таблицу статусов; неизвестный `Error` остаётся client-safe 500 с логом без секретов; unknown path по-прежнему 404 в том же теле, через `NotFoundError`.

## Impact

- Код: `src/domain` (иерархия ошибок), `src/http/middleware/error-handler.ts`, `src/http/middleware/not-found.ts`.
- Тесты: runner для unit-тестов маппинга (репозитории не нужны).
- HTTP-контракт неизвестного пути и 500 не меняется по форме тела. Доменных маршрутов на этом этапе нет.
- Зависимости: без новых runtime-библиотек, кроме возможного test runner в devDependencies.
