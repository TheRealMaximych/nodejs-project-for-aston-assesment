## 1. Compose and environment

- [x] 1.1 Add `docker-compose.yml` with a PostgreSQL service only (official image, `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, `5432:5432`, named volume); verify the file has no application `build`/`image` service and `docker compose up -d` makes Postgres accept connections on port 5432
- [x] 1.2 Update `.env.example` with non-empty `DATABASE_URL` matching Compose credentials, plus `PORT`, `NODE_ENV`, and `JWT_SECRET` (comment that JWT is unused until auth); verify the four keys are present and `DATABASE_URL` is not empty

## 2. Tooling

- [x] 2.1 Add runtime deps `typeorm`, `pg`, `reflect-metadata`; add npm scripts `typeorm` (`tsx ./node_modules/typeorm/cli.js -d src/config/data-source.ts`), `migration:generate`, `migration:run`, `migration:revert`; verify `npm install` succeeds and `package.json` lists those scripts
- [x] 2.2 Enable `experimentalDecorators` and `emitDecoratorMetadata` in `tsconfig.json` while keeping `strict: true` and `include: src/**/*.ts`; verify `npx tsc --showConfig` reports those flags

## 3. Config and DataSource

- [x] 3.1 Make `DATABASE_URL` required in `src/config/env.ts` (non-empty string; empty string fails validation); keep `JWT_SECRET` optional with empty → `undefined`; verify missing/empty `DATABASE_URL` exits before listen and empty `JWT_SECRET` still loads config
- [x] 3.2 Add `src/config/data-source.ts` exporting `AppDataSource` (`type: postgres`, `url: config.databaseUrl`, `synchronize: false`, `migrationsRun: false`, `entities: []`, `migrations: ["migrations/*.ts"]`) and import `reflect-metadata` there; verify `synchronize` is false and HTTP modules do not import this file
- [x] 3.3 Extend pino redact in `src/config/logger.ts` with `databaseUrl`, `DATABASE_URL`, and `url`; verify those paths are in the redact list

## 4. Migrations

- [x] 4.1 Add a handwritten initial TypeORM migration under `migrations/` with empty/no-op `up`/`down` (no User, BankAccount, or Transaction tables); verify the file implements `MigrationInterface` and contains no `CREATE TABLE` for those entities
- [x] 4.2 With Compose Postgres up and `.env` copied from `.env.example`, run `npm run migration:run` then `npm run migration:revert`; verify run exits 0, the DB has no User/BankAccount/Transaction tables, and revert exits 0

## 5. Process bootstrap

- [x] 5.1 Change `src/index.ts` to async bootstrap: `await AppDataSource.initialize()` then `app.listen(config.port)`; on failure log a fixed `Database connection failed` (do not log `err` or `err.message`), then `process.exit(1)` before listen; verify `src/http` and `src/services` still have no `process.env` and no TypeORM imports
- [x] 5.2 Confirm `synchronize: true` is absent and TypeORM APIs are only under `src/config` (and empty `src/repositories`); verify grep for `synchronize: true` is empty and `src/http` has no `typeorm` imports

## 6. Build and smoke

- [x] 6.1 Run `npm run build` and verify it exits 0 with strict compilation
- [x] 6.2 Start the app with Postgres up and migrations applied (`npm run dev` or `npm start`) and verify `GET /health` returns 200 `{ "status": "ok" }`
- [x] 6.3 Stop Postgres (or point `DATABASE_URL` at a closed port), start the app, and verify the process exits without serving HTTP and the log line does not contain the password, `JWT_SECRET`, or `DATABASE_URL`
