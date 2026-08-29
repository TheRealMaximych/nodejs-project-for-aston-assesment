# Запуск

Нужны **Node.js** (с npm) и **Docker**.

```bash
npm install
```

## Переменные окружения

Скопируйте `.env.example` в `.env`. Файл `.env` в git не коммитьте. `JWT_SECRET` в примере — заглушка: в локальном `.env` поставьте длинную случайную строку, реальный секрет не коммитьте.

cmd:

```bat
copy .env.example .env
```

Unix / macOS:

```bash
cp .env.example .env
```

Ключи: `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`. `DATABASE_URL` в `.env.example` совпадает с PostgreSQL из Compose (`localhost:5432`, БД `aston`).

## PostgreSQL

Только база, без контейнера приложения. Синоним: `docker-compose up -d`.

```bash
docker compose up -d
```

## Миграции и seed

После того как Postgres принимает соединения:

```bash
npm run migrate
npm run seed
```

`migrate` применяет pending-миграции. `seed` создаёт двух демо-пользователей с ненулевым балансом (идемпотентно). Идентификаторы счетов пишутся в лог seed (`accountId`).

## Старт API

```bash
npm run dev
```

Проверка: `GET http://localhost:3000/health` → `{ "status": "ok" }` (если `PORT=3000`).
Проверка API в браузере: [http://localhost:3000/](http://localhost:3000/) (если `PORT=3000`).

## npm-скрипты

| Скрипт | Назначение |
|---|---|
| `npm run dev` | API в режиме watch |
| `npm run build` | компиляция TypeScript |
| `npm test` | unit-тесты |
| `npm run migrate` | применить pending-миграции |
| `npm run seed` | демо-данные |
| `npm run migration:generate` | сгенерировать миграцию |
| `npm run migration:revert` | откатить последнюю миграцию |

## JWT

После seed и `dev`: `POST /auth/login` с `{ "email", "password" }` → `{ "accessToken" }`.

Демо-учётные данные (пароль в БД хранится как хеш):

| email | password |
|---|---|
| `alice.demo@example.com` | `DemoPass12` |
| `bob.demo@example.com` | `DemoPass12` |

```bash
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"alice.demo@example.com\",\"password\":\"DemoPass12\"}"
```

Токен вставьте в Swagger UI: **Authorize** → Bearer.

## OpenAPI / Swagger UI

После `npm run dev` (при `PORT=3000`): [http://localhost:3000/api-docs](http://localhost:3000/api-docs) (`GET /api-docs`, без токена).
