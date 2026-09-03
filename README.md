# Office Table Tennis Cup

Single-page company elimination tournament: people register, play **best of 3**, and winners advance to the next round.

This is a **Next.js** app (the page **and** a small API) with a **SQLite** file on disk. It is not frontend-only, and it is not part of Pasaj.

## Run locally

```bash
cd /Users/TCFUATAK/workspace/tt-cup
cp .env.example .env   # already created for you
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Defaults in `.env`

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite file under `prisma/` |
| `AUTH_SECRET` | (change in real use) | Signs the “this is me” cookie |
| `TT_JOIN_CODE` | `paddle` | Shared code on the register form |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `changeme` | Hidden staff desk |

## How it works

- **Players:** first name + last name. No email, no login. The browser that registered can edit or remove **only that listing**.
- **Matches:** single elimination, best of 3, games to 11, win by 2 from 10–10. The tournament administrator records results and advances winners.
- **Admin:** not linked from the public page. Open `/admin/login` if you know the URL.

## Scripts

- `npm run dev` — local server
- `npm run db:setup` — create SQLite tables and seed demo players
- `npm run db:seed` — reset demo data
