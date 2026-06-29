'use client'

/**
 * Client-side Socket.IO provider for the real-time layer.
 *
 * Wrap the app (around AppShell) with <SocketProvider projectId={...}>, then any
 * descendant can call `useSocket()` to:
 *   - read the live connection status,
 *   - subscribe(event, handler) to server-broadcast events (returns an
 *     unsubscribe function),
 *   - switch the active project room via setProjectId().
 *
 * The provider opens a single same-origin Socket.IO connection (path /socket.io)
 * and keeps it joined to exactly one `project:<projectId>` room at a time. When
 * projectId changes it leaves the old room and joins the new one; on unmount it
 * disconnects. Auth is handled server-side via the next-auth cookie that the
 * browser sends with the handshake (see server.js) — nothing to pass here.
 *
 * ---------------------------------------------------------------------------
 * Usage example — a list component that lives-updates a single task:
 *
 *   'use client'
 *   import { useEffect, useState } from 'react'
 *   import { useSocket } from '@/contexts/socket-context'
 *
 *   function TaskRow({ initialTask }) {
 *     const { subscribe } = useSocket()
 *     const [task, setTask] = useState(initialTask)
 *
 *     useEffect(() => {
 *       // subscribe returns an unsubscribe fn — return it for cleanup.
 *       return subscribe('task:updated', (payload) => {
 *         if (payload?.task?.id === task.id) {
 *           setTask(payload.task)
 *         }
 *       })
 *     }, [subscribe, task.id])
 *
 *     return <div>{task.title}</div>
 *   }
 * ---------------------------------------------------------------------------
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'

/** Mirror of the server-side RealtimeEvent union (kept in sync manually). */
export type RealtimeEvent =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'comment:added'
  | 'comment:updated'
  | 'sprint:updated'
  | 'epic:updated'

export type SocketStatus = 'connecting' | 'connected' | 'disconnected'

type EventHandler = (payload: any) => void

interface SocketContextValue {
  /** The live socket (or null before it has been created). */
  socket: Socket | null
  /** Current connection status. */
  status: SocketStatus
  /** True while connected. */
  connected: boolean
  /** The project room currently joined (or null). */
  projectId: string | null
  /** Switch the active project room. */
  setProjectId: (projectId: string | null) => void
  /**
   * Subscribe to a real-time event. Returns an unsubscribe function — call it
   * (or return it from a useEffect) to remove the listener.
   */
  subscribe: (event: RealtimeEvent, handler: EventHandler) => () => void
}

const SocketContext = createContext<SocketContextValue | null>(null)

export function SocketProvider({
  children,
  projectId: projectIdProp = null,
}: {
  children: ReactNode
  /** Initial / controlled project room to join. */
  projectId?: string | null
}) {
  const socketRef = useRef<Socket | null>(null)
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const [projectId, setProjectId] = useState<string | null>(projectIdProp)

  // Lazily create the single socket during the first CLIENT render (not in an
  // effect). React runs child effects before parent effects, so if we created
  // the socket in this provider's mount effect, a descendant's subscribe() in
  // its own mount effect would run first and see a null socket — and silently
  // never attach. Creating it here in render guarantees the socket exists
  // before any descendant effect runs. Guarded for SSR (window check) and to
  // create exactly once.
  if (socketRef.current === null && typeof window !== 'undefined') {
    socketRef.current = io({
      path: '/socket.io',
      // Same-origin: the browser sends the next-auth cookie automatically.
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
  }

  // Keep internal projectId in sync when the prop changes (controlled usage).
  useEffect(() => {
    setProjectId(projectIdProp)
  }, [projectIdProp])

  // Attach connection-status handlers to the (already created) socket and tear
  // down on unmount.
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const onConnect = () => setStatus('connected')
    const onDisconnect = () => setStatus('disconnected')
    const onConnectError = () => setStatus('disconnected')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)

    setStatus(socket.connected ? 'connected' : 'connecting')

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  // Join / leave the project room whenever projectId changes.
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !projectId) return

    const join = () => socket.emit('join', projectId)

    // Join now (if already connected) and re-join on every (re)connect, so a
    // dropped connection automatically restores the room membership.
    if (socket.connected) join()
    socket.on('connect', join)

    return () => {
      socket.off('connect', join)
      // Best-effort leave; the server also drops the room on disconnect.
      if (socket.connected) socket.emit('leave', projectId)
    }
  }, [projectId])

  // subscribe is stable; handlers attach/detach against the current socket.
  const subscribe = useCallback(
    (event: RealtimeEvent, handler: EventHandler) => {
      const socket = socketRef.current
      if (!socket) return () => {}
      socket.on(event, handler)
      return () => {
        socket.off(event, handler)
      }
    },
    []
  )

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: socketRef.current,
      status,
      connected: status === 'connected',
      projectId,
      setProjectId,
      subscribe,
    }),
    [status, projectId, subscribe]
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

/**
 * Access the socket connection, status, and subscribe helper.
 * Must be called inside a <SocketProvider>.
 */
export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return ctx
}
