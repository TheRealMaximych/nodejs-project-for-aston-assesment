## 1. npm migrate alias

- [x] 1.1 Add `"migrate": "npm run migration:run"` to `package.json` without removing `migration:run`, `migration:generate`, `migration:revert`, `seed`, `dev`, `build`, or `test`; verify `package.json` lists `migrate` and that its command invokes the existing migration-run script

## 2. Launch README

- [x] 2.1 Add root `README.md` in Russian with ordered steps: Node.js + npm + Docker, `npm install`, copy `.env.example` to `.env` (`copy` and `cp`), do not commit `.env` or a real `JWT_SECRET`, `docker compose up -d` for PostgreSQL only, `npm run migrate`, `npm run seed`, `npm run dev`; verify the file exists at the repo root and contains those commands in that order
- [x] 2.2 In `README.md` list npm scripts `dev`, `build`, `test`, `migrate`, and `seed`; document `POST /auth/login` with demo emails `alice.demo@example.com` and `bob.demo@example.com` and password `DemoPass12` returning `{ "accessToken" }`; document Swagger UI at `http://localhost:3000/api-docs`; include a login `curl` (or equivalent) example; verify those strings are in README and that README does not contain a signed JWT (`eyJ`) or a production `JWT_SECRET`
- [x] 2.3 Keep README launch-only: no HTTP/service/repository architecture, no stack justification, no copy of `AGENTS.md`; do not edit `AGENTS.md`, `src/`, `migrations/`, `seeds/`, `docker-compose.yml`, or `.env.example` in this change; verify grep of README has no layering/architecture sections and `git diff` for those paths is empty aside from `package.json` and `README.md`

## 3. Build, secrets, and existing tests

- [x] 3.1 Confirm `.gitignore` still lists `.env` and that this change does not stage `.env`; verify `git check-ignore -v .env` matches and no `.env` file is added
- [x] 3.2 Run `npm test` and `npm run build` and verify both exit 0 (no new `src/**/*.test.ts` files in this change)
