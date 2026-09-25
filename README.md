<p align="center">
  <img src="apps/web/public/favicon.svg" width="56" alt="TeamTask" />
</p>
<h1 align="center">TeamTask</h1>
<p align="center">A modern, real-time team task manager — boards, lists, calendars and timelines that stay in sync for everyone.<br/>
<b>Zero runtime dependencies.</b> React 19 + TypeScript on the client, Node 22 built-ins on the server, SQLite for storage.</p>

---

## Features

**Work management**
- Workspaces with **Owner / Admin / Member / Guest** roles, email invites with shareable links, private projects
- Projects with custom **workflow statuses** (drag to reorder, categories: backlog / todo / in progress / done / cancelled), labels, leads, target dates
- Tasks with priority, assignee, start/due dates, estimates, **subtasks, checklists, relations (blocks / blocked by / relates / duplicates), attachments, time tracking, recurrence**, watchers, archive
- Four project views: **Board** (drag & drop Kanban), **List** (grouped, sortable, inline editing), **Calendar** (drag to reschedule, multi-day bars), **Timeline** (Gantt — drag to move, resize to change dates)
- Filters (status, assignee, priority, label, due, search), **saved views** (personal or shared), multi-select **bulk actions**
- Markdown descriptions and comments with **@mentions**, task-key autolinks (`APP-12`), checkboxes, file paste/drop

**Collaboration**
- **Real-time** updates via Server-Sent Events: board moves, edits, comments, typing indicators, presence ("who's online")
- Notifications inbox (assigned, mentioned, commented, status changed, due soon, invites) with optional email
- Full **activity / audit log** per task, project and workspace

**Productivity**
- Home dashboard: stats, throughput chart, status donut, priority breakdown, my tasks, overdue, upcoming, team workload
- "My work" page, global search, **command palette** (`⌘K`), keyboard shortcuts everywhere (`?` to see them)
- Light / dark / system theme, compact density, mobile-friendly layouts

**Platform**
- Secure auth: scrypt password hashing, short-lived access tokens + rotating httpOnly refresh cookies, session management, password reset, rate limiting
- SQLite (WAL) via `node:sqlite` — a single file to back up; migrations run automatically
- Single process serves API + static client; builds in under a second with esbuild

## Quick start

Requirements: **Node.js ≥ 22.18** (uses built-in type stripping and `node:sqlite`).

```bash
npm install          # only dev tooling: esbuild, typescript, playwright, @types
npm run dev          # API on http://localhost:3000 with live rebuilds of the client
```

Open http://localhost:3000, create an account and a workspace. To explore with demo data:

```bash
SEED_DEMO=true npm run dev
# login: shivam@demo.teamtask.app / password123  (workspace "Acme Labs")
```

## Production

```bash
cp .env.example .env    # set JWT_SECRET (openssl rand -hex 32), APP_URL, optional SMTP
npm ci
npm run build           # → dist/web (client) + dist/api/server.js (server)
npm start
```

The server listens on `PORT` (default 3000), serves the client, and stores data in `DATA_DIR` (default `./data`: `teamtask.db` + `uploads/`). Put `DATA_DIR` on a persistent volume.

### Railway

The repo ships `railway.toml` / `nixpacks.toml`. Add a **Volume** mounted at `/data`, then set variables:

```
DATA_DIR=/data
JWT_SECRET=<long random string>
APP_URL=https://<your-app>.up.railway.app
NODE_ENV=production
```

Optional email (invites, password resets, notification emails): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Without SMTP, invite and reset links are shown in the UI and printed to the server log.

### Docker

```bash
docker build -t teamtask .
docker run -p 3000:3000 -v teamtask-data:/data -e JWT_SECRET=change-me -e APP_URL=http://localhost:3000 teamtask
```

## Project layout

```
apps/api/src          Node server (no framework): lib/http.ts router, db/ (SQLite + migrations), modules/ (auth,
                      users, workspaces, invites, projects, tasks, collab, feed), lib/realtime.ts (SSE hub)
apps/web/src          React client: lib/ (router, query cache, realtime, dnd, markdown), ui/ (design system),
                      app/ (shell, auth, data hooks), features/ (board, list, calendar, timeline, tasks, …)
packages/shared/src   Domain types, constants, validation and date utilities shared by both
e2e/                  API integration tests and Playwright browser suites
scripts/              build.mjs (esbuild), dev.mjs
```

See `apps/web/CONVENTIONS.md` for client architecture and coding rules.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API with auto-restart + client watch build |
| `npm run build` | Production build into `dist/` |
| `npm start` | Run the production server |
| `npm run typecheck` | Type-check API and client |
| `npm run seed` | Insert the demo workspace |
| `npm test` | API integration tests (spins up a temp server) |
| `npm run test:e2e` | Browser test suites (needs a running dev server on :3000 with `SEED_DEMO=true`) |

## API overview

All endpoints live under `/api` and return JSON; errors look like `{ "error": { "code", "message", "details" } }`.
Authenticate with `Authorization: Bearer <accessToken>` (from `POST /api/auth/login`); refresh with `POST /api/auth/refresh` (cookie).

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/signup` `/auth/login` `/auth/refresh` `/auth/logout` `/auth/forgot-password` `/auth/reset-password` `/auth/change-password` · `GET /auth/me` `/auth/sessions` |
| Workspaces | `GET/POST /workspaces` · `GET/PATCH/DELETE /workspaces/:id` · `GET /workspaces/by-slug/:slug` · members `GET /workspaces/:id/members`, `PATCH/DELETE …/members/:userId` · invites `GET/POST /workspaces/:id/invites`, `GET /invites/:token`, `POST /invites/:token/accept` |
| Projects | `GET/POST /workspaces/:id/projects` · `GET/PATCH/DELETE /projects/:id` · `GET /projects/:id/bundle` · statuses, labels, members, views under `/projects/:id/…` |
| Tasks | `GET/POST /projects/:id/tasks` · `GET/PATCH/DELETE /tasks/:id` · `POST /tasks/:id/move` `/duplicate` `/watch` · `POST /tasks/bulk` `/tasks/bulk-delete` · checklist, relations, comments, attachments, time, activity under `/tasks/:id/…` |
| Feed | `GET /notifications` · `GET /workspaces/:id/activity` `/search?q=` `/dashboard` `/my-tasks` · `GET /events?workspace=…` (SSE) |

## Security notes

- Passwords: scrypt (N=16384) with per-user salt. Access tokens: HS256 JWT, 15 min. Refresh tokens: 30 days, stored hashed, rotated on every use, `HttpOnly` + `SameSite=Lax`.
- Rate limits on login/signup/reset and a global per-IP limit. Security headers (`nosniff`, `frame-deny`, HSTS in production over HTTPS).
- All input is validated server-side; markdown is rendered from escaped text (no raw HTML).
- Uploads are stored outside the web root with random names and served only to members of the task's project.

## License

MIT
