# Real-time layer (Socket.IO) — integration guide

This document is for the **integrator**. The foundation is scaffolded; this
explains the few changes needed to turn it on and where to wire emits.

## What was built

A minimal, project-scoped real-time layer using Socket.IO.

| Concern | File | Notes |
|---|---|---|
| Custom Next.js server + Socket.IO | `server.js` (root) | Replaces `next start`. Boots Next, serves all HTTP, attaches Socket.IO, exposes `globalThis.__io`. |
| Server-side emit helper | `src/lib/socket.ts` | `emitToProject(projectId, event, payload)` + `RealtimeEvent` union. Safe no-op if io is absent. |
| Client provider + hook | `src/contexts/socket-context.tsx` | `<SocketProvider>` + `useSocket()` (status, `subscribe`, `setProjectId`). |
| Deps | `package.json` | Added `socket.io` and `socket.io-client` (run `npm install`). |

### Model

- **One room per project**, named `project:<projectId>`.
- A client emits `join` / `leave` with a `projectId`; the server runs
  `socket.join('project:'+projectId)`.
- API routes call `emitToProject(projectId, event, payload)`, which broadcasts
  `io.to('project:'+projectId).emit(event, payload)` — so only users currently
  viewing that project receive the update.
- Socket.IO uses path `/socket.io`; it never collides with Next routes.

### Socket auth approach

On every connection an `io.use(...)` middleware:

1. Reads `socket.handshake.headers.cookie`.
2. Extracts the next-auth session token, handling both cookie names
   (`next-auth.session-token` on http, `__Secure-next-auth.session-token` on
   https) **and** next-auth's numbered chunk cookies (`...session-token.0/.1`).
3. Verifies it with `decode({ token, secret })` from **`next-auth/jwt`** using
   `NEXTAUTH_SECRET`. This performs the same JWE decryption next-auth uses
   internally, so forged/expired/tampered tokens fail to decode.
4. On success, attaches `socket.data.userId` (and `role`).

**Design choice:** the middleware does **not** reject unauthenticated sockets —
room-join by `projectId` works regardless (per spec), and failing closed on any
cookie hiccup would break real-time entirely. To hard-gate connections, change
the middleware to `next(new Error('unauthorized'))` when `userId` is missing.

> **TODO (follow-up):** the `join` handler does not yet verify that
> `socket.data.userId` is a member of the requested project. Any authenticated
> socket can currently subscribe to any project room. Add a membership check in
> the `socket.on('join', ...)` handler in `server.js` once you decide how strict
> to be.

---

## Change 1 — PM2: run `node server.js` (not `npm start`)

The app must run under the custom server so Socket.IO is attached. This also
fixes the separate issue of PM2 monitoring the `npm` wrapper process instead of
the real Node server.

**Recommended `ecosystem.config.js`** (place at `/var/www/scrumbies/`):

```js
module.exports = {
  apps: [
    {
      name: 'scrumbies',
      script: 'server.js',          // <-- the custom server, NOT `npm start`
      cwd: '/var/www/scrumbies',
      instances: 1,                  // single instance (see scaling note below)
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
```

Apply on the server (one-time switch from the old npm-wrapped process):

```bash
cd /var/www/scrumbies
pm2 delete scrumbies            # remove the old `npm start` process
pm2 start ecosystem.config.js   # start `node server.js`
pm2 save                        # persist across reboots
```

On subsequent deploys, `pm2 restart scrumbies` is enough. **Note:** the existing
`server-deploy.sh` does `npm run build` then `pm2 restart scrumbies` — that
continues to work once the process is recreated as above. (Do not edit
`server-deploy.sh` as part of this; just do the one-time `pm2 delete` + `pm2 start`.)

> **Scaling note:** Socket.IO rooms live in-process. If you ever move to
> `instances > 1` / cluster mode, add the Socket.IO Redis adapter so emits fan
> out across workers. With a single instance (current setup) no adapter is needed.

---

## Change 2 — nginx: allow WebSocket upgrades on `/socket.io`

