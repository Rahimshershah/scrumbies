/**
 * Custom Next.js server with an attached Socket.IO real-time layer.
 *
 * This file REPLACES `next start`. In production PM2 should run `node server.js`
 * (see REALTIME.md). It does three things:
 *
 *   1. Boots Next.js and hands ALL http traffic (pages, API routes, _next assets)
 *      to Next's request handler — behaviour is identical to `next start`.
 *   2. Attaches a Socket.IO server to the same http.Server. Socket.IO uses its
 *      own path (/socket.io) so it never collides with Next routes.
 *   3. Exposes the io instance on globalThis.__io so server-side helpers
 *      (src/lib/socket.ts) can emit events from inside API routes without
 *      importing this file.
 *
 * Rooms model: one room per project, named `project:<projectId>`. A client
 * emits 'join' / 'leave' with a projectId and the server joins/leaves that room.
 * Helpers then broadcast with io.to(`project:<projectId>`).emit(event, payload),
 * so only users currently viewing that project receive the update.
 */

const http = require('http')
const next = require('next')
const { Server: SocketIOServer } = require('socket.io')
const { parse: parseUrl } = require('url')
const { decode: decodeNextAuthJwt } = require('next-auth/jwt')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOSTNAME || undefined

const app = next({ dev })
const handle = app.getRequestHandler()

/**
 * Parse a raw Cookie header into a plain object.
 * @param {string | undefined} header
 * @returns {Record<string, string>}
 */
function parseCookies(header) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    if (!key) continue
    out[key] = decodeURIComponent(val)
  }
  return out
}

/**
 * Extract the next-auth session token from parsed cookies.
 *
 * next-auth v4 names the cookie `next-auth.session-token` over http and
 * `__Secure-next-auth.session-token` over https. When the encrypted token is
 * large, next-auth splits it across numbered chunk cookies (`...session-token.0`,
 * `...session-token.1`, ...). We reassemble those in order.
 *
 * @param {Record<string, string>} cookies
 * @returns {string | null}
 */
function extractSessionToken(cookies) {
  const baseNames = [
    '__Secure-next-auth.session-token',
    'next-auth.session-token',
  ]
  for (const base of baseNames) {
    if (cookies[base]) return cookies[base]
    // Reassemble chunked cookies: base.0, base.1, ...
    const chunkKeys = Object.keys(cookies)
      .filter((k) => k.startsWith(base + '.'))
      .sort((a, b) => {
        const ai = parseInt(a.slice(base.length + 1), 10)
        const bi = parseInt(b.slice(base.length + 1), 10)
        return ai - bi
      })
    if (chunkKeys.length > 0) {
      return chunkKeys.map((k) => cookies[k]).join('')
    }
  }
  return null
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    try {
      const parsedUrl = parseUrl(req.url || '', true)
      handle(req, res, parsedUrl)
    } catch (err) {
      console.error('[server] error handling request', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  const io = new SocketIOServer(server, {
    path: '/socket.io',
    // Same-origin in production (served behind the same nginx host), so we do
    // not need permissive CORS. Adjust here if you ever serve the client from
    // a different origin.
    serveClient: false,
  })

  /**
   * Auth middleware.
   *
   * Approach: read the handshake cookies, pull out the next-auth session token,
   * and verify it with `decode()` from `next-auth/jwt` using NEXTAUTH_SECRET.
   * `decode()` performs the same JWE decryption next-auth uses internally, so a
   * forged/expired/tampered token fails to decode and yields no userId.
   *
   * The decoded payload carries `id`/`role` (set by the jwt callback in
   * src/lib/auth.ts) plus the standard `sub`. We attach userId to socket.data.
   *
   * Design choice: we do NOT reject unauthenticated sockets here. Room join by
   * projectId must work regardless (per spec), and rejecting connections would
   * make the real-time layer fail closed on any cookie/secret hiccup. If you
   * want to hard-gate connections, throw `next(new Error('unauthorized'))`
   * when userId is missing. (TODO: tighten this once project-level membership
   * checks are wired in — see the 'join' handler.)
   */
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie)
      const token = extractSessionToken(cookies)
      const secret = process.env.NEXTAUTH_SECRET

      if (token && secret) {
        const decoded = await decodeNextAuthJwt({ token, secret })
        if (decoded) {
          socket.data.userId = decoded.id || decoded.sub || null
          socket.data.role = decoded.role || null
        }
      }
    } catch (err) {
      // Decode failures (tampered token, wrong secret) are non-fatal: the socket
      // simply stays unauthenticated. Log for visibility.
      console.warn('[socket] auth decode failed:', err && err.message)
    }
    // Always allow the connection; userId may be null for anonymous sockets.
    next()
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId || 'anonymous'

    socket.on('join', (projectId) => {
      if (typeof projectId !== 'string' || !projectId) return
      // TODO: verify this user is a member of `projectId` before joining,
      // using socket.data.userId. Until then any authenticated socket may
      // subscribe to any project room.
      socket.join(`project:${projectId}`)
    })

    socket.on('leave', (projectId) => {
      if (typeof projectId !== 'string' || !projectId) return
      socket.leave(`project:${projectId}`)
    })

    socket.on('disconnect', () => {
      // Rooms are cleaned up automatically by Socket.IO on disconnect.
    })

    if (dev) {
      console.log(`[socket] connected ${socket.id} (user: ${userId})`)
    }
  })

  // Expose io to server-side helpers (src/lib/socket.ts reads this).
  globalThis.__io = io

  server.listen(port, hostname, () => {
    console.log(
      `> Ready on http://${hostname || 'localhost'}:${port} (Socket.IO on /socket.io)`
    )
  })
})
