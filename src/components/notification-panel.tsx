'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Notification } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'

interface NotificationPanelProps {
  onClose: () => void
  onTaskSelect?: (taskId: string) => void
  onMarkAllRead?: () => void
}

const NOTIFICATIONS_LIMIT = 10 // Show "View All" button when there are more than this

export function NotificationPanel({ onClose, onTaskSelect, onMarkAllRead }: NotificationPanelProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await fetch('/api/notifications')
        const data = await res.json()
        setNotifications(data)
      } catch (error) {
        console.error('Failed to load notifications:', error)
      } finally {
        setLoading(false)
      }
    }
    loadNotifications()
  }, [])

  async function markAllRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      onMarkAllRead?.()
    } catch (error) {
      console.error('Failed to mark notifications as read:', error)
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, read: true }),
      })
      setNotifications((prev) => prev.map((n) => n.id === notificationId ? { ...n, read: true } : n))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  async function handleNotificationClick(notification: Notification) {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id)
    }

    // Navigate to task if it exists
    if (notification.task?.id) {
      onClose()
      if (onTaskSelect) {
        onTaskSelect(notification.task.id)
      } else {
        // Fallback: navigate to home with task query param
        router.push(`/?task=${notification.task.id}`)
      }
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length
  const displayedNotifications = notifications.slice(0, NOTIFICATIONS_LIMIT)
  const hasMore = notifications.length > NOTIFICATIONS_LIMIT

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <Card className="absolute right-0 mt-2 w-80 z-50 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No notifications
            </div>
          ) : (
            <>
              {displayedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-accent/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        !notification.read ? 'bg-primary' : 'bg-transparent'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {notification.type === 'MENTION'
                          ? 'You were mentioned in a comment'
                          : 'You were assigned a task'}
                      </p>
                      {notification.task && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {notification.task.title}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="px-4 py-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      onClose()
                      router.push('/notifications')
                    }}
                  >
                    View All Notifications
                  </Button>
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </Card>
    </>
  )
}
