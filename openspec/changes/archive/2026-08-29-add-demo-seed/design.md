## Context

`POST /accounts` always opens at `"0.00"`; there is no deposit route. `userRepository.insert` cannot set a fixed UUID or funded balance; `bankAccountRepository.insert` hard-codes `"0.00"`. There is no `GET /accounts` list, so demo account ids must be known a priori. DataSource already maps `User` and `BankAccount` with `synchronize: false`. Password hashing is `hashPassword` (async bcrypt). Motivation: `proposal.md`. Contracts: deltas `demo-seed`, `postgres-typeorm`.

Constraints: TypeORM stays out of HTTP/services; seed CLI under `seeds/` may use DataSource. Money as decimal strings. No new migration, no Swagger, no README in this change. Seed must not bind HTTP.

## Goals / Non-Goals

**Goals:**

- CLI `seeds/demo.ts` + npm script `seed` that upserts two users and two funded same-currency accounts with **fixed UUIDs and emails**.
- Idempotent re-run: no duplicate demo rows; restore canonical balances.
- Async bcrypt via existing hasher; logs with `userId`/`accountId`/email only.
- Initialize `AppDataSource`, write rows, `destroy()` — never `app.listen`.

**Non-Goals:**

- Extending runtime repositories with upsert APIs (seed-only writes stay in `seeds/`).
- Compiling `seeds/` into `dist/` (`tsx` like the TypeORM CLI).
- HTTP integration tests against live PostgreSQL; Swagger; README.
- Seeding Transaction rows.

## Decisions

### 1. Entry point and npm script

**Выбор:** `seeds/demo.ts` as a standalone process. `package.json`: `"seed": "tsx seeds/demo.ts"`. Flow: `AppDataSource.initialize()` → upsert demo rows in one query-runner transaction → log ids → `AppDataSource.destroy()` in `finally`. Do not import `src/http/app.ts` or `src/index.ts`. `tsconfig` `rootDir` stays `src/`; seed is type-checked only when run via `tsx`.

**Почему:** каталог `seeds/` уже в структуре проекта; `tsx` уже есть для TypeORM CLI; HTTP не стартует.

**Альтернатива:** `src/scripts/seed.ts` — ломает согласованный layout. Отвергнуто.

**Альтернатива:** TypeORM `Migration` с INSERT — смешивает схему и данные; повторный `migration:run` не идемпотентен для данных. Отвергнуто.

### 2. Idempotency: fixed UUID + email, application upsert

**Выбор:** канонические константы (не генерировать `uuid()` на каждый запуск):

| Role | User id (fixed UUID) | Email (lowercase) | Account id (fixed UUID) | Currency | Balance |
|---|---|---|---|---|---|
| Alice | `11111111-1111-4111-a111-111111111111` | `alice.demo@example.com` | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` | `USD` | `"1000.00"` |
| Bob | `22222222-2222-4222-a222-222222222222` | `bob.demo@example.com` | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb` | `USD` | `"500.00"` |

Демо-пароли — строковые константы в `seeds/demo.ts` (минимум 8 символов, например `DemoPass12`), **не** в логах и **не** в README этого change.

Алгоритм в одной DB-транзакции:

1. Для каждого демо-пользователя: `findOne` by **id**. Если нет — `findOne` by **email**. Если email занят **другим** id → abort (понятный error log с email и существующим `userId`, без пароля/хеша). Если нет строки — `insert` с фиксированным id, email, `await hashPassword(plaintext)`, `tokenVersion: 0`. Если строка с тем же id есть — обновить `email` и `passwordHash` (чтобы канонический пароль снова логинил); **не** трогать `tokenVersion`.
2. Для каждого демо-счёта: `findOne` by **id**. Если нет — `insert` с фиксированным id, `userId`, `accountHolder`, `currency`, `balance`. Если есть — обновить `userId`, `accountHolder`, `currency` и **восстановить** `balance` до канонической строки (после переводов демо снова валидно).
3. Commit. Лог: `Seeded user: userId=<id> email=<email>` и `Seeded account: accountId=<id>, userId=<id>` (как в задании для account created).

Повторный запуск: те же PK → нет дубликатов. Email unique соблюдается, потому что email привязан к фиксированному id.

**Почему:** нет list-accounts API — UUID должны быть стабильными и известными из исходника. Upsert по PK проще и безопаснее, чем «insert if not exists» (иначе после перевода баланс 0 и критерий «можно перевести» ломается).

