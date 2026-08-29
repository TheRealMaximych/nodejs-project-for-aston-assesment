## Context

Сейчас в репозитории только заготовка `package.json` (`type: commonjs`) и `.gitignore` (уже игнорирует `.env`, `dist/`, `node_modules/`). TypeORM, сущности и доменные маршруты в этом change не появляются. Мотивация — в `proposal.md`; контракты поведения — в `specs/app-config` и `specs/http-runtime`.

Ограничения: код только в `src/`; HTTP → service → repository (пока service/repository пустые); `process.env` не читать в http/services; TypeORM `synchronize` не включать, драйвер БД не подключать.

## Goals / Non-Goals

**Goals:**

- Собрать минимальный процесс: валидированный config → Express app → listen.
- Зафиксировать единый error pipeline и логгер с redaction, чтобы следующие этапы только добавляли маршруты и доменные ошибки.
- Оставить пустые каталоги слоёв (`services`, `repositories`, `entities`) и `migrations/` / `seeds/` с `.gitkeep`, чтобы структура совпала с заданием с первого этапа.

**Non-Goals:**

- Плейсхолдер TypeORM `DataSource`, JWT-middleware, Swagger, README (даже только про запуск — отдельным change вместе с Docker).
- Тесты (unit домена запрещены заданием этапа; HTTP-тесты не требуются).
- Смена `"type"` на ESM.

## Decisions

### 1. `DATABASE_URL` и `JWT_SECRET` — опциональны на этом этапе

**Выбор:** в схеме env обязательны только `PORT` и `NODE_ENV`. `DATABASE_URL` и `JWT_SECRET` — optional; пустая строка preprocess-ится в `undefined` (как в скопированном `.env.example`). В `.env.example` оба ключа перечислены с комментарием, что они понадобятся на следующих этапах.

**Почему:** критерий этапа — процесс поднимается без PostgreSQL. Обязательный `DATABASE_URL` это ломает. `JWT_SECRET` до auth не используется; требовать его сейчас заставляет выдумывать секрет без потребителя.

**Альтернатива:** оба ключа уже required, значения в `.env` — отвергнуто: старт без БД станет невозможен, а пустой JWT в required-поле маскирует отсутствие настоящей проверки.

**Следствие:** change с TypeORM сделает `DATABASE_URL` required; change с auth — `JWT_SECRET` required (min length).

### 2. Скрипты и компилятор: `tsx` + `tsc`

**Выбор:**

- `dev`: `tsx watch src/index.ts`
- `build`: `tsc`
- `start`: `node dist/index.js`

**Почему:** `tsx` один инструмент для watch без отдельного `ts-node-dev`; `start` гоняет скомпилированный `dist`, что ближе к оценке «TypeScript собирается».

**Альтернатива:** `ts-node-dev` — лишняя зависимость при том же результате.

`tsconfig`: `strict: true`, `rootDir: src`, `outDir: dist`, `module`/`moduleResolution` под существующий `"type": "commonjs"`, `esModuleInterop`, `target` ES2022, `skipLibCheck`.

### 3. Валидация env: `dotenv` + `zod`

**Выбор:** `dotenv/config` (или `config()`) только внутри `src/config`; дальше `z.object({...}).parse(...)`, экспорт типизированного `config`. HTTP и services импортируют `config`, не `process.env`.

`PORT`: coerce к числу, `int`, `positive`. `NODE_ENV`: enum `development | test | production`.

**Альтернатива:** `envalid` — отдельный пакет ради той же схемы; zod уже указан в запросе.

### 4. Логгер: `pino` с `redact`

**Выбор:** `pino` (не winston). Redact путей вроде `password`, `passwordHash`, `hash`, `token`, `accessToken`, `jwt`, `authorization`, `cvv`. В error handler логировать `err` (и при необходимости `req.method` / `req.url`), **не** сырое `req.body`. На 500 клиенту — фиксированная строка вроде `"Internal Server Error"`, не `err.message` неизвестных ошибок.

**Почему:** встроенный redact; JSON-логи удобны для оценки. Winston потребовал бы ручной фильтр.

**Альтернатива:** winston — тяжелее для той же задачи redaction.

### 5. Каркас HTTP

```
src/index.ts                 # config уже провалидирован импортом; app.listen(config.port)
src/config/env.ts           # dotenv + zod → config
src/config/logger.ts        # pino instance
src/http/app.ts             # express(), json(), маршруты, 404, error handler
src/http/routes/health.ts
src/http/middleware/not-found.ts
src/http/middleware/error-handler.ts
src/domain/app-error.ts     # { message, statusCode } — задел под доменные ошибки
```

Порядок middleware: `express.json()` → роуты (`GET /health`) → not-found (404 `AppError`) → error handler.

Unknown errors → HTTP 500, тело `{ error: "Internal Server Error", statusCode: 500 }`, полный `err` только в лог.

**Почему `AppError` в `domain` сейчас:** error handler один; следующие этапы добавят `InsufficientFundsError` и т.п. без смены формата JSON. Это не доменный API.

**Альтернатива:** ошибка только в `http` — пришлось бы дублировать маппинг, когда появятся service-ошибки.

Health — осознанное исключение из списка доменных эндпоинтов: только smoke-проверка запуска, не часть банковского API.

### 6. Пустые каталоги

`src/services`, `src/repositories`, `src/entities`, `migrations/`, `seeds/` — `.gitkeep` (git не хранит пустые папки). `src/domain` не пустой из‑за `AppError`. TypeORM в `package.json` не добавлять; `synchronize` негде включить.

### 7. Зависимости (ориентир)

Runtime: `express`, `dotenv`, `zod`, `pino`.  
Dev: `typescript`, `tsx`, `@types/node`, `@types/express`.  
Не добавлять: `typeorm`, `pg`, `jsonwebtoken`, swagger-пакеты.

## Risks / Trade-offs

- **[Risk]** На этапе auth/БД забудут сделать `JWT_SECRET` / `DATABASE_URL` required → **Mitigation:** решение явно в этом design; `.env.example` с комментарием; следующие OpenSpec change меняют схему.
- **[Risk]** Пустые каталоги не попадут в git → **Mitigation:** `.gitkeep`.
- **[Risk]** Логи утекут через `req.body` или `err.message` → **Mitigation:** не логировать body; redact; клиентский 500 — фиксированное сообщение.
- **[Risk]** Ревьюер сочтёт `GET /health` лишним эндпоинтом задания → **Mitigation:** в spec зафиксировано, что это ops-only smoke route; доменные пути не реализуются.
- **[Trade-off]** Опциональный JWT сейчас vs полный `.env` сразу — выбран старт без БД; полнота секретов откладывается.

## Migration Plan

Greenfield: `npm install`, скопировать `.env.example` → `.env` (достаточно `PORT` и `NODE_ENV`), `npm run dev` или `npm run build && npm start`. Откат — revert change. Данных и схемы БД нет.
