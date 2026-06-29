/**
 * Server-side real-time emit helper.
 *
 * Call `emitToProject(projectId, event, payload)` from inside an API route after
 * a successful mutation to broadcast the change to every other user currently
 * viewing that project (i.e. everyone who has joined the `project:<projectId>`
 * Socket.IO room).
 *
 * The Socket.IO server instance is created in `server.js` and stashed on
 * `globalThis.__io`. We read it lazily and guard for `undefined` so that:
 *   - importing this module never throws (safe during `next build`);
 *   - if the app is ever run under plain `next start` (no custom server),
 *     emits become silent no-ops instead of crashing the request.
 *
 * Usage (inside an API route handler):
 *
 *   import { emitToProject } from '@/lib/socket'
 *
 *   const task = await prisma.task.update({ ... })
 *   emitToProject(task.projectId, 'task:updated', { projectId: task.projectId, task })
 *   return NextResponse.json(task)
 */

import type { Server as SocketIOServer } from 'socket.io'

/** All real-time event names the app can broadcast. */
export type RealtimeEvent =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'comment:added'
  | 'comment:updated'
  | 'sprint:updated'
  | 'epic:updated'

/**
 * Base shape every payload must satisfy: it always carries the projectId (so
 * clients can sanity-check the room) plus arbitrary entity data. Concrete
 * payloads typically include the changed entity (`task`, `comment`, ...) or, for
 * deletes, just its id.
 */
export interface RealtimePayload {
  projectId: string
  [key: string]: unknown
}

/** Augment globalThis with the io instance set by server.js. */
declare global {
  // eslint-disable-next-line no-var
  var __io: SocketIOServer | undefined
}

/**
 * Read the Socket.IO server instance, or undefined if it has not been attached
 * (e.g. during build, or when not running under server.js).
 */
function getIO(): SocketIOServer | undefined {
  return globalThis.__io
}

/**
 * Broadcast a real-time event to every socket in a project's room.
 *
 * Safe to call from anywhere on the server: if no io instance is available the
 * call is a no-op.
 *
 * @param projectId The project whose room should receive the event.
 * @param event     One of the {@link RealtimeEvent} names.
 * @param payload   Event data. Should include at least `{ projectId, ... }`.
 */
export function emitToProject(
  projectId: string,
  event: RealtimeEvent,
  payload: unknown
): void {
  const io = getIO()
  if (!io) return
  if (!projectId) return
  io.to(`project:${projectId}`).emit(event, payload)
}
