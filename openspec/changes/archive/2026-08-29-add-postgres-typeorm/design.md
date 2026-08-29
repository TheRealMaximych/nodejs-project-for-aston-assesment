## Context

Сейчас процесс валидирует только `PORT` / `NODE_ENV`, поднимает Express и отдаёт `GET /health` без драйвера БД. `DATABASE_URL` и `JWT_SECRET` опциональны; TypeORM не подключён. Мотивация — в `proposal.md`; контракты — в дельтах `app-config`, `http-runtime`, `postgres-typeorm`.

Ограничения: `synchronize: true` запрещён; TypeORM DataSource / Repository / QueryBuilder только в `src/config` и `src/repositories`; HTTP не импортирует persistence API; доменные сущности и seed вне скоупа.

## Goals / Non-Goals

**Goals:**

- Один `DataSource` для приложения и CLI миграций: `url` из валидированного конфига, `synchronize: false`, `migrationsRun: false`.
- Compose только с Postgres; `.env.example` с рабочим `DATABASE_URL` под этот сервис.
- Bootstrap: `initialize()` → при успехе `listen(config.port)`; при ошибке — лог без секретов и выход без HTTP.
- Ручная стартовая миграция без таблиц User / BankAccount / Transaction.

**Non-Goals:**

- Автопрогон миграций при старте (`migrationsRun: true`).
- Проверка БД внутри `GET /health`.
- Репозитории домена, сущности, JWT usage, README, Swagger.

## Decisions

### 1. Один `DATABASE_URL`, не набор host/port/user/password

**Выбор:** обязательный непустой `DATABASE_URL` (zod: строка с `min(1)` после trim; пустая строка — ошибка валидации, как сейчас empty → `undefined`, но `undefined` больше не проходит схему). `JWT_SECRET` без изменений: optional, empty → `undefined`, в объект конфига попадает, кодом не используется.

**Почему:** ключ уже есть в `.env.example` и в предыдущем design («TypeORM change сделает DATABASE_URL required»). Compose задаёт user/password/db; в URL их дублируют один раз.

**Альтернатива:** дискретные `DATABASE_HOST` / `PORT` / `USER` / `PASSWORD` / `NAME` — больше переменных при том же Postgres. Отвергнуто, пока не попросили.

**Следствие:** `.env.example` содержит конкретный URL вида `postgres://postgres:postgres@localhost:5432/<db>`, совпадающий с `POSTGRES_*` в Compose. Комментарий: `JWT_SECRET` понадобится на этапе auth.

### 2. TypeORM 0.3 `DataSource` в `src/config`

**Выбор:** `src/config/data-source.ts` экспортирует `AppDataSource`:

- `type: "postgres"`, `url: config.databaseUrl`
- `synchronize: false`, `migrationsRun: false`
- `entities: []` (доменные entity — следующие этапы)
- `migrations: ["migrations/*.ts"]` для CLI

Точка входа `src/index.ts` (и сам data-source, потому что CLI не идёт через index) импортирует `reflect-metadata`. HTTP-слой `AppDataSource` не импортирует.

**Почему:** один файл и для `initialize()`, и для `-d` у CLI. Пустой `entities` не даёт generate выдумать User/Account.

**Альтернатива:** два DataSource (app vs CLI) — дублирование url/synchronize. Отвергнуто.

**Альтернатива:** `migrationsRun: true` при старте — удобно локально, но смешивает миграции с runtime и хуже контролируется на оценке. Отвергнуто явно (non-goal).

Зависимости: `typeorm`, `pg`, `reflect-metadata`. CLI: `tsx ./node_modules/typeorm/cli.js -d src/config/data-source.ts` (без отдельного `typeorm-ts-node-*`).

`tsconfig`: `experimentalDecorators` + `emitDecoratorMetadata` сейчас, чтобы этап сущностей не ломал сборку. `include` остаётся `src/**/*.ts`: миграции исполняет `tsx`, `tsc` их в `dist/` не кладёт. Для `npm start` `initialize()` не загружает классы миграций.

