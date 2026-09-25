# Web client conventions

Read this before adding a feature. The app is **zero-dependency** (React 19 + TypeScript bundled by esbuild); everything else is hand-written in `src/lib` and `src/ui`. Do not add npm packages — the sandbox cannot install them.

## Layout

```
src/
  main.tsx              entry; imports global CSS
  app/                  App routes, auth, workspace context, shell (sidebar/topbar), data hooks
    data.ts             ← ALL server access goes through here (hooks + api helpers + cache keys)
    workspace.tsx       useWorkspace(): { workspace, projects, members, isAdmin, canEdit, base, projectByKey, member() }
    auth.tsx            useAuth(), useMe()
    shell/Topbar.tsx    useTopbar(crumbs, actions, deps) — every page sets its breadcrumbs
  lib/                  router, api, query (cache), realtime (SSE), store, hooks, format, markdown, dnd, toast
  ui/                   primitives (Button, Input, Field, Checkbox, Switch, Segmented, Avatar, Badge, Kbd, Skeleton,
                        EmptyState, Progress, PriorityIcon, StatusIcon), overlays (Popover, Menu, MenuButton, Tooltip,
                        Dialog, useConfirm, Toaster, Tabs), pickers (ListPicker, Select, DatePicker, CalendarGrid,
                        ColorPicker), Icon (name-based SVG set), Logo
  features/<name>/      one folder per feature; put CSS in `<name>.css` next to the component and `import './x.css'`
  styles/               tokens.css (design tokens, dark theme), base.css (reset/utilities/markdown), components.css, layout.css, features.css
packages/shared/src     types.ts (domain types), constants.ts, validate.ts, utils.ts — shared with the API
```

## Rules

1. **Data:** use hooks/helpers from `app/data.ts` (`useTasks`, `useBundle`, `updateTask`, `moveTask`, `createTask`, `taskApi.*`, `projectApi.*`, `workspaceApi.*`, `notificationApi.*`). Never call `fetch` directly. Cache keys are in `keys`. Optimistic updates: `patchTaskCache()`; refresh with `invalidate(prefix)` from `lib/query.ts`. Realtime events already patch the cache (`lib/realtime.ts`) — you rarely need to subscribe; use `onRealtime(type, handler)` only for ephemeral things (typing indicators).
2. **Styling:** CSS variables only (`var(--fg)`, `var(--surface)`, `var(--border)`, `var(--brand)`, spacing `var(--s-*)`, radii `var(--r-*)`, fonts `var(--fs-*)`). No hard-coded colors except data colors coming from the server (status/label/project colors). Everything must look right in dark mode (`:root[data-theme='dark']`). Class names are kebab-case, prefixed by feature (`board-column`, `list-row`). Reuse utilities from base.css (`.row .col .gap-2 .grow .between .truncate .muted .small .xs .mono`).
3. **Components:** use `ui/*` primitives; do not re-implement buttons, menus, dialogs, pickers. Task field pickers (status, priority, assignee, labels, due date, estimate, recurrence) live in `features/tasks/fields.tsx` — reuse them everywhere. Markdown editing/rendering: `features/tasks/Editor.tsx` (`Editor`, `MarkdownView`).
4. **Routing:** `lib/router.tsx` — `Link`, `navigate`, `useParams`, `useSearchParams`, `useLocation`. Workspace pages live under `/w/:slug/...`; `useWorkspace().base` gives the prefix. The task peek panel is opened with `setParams({ task: 'KEY-12' }, { replace: false })` from `useSearchParams()`.
5. **Types:** import domain types from `packages/shared/src/types.ts` with a relative path and `.ts` extension (e.g. `import type { Task } from '../../../../../packages/shared/src/types.ts'`). All imports use explicit `.ts`/`.tsx` extensions.
6. **Icons:** `<Icon name="…" size={16} />` from `ui/Icon.tsx`. Only names defined in that file exist — add a path there if you need a new one.
7. **Feedback:** `toast.success/error/fromError` from `lib/toast.ts`; destructive actions go through `const confirm = useConfirm(); if (!(await confirm({ title, description, danger: true, confirmLabel }))) return;`.
8. **Keyboard:** `useHotkey('mod+k', fn)` from `lib/hooks.ts` (sequences like `'g b'` supported). Shortcuts are documented in `app/shell/ShortcutsDialog.tsx` — keep it in sync.
9. **Permissions:** `useWorkspace().canEdit` (guests are read-only), `isAdmin`. Hide/disable mutating controls accordingly. Bundle `project.leadId === me.id` also grants manage rights on that project.
10. **Empty / loading / error states** for every list. Use `Skeleton` while loading and `EmptyState` when empty. Handle `RequestError` messages.
11. **Accessibility:** buttons have labels (`aria-label` for icon-only), dialogs trap focus (handled by `Dialog`), lists are keyboard navigable where practical.
12. **Type-check before finishing:** `node_modules/.bin/tsc -p apps/web/tsconfig.json` must pass with zero errors. Build: `node scripts/build.mjs`.

## Testing a feature in the browser

Each agent uses its own output dir, port and database so parallel work doesn't collide:

```bash
OUT_DIR=dist-<name> node scripts/build.mjs
PORT=31xx WEB_DIST=dist-<name>/web DATA_DIR=/tmp/tt-<name> NODE_ENV=development SEED_DEMO=true JWT_SECRET=dev \
  node --no-warnings=ExperimentalWarning apps/api/src/server.ts &
BASE=http://127.0.0.1:31xx node e2e/shot.mjs /w/acme-labs/p/APP e2e/screenshots/<name>.png --login
```

Demo login: `shivam@demo.teamtask.app` / `password123`, workspace slug `acme-labs`, projects `APP`, `WEB`, `INFRA`.
`e2e/shot.mjs` prints console errors — fix them. For interactions, write a small Playwright script (see `e2e/shot.mjs` for the launch options; the Chromium binary is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
