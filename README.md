<p align="center">
  <img src="https://em-content.zobj.net/source/apple/391/direct-hit_1f3af.png" width="80" alt="Scrumbies Logo" />
</p>

<h1 align="center">Scrumbies</h1>

<p align="center">
  <strong>The Open Source JIRA & Confluence Alternative</strong><br/>
  Sprint management should cost as much as Netflix 🍿
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#self-hosting">Self-Hosting</a> •
  <a href="#built-with-claude">Built with Claude</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Built%20with-Claude%20Code-blueviolet" alt="Built with Claude Code" />
  <img src="https://img.shields.io/badge/Next.js-14-black" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript 5" />
</p>

---

## 🎯 Why Scrumbies?

**JIRA costs $8.15/user/month** (and that's just the starting price). For a team of 10, that's nearly **$1,000/year** — just for basic sprint management.

**Confluence adds another $6.05/user/month**. Now you're looking at over **$1,700/year** for basic project tracking and documentation.

**Scrumbies gives you both — for free.** Self-host it, own your data, and never pay per-seat licensing again.

> *"Why pay enterprise prices when Netflix costs $15/month?"*

---

## ✨ Features

### 🏃 Sprint Management (JIRA Alternative)
- **Backlog Management** — Organize and prioritize your product backlog
- **Sprint Planning** — Plan sprints with drag-and-drop simplicity
- **Kanban Board** — Visualize work with customizable status columns
- **Task Management** — Create, assign, estimate, and track tasks
- **Task Splitting** — Split incomplete work across sprints with full history
- **Custom Statuses** — Define your own workflow (TODO, In Progress, Testing, Done, Live)
- **Custom Teams** — Organize by team (Mobile, Web, Backend, Ops, etc.)
- **Priority Levels** — Low, Medium, High, Urgent with visual indicators
- **Sprint Velocity** — Track completion rates and team performance

### 📝 Documentation Spaces (Confluence Alternative)
- **Folders & Documents** — Organize documentation in a familiar hierarchy
- **Rich Text Editor** — Full formatting with headers, lists, code blocks, and more
- **Document Linking** — Link documents to tasks for complete context
- **Version History** — Track changes and restore previous versions
- **Comments & Discussion** — Collaborate directly on documents
- **File Attachments** — Attach images, PDFs, videos up to 20MB

### 👥 Team Collaboration
- **@Mentions** — Tag teammates in comments and descriptions
- **Real-time Comments** — Discuss tasks and documents with threaded replies
- **Email Notifications** — Get notified about assignments, comments, and mentions
- **Weekly Digest** — Summary emails of completed and in-progress work
- **User Invites** — Invite team members via email with project assignment

### 🔐 Access Control
- **Role-Based Access** — Admin and Member roles
- **Project-Based Permissions** — Assign users to specific projects
- **Self-Hosted Security** — Your data stays on your servers

### 📊 Additional Features
- **Multi-Project Support** — Manage multiple projects from one instance
- **Dark Mode** — Easy on the eyes for late-night sprints
- **Mobile Responsive** — Works on tablets and phones
- **File Attachments** — Images, documents, videos with thumbnails
- **Activity History** — Full audit trail of all changes

---

## 🚀 Quick Start

### Option 1: Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/Rahimshershah/scrumbies.git
cd scrumbies

# Start with Docker Compose
docker compose up -d

# Run database migrations
docker compose exec app npx prisma migrate deploy

# Create initial admin user
docker compose exec app npx prisma db seed
```

Visit `http://localhost:3000` and login with the default admin credentials (see below).

### Option 2: Local Development

**Prerequisites:**
- Node.js 20+ 
- PostgreSQL 16+

```bash
# Clone the repository
git clone https://github.com/Rahimshershah/scrumbies.git
cd scrumbies

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database (required)
DATABASE_URL="postgresql://user:password@localhost:5432/scrumbies"

# Auth (required)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key-min-32-chars"

# Email (optional - for notifications)
BREVO_API_KEY="your-brevo-api-key"
EMAIL_FROM="noreply@yourdomain.com"
```

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed the admin user
npx prisma db seed

# Start development server
npm run dev
```

---

## 👤 Default Admin User

After seeding the database, login with:

| Field | Value |
|-------|-------|
| **Email** | `admin@example.com` |
| **Password** | `admin123` |

⚠️ **IMPORTANT: Change the admin password immediately after first login!**

### Creating Your Own Admin

You can also create an admin user manually:

```bash
# Using Prisma Studio
npx prisma studio
```

Or update the seed file at `prisma/seed.ts` before running `npx prisma db seed`:

```typescript
await prisma.user.upsert({
  where: { email: 'your-email@example.com' },
  update: {},
  create: {
    email: 'your-email@example.com',
    name: 'Your Name',
    password: await bcrypt.hash('your-secure-password', 10),
    role: 'ADMIN',
  },
})
```

---

## 🖥️ Self-Hosting

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes |
| `NEXTAUTH_URL` | Your app URL (e.g., https://scrumbies.yourcompany.com) | ✅ Yes |
| `NEXTAUTH_SECRET` | Random secret for session encryption | ✅ Yes |
| `BREVO_API_KEY` | Brevo API key for transactional emails | For emails |
| `EMAIL_FROM` | From email address | For emails |
| `EMAIL_FROM_NAME` | From name (default: Scrumbies) | For emails |

### Production Deployment

```bash
# Build the application
npm run build

# Start in production mode
npm start
```

Or with Docker:

```bash
docker build -t scrumbies .

docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_URL="https://your-domain.com" \
  -e NEXTAUTH_SECRET="your-secure-secret" \
  scrumbies
```

---

## 🤖 Built with Claude

<p align="center">
  <img src="https://img.shields.io/badge/Built%20with-Claude%20Code-blueviolet?style=for-the-badge" alt="Built with Claude Code" />
</p>

**Scrumbies was built entirely using [Claude Code](https://claude.ai)** — Anthropic's AI coding assistant. From the initial architecture to the final polish, every line of code was written in collaboration with Claude.

This project demonstrates what's possible when AI and human creativity work together:

- **Full-stack Next.js 14 application** with App Router
- **Complex drag-and-drop interfaces** using dnd-kit
- **Real-time collaboration features** with optimistic updates
- **Beautiful, accessible UI** with Tailwind CSS and Radix UI
- **Production-ready email system** with beautiful HTML templates
- **Comprehensive API** with proper authentication and authorization

We believe in AI-augmented development, and Scrumbies is proof that you can build production-quality software with AI assistance.

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5 |
| **Database** | PostgreSQL 16 + Prisma ORM |
| **Authentication** | NextAuth.js |
| **Styling** | Tailwind CSS |
| **UI Components** | Radix UI + shadcn/ui |
| **Drag & Drop** | dnd-kit |
| **Rich Text** | TipTap Editor |
| **Email** | Brevo (Sendinblue) API |

---

## 📸 Screenshots

<details>
<summary>Click to see screenshots</summary>

### Sprint Board & Backlog
![Sprint Board](docs/screenshots/1.png)

### Task Details
![Task Details](docs/screenshots/2.png)

### Documentation Spaces
![Spaces](docs/screenshots/3.png)

### Team Collaboration
![Collaboration](docs/screenshots/4.png)

### Admin & Settings
![Settings](docs/screenshots/5.png)

### User Management
![Users](docs/screenshots/6.png)

</details>

---

## 🤝 Contributing

We welcome contributions! Whether it's:

- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation improvements
- 🎨 UI/UX enhancements

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📋 Roadmap

- [ ] **Time Tracking** — Log time spent on tasks
- [ ] **Burndown Charts** — Visualize sprint progress
- [ ] **Slack Integration** — Get notifications in Slack
- [ ] **GitHub Integration** — Link PRs to tasks automatically
- [ ] **API Access** — Public API for integrations
- [ ] **Mobile App** — Native iOS and Android apps
- [ ] **Gantt Charts** — Timeline view for project planning
- [ ] **Custom Fields** — Add your own fields to tasks

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

**Free to use, free to modify, free to deploy. Your data, your servers, your rules.**

---

## ⭐ Star History

If you find Scrumbies useful, please consider giving it a star! It helps others discover the project.

---

<p align="center">
  <strong>Made with ❤️ and 🤖</strong><br/>
  <sub>Built with Claude Code • Open Source Forever</sub>
</p>