The existing `proxy_pass http://127.0.0.1:3000` works for HTTP, but WebSocket
needs the `Upgrade`/`Connection` headers forwarded. Easiest: add them to the
existing `location /` block so both normal traffic and `/socket.io` upgrade
correctly. (No separate location is required because `/socket.io` is same-origin
and already proxied; you only need the upgrade headers present.)

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;          # <-- required for WS
    proxy_set_header Connection $connection_upgrade;  # <-- required for WS
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;   # keep long-lived sockets open
}
```

And in the `http { }` block (once, top-level), define the upgrade map:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

> If a CDN/Cloudflare sits in front, make sure WebSockets are enabled there too
> (they are by default on Cloudflare). The client also falls back to HTTP
> long-polling if WS is blocked, so functionality degrades gracefully.

After editing: `nginx -t && systemctl reload nginx`.

---

## Change 3 — Mount `<SocketProvider>` (wrap AppShell)

`AppShell` already tracks the active project as `currentProjectId` /
`effectiveProjectId` (`src/components/app-shell.tsx`). Mount the provider so it
wraps the rendered tree and receives that id. Two equivalent options:

**Option A — inside `app-shell.tsx`** (recommended; it has `effectiveProjectId`):
wrap the existing `<ProjectSettingsProvider ...>` return with
`<SocketProvider projectId={effectiveProjectId}>`. When the user switches
projects, `effectiveProjectId` changes and the provider auto leaves/joins rooms.

```tsx
import { SocketProvider } from '@/contexts/socket-context'
// ...
return (
  <SocketProvider projectId={effectiveProjectId}>
    <ProjectSettingsProvider key={effectiveProjectId} projectId={effectiveProjectId}>
      {/* ...existing tree... */}
    </ProjectSettingsProvider>
  </SocketProvider>
)
```

**Option B — in `providers.tsx`**: only if a global (project-less) socket is
desired; you'd then drive the room via `useSocket().setProjectId(...)` from
within AppShell. Option A is simpler and preferred.

Consumers then use the hook (see the usage example at the top of
`src/contexts/socket-context.tsx`):

```tsx
const { subscribe } = useSocket()
useEffect(() => subscribe('task:updated', (p) => { /* update local state */ }), [subscribe])
```

---

## Change 4 — Add `emitToProject(...)` to mutating API routes

Import `emitToProject` from `@/lib/socket` and call it **after** the successful
mutation (and before/with the JSON response). Every payload should include at
least `{ projectId, ... }` plus the changed entity (or its id for deletes).

| Route file | Trigger | Event | Suggested payload |
|---|---|---|---|
| `src/app/api/tasks/route.ts` | task created (POST) | `task:created` | `{ projectId, task }` |
| `src/app/api/tasks/[id]/route.ts` | task updated (PATCH/PUT) | `task:updated` | `{ projectId, task }` |
| `src/app/api/tasks/[id]/route.ts` | task deleted (DELETE) | `task:deleted` | `{ projectId, taskId }` |
| `src/app/api/tasks/[id]/comments/route.ts` | comment added (POST) | `comment:added` | `{ projectId, taskId, comment }` |
| `src/app/api/comments/[id]/route.ts` | comment edited (PATCH/PUT) | `comment:updated` | `{ projectId, taskId, comment }` |
| `src/app/api/sprints/[id]/route.ts` | sprint updated (PATCH/PUT) | `sprint:updated` | `{ projectId, sprint }` |
| `src/app/api/epics/[id]/route.ts` | epic updated (PATCH/PUT) | `epic:updated` | `{ projectId, epic }` |

> You need `projectId` available in each handler. For task/comment routes,
> derive it from the task being mutated (e.g. the `projectId` on the updated
> task, or fetch it alongside the entity). These routes were intentionally left
> untouched in this scaffold.

Example wiring (illustrative — apply in `src/app/api/tasks/[id]/route.ts`):

```ts
import { emitToProject } from '@/lib/socket'

const task = await prisma.task.update({ where: { id }, data, /* include projectId */ })
emitToProject(task.projectId, 'task:updated', { projectId: task.projectId, task })
return NextResponse.json(task)
```

---

## Local sanity check

```bash
npm install                # pull in socket.io + socket.io-client
NODE_ENV=production npm run build
node server.js             # should log "> Ready on http://localhost:3000 (Socket.IO on /socket.io)"
```

In dev, `node server.js` also works (it sets Next dev mode automatically). The
normal `next dev` does **not** attach Socket.IO — use `node server.js` when you
want to exercise real-time locally.