**Альтернатива:** только `ON CONFLICT (email) DO NOTHING` и случайные UUID при первом insert — второй запуск не плодит пользователей, но account id неизвестен без SQL. Отвергнуто.

**Альтернатива:** SQL `INSERT … ON CONFLICT (id) DO UPDATE`. Эквивалентно; выбран find/insert/save на TypeORM repository, чтобы не конкатенировать SQL и переиспользовать transformer `numeric`→string. Если `upsert()` TypeORM начнёт затирать `tokenVersion`, явно исключить это поле из update.

**Альтернатива:** не восстанавливать баланс (только skip if exists) — идемпотентно по строкам, но после перевода seed бесполезен без `TRUNCATE`. Отвергнуто спекой.

### 3. Hashing and logging

**Выбор:** `await hashPassword` from `src/services/password-hasher.ts` (bcrypt cost 10, async). Не `bcrypt.hashSync`. Логировать только id/email. Не логировать plaintext, `passwordHash`, JWT. Не передавать пароль в structured log object (pino redact не оправдывает передачу секрета).

**Почему:** тот же hasher, что регистрация; критерий «не блокировать event loop sync crypto».

**Альтернатива:** захардкоженный bcrypt-хеш в исходнике — не нужно `await`, но смена демо-пароля требует ручного rehash. Отвергнуто.

### 4. TypeORM in `seeds/`, not in HTTP

**Выбор:** `AppDataSource.getRepository(User | BankAccount)` только в `seeds/demo.ts`. Не добавлять `upsertDemo` в runtime repositories. HTTP/services без изменений.

**Почему:** runtime `insert` специально открывает баланс `0.00`; seed — единственное место ненулевого стартового баланса.

**Альтернатива:** расширить repositories ради seed — путает API приложения с CLI. Отвергнуто.

### 5. Env and failures

**Выбор:** тот же validated `DATABASE_URL` через `src/config/env.ts` (seed inherits `PORT`/`JWT_SECRET` because `env.ts` requires them — reuse `.env`, do not add seed-only env vars). If initialize fails, log connection failure without the URL/password and `process.exit(1)`. Email/id conflict: throw, rollback, exit 1.

**Почему:** один конфиг; нет второго канала секретов.

### 6. Tests

**Выбор:** не добавлять service unit-тесты и не поднимать PostgreSQL в `npm test`. Критерий приёмки: вручную `migration:run` + `seed` + два login + `POST /transactions` на чужой `toAccount`. Grep: `seeds/` не логирует `password`; `src/http` без TypeORM.

**Почему:** seed — CLI с живой БД; слой сервисов не меняется.

**Альтернатива:** integration-тест в CI с Compose — вне скоупа (нет app image / testcontainers в задании).

## Risks / Trade-offs

- **[Risk]** Email `alice.demo@example.com` уже занят другим UUID (ручная регистрация) → unique violation или «тихий» второй пользователь. **Mitigation:** pre-check by email; abort with `userId` + email; no duplicates.
- **[Risk]** `repository.upsert` сбрасывает `tokenVersion` → текущие JWT демо-юзера становятся 401. **Mitigation:** update hash/email without writing `tokenVersion`.
- **[Risk]** Лог случайно печатает константу пароля. **Mitigation:** log templates only interpolate ids/email; grep seed file for logger calls.
- **[Risk]** `Number("1000.00")` в seed. **Mitigation:** balance literals as strings `"1000.00"` / `"500.00"`; entity transformer already rejects non-strings on write.
- **[Risk]** Параллельный двойной `npm run seed`. **Mitigation:** one transaction + PK upsert; acceptable for local demo (no distributed lock).
- **[Trade-off]** Восстановление баланса затирает результаты ручных переводов на демо-счетах. Это намеренно для повторяемого демо.
- **[Trade-off]** `tsc` не компилирует `seeds/`. Seed всегда через `tsx`, как TypeORM CLI.

## Migration Plan

Locally: add `seeds/demo.ts` + `"seed"` script → `npm run migration:run` (existing migrations only) → `npm run seed` (twice, to prove no dupes) → login both emails → `POST /transactions` Alice→Bob. Rollback: delete the two user/account rows or drop the local DB; no schema revert. No `npm install`. Clients: no HTTP contract change.

## Open Questions

Нет: фиксированные UUID/email, restore balances, TypeORM in `seeds/`, and no README/Swagger are fixed in the specs and above.
