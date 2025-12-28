import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scrumbies - Sprint Backlog',
  description: 'Sprint backlog management tool for agile teams',
  applicationName: 'Scrumbies',
  keywords: ['scrum', 'agile', 'sprint', 'backlog', 'project management', 'kanban'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