### 3. npm-скрипты миграций

**Выбор:**

- `typeorm` — CLI + `-d src/config/data-source.ts`
- `migration:generate` — `migration:generate` (путь передаётся аргументом)
- `migration:run` / `migration:revert`

Первую миграцию **не** генерировать из пустых entity: рукописный файл в `migrations/` с пустыми `up`/`down` (или no-op). TypeORM при `run` создаст служебную таблицу истории миграций; доменных таблиц не будет.

**Почему generate с `entities: []` либо падает, либо бесполезен. Пустой `up` удовлетворяет spec «без User/Account/Transaction».

**Альтернатива:** служебная таблица `app_meta` — лишняя схема без потребителя.

### 4. Docker Compose только PostgreSQL

**Выбор:** сервис `postgres` (официальный образ, например `postgres:16-alpine`), `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` = credentials в `DATABASE_URL`, порт `5432:5432`, named volume для data. **Нет** `build:` / сервиса приложения. Опционально `healthcheck` `pg_isready` — не контракт API, упрощает ожидание готовности.

**Почему:** задание — Compose только для БД.

**Альтернатива:** bind-mount `./data` — засоряет репозиторий; named volume проще в `.gitignore`.

### 5. Bootstrap и логи без секретов

**Выбор:** async `main()`: `await AppDataSource.initialize()`; успех → `app.listen(config.port)`; catch → pino **без** объекта `err` и без `err.message` (драйвер часто вшивает URL с паролем), фиксированное сообщение вроде `Database connection failed` плюс безопасно `err.name` / код, если он не содержит `:`/`@` URL. `process.exit(1)` до `listen`.

Расширить pino `redact` путями вроде `databaseUrl`, `DATABASE_URL`, `url` на всякий случай; это не замена запрету логировать `err`.

**Почему:** spec запрещает пароль, JWT и connection string в логе. `logger.error({ err })` это ломает.

**Альтернатива:** парсить URL и логировать только host — сложнее и всё ещё риск утечки через stack.

HTTP и services по-прежнему без `process.env` и без TypeORM.

### 6. Слойность на этом этапе

`src/repositories` остаётся без репозиториев домена (`.gitkeep`). Никаких QueryBuilder в `src/http`. Health не меняется: `{ "status": "ok" }` означает «процесс слушает», не «SELECT 1».

## Risks / Trade-offs

- **[Risk]** TypeORM/`pg` кладут URL в `Error.message` → **Mitigation:** не логировать `err` / `err.message` на initialize; redact на логгере.
- **[Risk]** Старый `.env` с пустым `DATABASE_URL` — процесс не стартует (**BREAKING**) → **Mitigation:** `.env.example` с рабочим URL; spec/proposal фиксируют breaking.
- **[Risk]** `migration:generate` без entity путает → **Mitigation:** первая миграция рукописная; generate для следующих этапов, когда появятся entity.
- **[Risk]** Включат `synchronize` «на минутку» → **Mitigation:** spec + единственный DataSource с явным `false`; в tasks — проверка grep.
- **[Risk]** CLI с `tsx` и путями Windows → **Mitigation:** glob `migrations/*.ts` от корня репозитория, не от `__dirname` в `dist`.
- **[Trade-off]** Миграции не в `tsc` outDir — CLI всегда через `tsx` и исходники; `npm start` только initialize. Приемлемо до отдельного пакета миграций.
- **[Trade-off]** JWT optional до auth — как в bootstrap design; обязательность — отдельный change.

## Migration Plan

Локально: `docker compose up -d` → скопировать `.env.example` в `.env` → `npm install` → `npm run migration:run` → `npm run dev` (или `build` + `start`) → `GET /health`. Откат кода — revert change; откат схемы — `migration:revert`; данные Compose — `docker compose down` (volume отдельно, если нужно стереть).
