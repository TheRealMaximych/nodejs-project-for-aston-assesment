## Context

There is no root `README.md`. Launch pieces already exist: `.env.example` (`PORT=3000`, `NODE_ENV`, `DATABASE_URL` matching Compose, `JWT_SECRET` placeholder), `docker-compose.yml` (PostgreSQL 16 only), npm scripts `dev` / `build` / `test` / `migration:run` / `seed`, seed identities in `seeds/demo.ts`, Swagger UI at `GET /api-docs`. `.env` is gitignored. Motivation: `proposal.md`. Contracts: deltas `runbook-readme`, `postgres-typeorm`, `demo-seed`.

## Goals / Non-Goals

**Goals:**

- One root `README.md` a new developer can follow end-to-end: copy env, Compose up, migrate, seed, `dev`, login for JWT, open `/api-docs`.
- Add npm script `migrate` as an alias of existing `migration:run`.
- Keep README short and command-oriented.

**Non-Goals:**

- Changing handlers, OpenAPI document, seed logic, Compose services, or `.env.example` keys.
- New service unit tests, HTTP integration tests, or a Docker image for the Node process.
- Documenting architecture (that stays in `AGENTS.md`).

## Decisions

### 1. README language and shape

**Выбор:** один файл `README.md` на русском. Секции в порядке запуска: требования (Node.js + npm + Docker), `npm install`, копирование `.env.example` → `.env`, Compose PostgreSQL, миграции, seed, скрипты, старт API, JWT, Swagger. Без разделов про слои, TypeORM, «почему Express».

**Почему:** оценка и `AGENTS.md` на русском; критерий — новый человек поднимает стек, а не читает архитектуру.

**Альтернатива:** английский README — отвергнуто (язык задания и репозитория).

**Альтернатива:** вынести runbook в `docs/RUN.md` — отвергнуто; оценка ожидает корневой README.

### 2. Copying `.env` on Windows and Unix

**Выбор:** в тексте «скопируйте `.env.example` в `.env`» плюс две команды: `copy .env.example .env` (cmd) и `cp .env.example .env` (Unix/macOS). Явно: не коммитить `.env`; заменить `JWT_SECRET=replace-me` на длинную локальную строку; `DATABASE_URL` уже совпадает с Compose.

**Почему:** автор на Windows, проверяющий может быть на Unix; не зависеть от Make.

**Альтернатива:** только `cp` — ломается в cmd. Отвергнуто.

### 3. npm script `migrate`

**Выбор:** в `package.json` добавить `"migrate": "npm run migration:run"`. Существующие `typeorm`, `migration:generate`, `migration:run`, `migration:revert` не удалять. README для запуска указывает `npm run migrate`; `migration:revert` / `migration:generate` можно одной строкой в таблице скриптов, без отдельного туториала.

**Почему:** пользовательский runbook называет команду `migrate`; дублировать CLI TypeORM не нужно.

**Альтернатива:** в README писать только `npm run migration:run` без нового скрипта — расходится с требуемым именем. Отвергнуто.

**Альтернатива:** заменить `migration:run` на `migrate` — ломает привычку из прошлых changes. Отвергнуто.

### 4. Compose and process start

**Выбор:** документировать `docker compose up -d` (Compose V2) из корня репозитория. После старта БД — `npm run migrate`, затем `npm run seed`, затем `npm run dev`. Упомянуть `GET /health` → `{ "status": "ok" }` как быструю проверку, что API слушает `PORT` (пример `3000`). Не добавлять сервис приложения в Compose.

**Почему:** Compose уже только PostgreSQL; `tsx watch` уже в `dev`.

**Альтернатива:** `docker-compose` (дефис) как единственная команда — устаревшая форма; можно упомянуть как синоним одной фразой, основной — `docker compose`.

### 5. JWT and Swagger in the README

**Выбор:** после seed и `dev` — `POST /auth/login` с телом `{ "email", "password" }`. Перечислить оба демо-email из `seeds/demo.ts` (`alice.demo@example.com`, `bob.demo@example.com`) и общий plaintext `DemoPass12`. Пример `curl` (или эквивалент) на `http://localhost:3000/auth/login`. Ответ: `{ "accessToken": "..." }`. Для защищённых операций в UI: Authorize Bearer этим токеном. Swagger: `http://localhost:3000/api-docs` (если `PORT=3000`). Не вставлять signed JWT и не копировать `JWT_SECRET` кроме отсылки к `.env`. UUID счетов в README не обязательны (спека JWT+Swagger); при желании одной строкой: идентификаторы печатает seed в лог (`accountId`).

**Почему:** критерий — получить JWT и открыть OpenAPI без чтения исходников; UUID не секрет, но раздувают runbook.

**Альтернатива:** не печатать демо-пароль, ссылаться на `seeds/demo.ts` — отвергнуто (спека `demo-seed` требует пароль в README).

**Альтернатива:** отдельный `GET /openapi.json` — вне скоупа; UI уже отдаёт документ.

### 6. Verification without new test files

**Выбор:** не добавлять `src/**/*.test.ts`. Tasks: grep README на обязательные команды/пути/email; `package.json` содержит `migrate`; `.env` не в git; `npm test` и `npm run build` зелёные. Ручная проверка: поднять по README и открыть `/api-docs`.

**Почему:** unit-тесты — service-слой; README проверяется чеклистом.

**Альтернатива:** тест, что README содержит строки — хрупкий и не требуется заданием. Отвергнуто.

## Risks / Trade-offs

- **[Risk]** Демо-пароль в git (README). **Mitigation:** это локальные demo-credentials, не production; README помечает их как demo; хеш в БД; `.env` / реальный `JWT_SECRET` не коммитить.
- **[Risk]** README расходится с `package.json` или путём `/api-docs`. **Mitigation:** tasks сверяют скрипты и URL с текущими файлами.
- **[Risk]** `docker compose` отсутствует, есть только `docker-compose`. **Mitigation:** одна фраза-синоним в README.
- **[Risk]** Порт 5432 или 3000 занят. **Mitigation:** README не разворачивает troubleshooting-эссе; достаточно указать, что `PORT` и `DATABASE_URL` берутся из `.env`.
- **[Trade-off]** UUID счетов не в README — меньше текста; перевод на чужой счёт потребует лог seed или исходник. Приемлемо для критерия JWT+Swagger.

## Migration Plan

Implement: add `migrate` in `package.json` → write `README.md` → verify `.env` still gitignored → `npm test` / `npm run build`. No DB migration. Rollback: delete `README.md` and the `migrate` script; schema and API unchanged.

## Open Questions

None: README at repo root, Russian runbook, `migrate` alias, demo emails/password in README, Swagger at `/api-docs`, no new tests.
