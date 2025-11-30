# Zyra - Sprint Backlog Management

A Jira-like sprint backlog tool for managing your team's work. Simple, focused, and self-hosted.

## Features

- **Sprint Backlog View** - Kanban-style view of sprints and tasks
- **Drag & Drop** - Reorder tasks within sprints or move between sprints
- **Task Management** - Create, edit, assign, and track task status
- **Task Splitting** - Clone and link related tasks
- **Comments & @mentions** - Collaborate with team comments
- **Notifications** - In-app and email notifications for mentions
- **User Management** - Admin panel to create and manage team accounts

## Quick Start with Docker

```bash
# Clone and start
git clone <your-repo-url>
cd zyra

# Start with Docker Compose
docker compose up -d

# Run migrations
docker compose exec app npx prisma migrate deploy

# Seed initial admin user
docker compose exec app npx prisma db seed
```

Visit `http://localhost:3000` and login with:
- Email: `admin@example.com`
- Password: `admin123`

**Change this password immediately after first login!**

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16+

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update DATABASE_URL in .env with your PostgreSQL connection

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed admin user
npm run db:seed

# Start development server
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_URL` | Your app URL (e.g., http://localhost:3000) | Yes |
| `NEXTAUTH_SECRET` | Random secret for session encryption | Yes |
| `SMTP_HOST` | SMTP server host | For email |
| `SMTP_PORT` | SMTP server port (default: 587) | For email |
| `SMTP_USER` | SMTP username | For email |
| `SMTP_PASS` | SMTP password | For email |
| `SMTP_FROM` | From email address | For email |

## Production Deployment

### Using Docker

```bash
# Build the image
docker build -t zyra .

# Run with your environment variables
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="your-db-url" \
  -e NEXTAUTH_URL="https://your-domain.com" \
  -e NEXTAUTH_SECRET="your-secure-secret" \
  zyra
```

### Manual Build

```bash
npm run build
npm start
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS
- **Drag & Drop**: dnd-kit

## License

MIT
