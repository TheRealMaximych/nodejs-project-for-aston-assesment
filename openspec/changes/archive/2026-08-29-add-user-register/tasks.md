## 1. Dependencies

- [x] 1.1 Add `bcrypt` and `@types/bcrypt`; verify `npm install` exits 0 and `package.json` lists `bcrypt` (if native install fails on Windows, switch to `@node-rs/bcrypt` with an async hash API — never `hashSync`)

## 2. Entity and DataSource

- [x] 2.1 Add `src/entities/user.ts` for table `users` with UUID `id`, unique `email` varchar(255), `passwordHash` → `password_hash`, `tokenVersion` → `token_version` int NOT NULL default 0, `createdAt` timestamptz; verify the entity has no HTTP/status fields and TypeScript compiles the file
- [x] 2.2 Register `User` on `AppDataSource.entities` and keep `synchronize: false` and `migrationsRun: false`; verify `src/config/data-source.ts` imports the entity and grep for `synchronize: true` is empty

## 3. Migration

- [x] 3.1 Add a new TypeORM migration (generate `migrations/CreateUsers` after the entity is registered, or hand-write equivalent SQL) that creates `users` with unique email and columns for password hash, `created_at`, and `token_version`; do not edit `InitialSchema`; verify the migration file contains `CREATE TABLE` for `users` and the initial migration still has no domain tables
- [x] 3.2 Run `npm run migration:run` against Compose Postgres with a valid `.env`; verify the command exits 0 and the database has table `users` with a unique constraint on email

## 4. Repository

- [x] 4.1 Add `src/repositories/user-repository.ts` with `findByEmail` and `insert` (persist `passwordHash` + `tokenVersion` default 0; return `{ id, email }` only); map PostgreSQL unique violation `23505` to `ConflictError`; verify HTTP and service files do not import TypeORM `DataSource` / `Repository` / QueryBuilder

## 5. Service and unit tests

- [x] 5.1 Add `src/services/password-hasher.ts` that `await bcrypt.hash(plaintext, 10)` (or the chosen async API); verify the file has no `hashSync` / `pbkdf2Sync` / `scryptSync`
- [x] 5.2 Add `src/services/register-user.ts`: Zod-validate unknown input (trim/lowercase email, email format, password min 8 max 72) → `ValidationError`; `findByEmail` hit → `ConflictError`; `await hashPassword` then `insert`; log exactly `User registered: email=<email>` without password, hash, or `tokenVersion`; return `{ id, email }`; accept injectable `users` / `hashPassword` / logger deps; verify the service does not import TypeORM
- [x] 5.3 Add `src/services/register-user.test.ts` with a mocked repository: success (insert gets hash not plaintext; result keys only `id` and `email`; log contains `User registered: email=`); duplicate email (`ConflictError`, insert not called); validation (missing fields, invalid email, password shorter than 8 → `ValidationError`); verify `npm test` exits 0 and includes these cases

## 6. HTTP

- [x] 6.1 Add `src/http/routes/auth.ts` `POST /register` (no auth): pass `req.body` to the service, respond 201 with `{ id, email }`; mount at `/auth` in `app.ts` before `notFound`; verify `src/http` has no TypeORM imports, no login/logout routes, and `POST /auth/login` still hits the uniform 404 error body

## 7. Build and layering

- [x] 7.1 Grep `src` for `hashSync`, `pbkdf2Sync`, `scryptSync`, and TypeORM imports outside `src/config` and `src/repositories`; verify those greps are empty (hasher may import `bcrypt` only)
- [x] 7.2 Run `npm run build` and verify it exits 0 with `strict` compilation
