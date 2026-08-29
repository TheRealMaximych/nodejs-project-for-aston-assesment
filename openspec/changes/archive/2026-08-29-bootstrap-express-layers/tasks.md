## 1. Tooling

- [x] 1.1 Add `tsconfig.json` with `strict: true`, `rootDir: src`, `outDir: dist`, CommonJS module settings matching `"type": "commonjs"`, `esModuleInterop`, and `target` ES2022; verify `npx tsc --showConfig` reports `strict: true` and `rootDir`/`outDir` as specified
- [x] 1.2 Add runtime deps `express`, `dotenv`, `zod`, `pino` and dev deps `typescript`, `tsx`, `@types/node`, `@types/express`; set scripts `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`); verify `npm install` succeeds and `package.json` does not list `typeorm`, `pg`, or swagger packages
- [x] 1.3 Add `.env.example` with `PORT`, `NODE_ENV`, `DATABASE_URL`, and `JWT_SECRET`, plus a comment that the last two are optional until later stages; verify the file lists all four keys

## 2. Layer directories

- [x] 2.1 Create `src/config`, `src/http`, `src/services`, `src/repositories`, `src/domain`, `src/entities`, `migrations/`, and `seeds/`; add `.gitkeep` under `src/services`, `src/repositories`, `src/entities`, `migrations/`, and `seeds/`; verify those paths exist on disk

## 3. Config and logging

- [x] 3.1 Implement `src/config/env.ts`: load dotenv only here, validate with zod (`PORT` positive int, `NODE_ENV` enum `development|test|production`, `DATABASE_URL`/`JWT_SECRET` optional with empty string → `undefined`), export typed `config`; verify invalid `PORT` or `NODE_ENV` causes the process to exit before listen, and that a copied `.env.example` with empty optional keys still starts
- [x] 3.2 Implement `src/config/logger.ts` with pino `redact` for `password`, `passwordHash`, `hash`, `token`, `accessToken`, `jwt`, `authorization`, `cvv`; verify the logger instance is created from this module and those paths are in the redact list

## 4. HTTP runtime

- [x] 4.1 Add `src/domain/app-error.ts` with `message` and `statusCode`; verify HTTP and later services can construct `new AppError("Not Found", 404)` (or equivalent) without importing Express
- [x] 4.2 Add `GET /health` in `src/http/routes/health.ts` returning 200 `{ "status": "ok" }`; wire it in `src/http/app.ts` after `express.json()`; verify `GET /health` (no auth) returns that JSON with JSON `Content-Type`
- [x] 4.3 Add not-found middleware (404 `AppError`) and error handler: `AppError` → `{ error, statusCode }` matching HTTP status; unknown errors → 500 `{ "error": "Internal Server Error", "statusCode": 500 }` with the real `err` logged via pino (method/url allowed, never `req.body`); verify `GET /no-such-route` and `POST /auth/register` return `{ "error": string, "statusCode": 404 }`, and that the 500 branch does not send `err.stack` or `err.message`
- [x] 4.4 Add `src/index.ts` that imports validated `config` and calls `app.listen(config.port)`; ensure `src/http` and `src/services` contain no `process.env` reads; verify listen uses `config.port` and a search of `src/http` and `src/services` finds no `process.env`

## 5. Build and smoke

- [x] 5.1 Run `npm run build` and verify it exits 0 with `strict` compilation (no TypeScript errors)
- [x] 5.2 Start via `npm run dev` or `npm start` without PostgreSQL, then `GET /health` → 200 `{ "status": "ok" }`; verify the process is ready with no DB driver connection
- [x] 5.3 Confirm `package.json` / `src` have no TypeORM usage and `synchronize` is not present; verify grep for `typeorm` / `synchronize` is empty
