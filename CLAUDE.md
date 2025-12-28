# Scrumbies - Development Knowledge Base

## Project Overview
Scrumbies is a sprint backlog management tool built with Next.js 14, Prisma, and PostgreSQL.

## Common Issues & Solutions

### Project Photos/Logos Not Displaying (Fixed Dec 2024)

**Problem:** Project logos show correctly in admin settings but display as initials in the main app.

**Root Cause:** The main app header used `<AvatarImage>` component which runs through `normalizeAvatarUrl()` in `src/lib/utils.ts`. This function is designed for user avatars (paths like `/uploads/avatars/`), not for project logos which are stored as base64 data URLs.

**Solution:**
1. Use direct `<img>` tags for project logos instead of the Avatar component
2. Add explicit `select` clauses in Prisma queries to ensure `logoUrl` is always included
3. Added project editing UI in Admin Settings > Project tab

**Files Changed:**
- `src/components/header.tsx` - Use direct `<img>` for project logos
- `src/app/page.tsx` - Explicit select for logoUrl
- `src/app/admin/layout.tsx` - Explicit select for logoUrl
- `src/app/api/projects/route.ts` - Explicit select for logoUrl
- `src/app/admin/settings/page.tsx` - Added Project editing tab

**Prevention:** When displaying images that are NOT user avatars, always use direct `<img>` tags rather than the AvatarImage component.

### Editing Projects (Added Dec 2024)

**Location:** Admin Settings > Project tab (first tab)

**Features:**
- View all projects with their current logos
- Edit project name
- Upload/change project logo
- See which projects have no logo set (amber warning)

---

## Deployment

### Current Setup (Git-based)
- Push to GitHub, pull on server, build and restart
- Server: `sher@64.62.163.94:8899`
- Path: `/var/www/scrumbies`
- Process manager: PM2
- GitHub: https://github.com/Rahimshershah/scrumbies.git

### Deploy Commands
```bash
# 1. Commit and push your changes
git add . && git commit -m "Your message" && git push

# 2. SSH to server and run deploy
ssh -p 8899 sher@64.62.163.94
cd /var/www/scrumbies && ./server-deploy.sh

# Or one-liner from local machine:
ssh -p 8899 sher@64.62.163.94 "cd /var/www/scrumbies && ./server-deploy.sh"
```

### First-Time Server Setup
```bash
# On the server:
cd /var/www
git clone https://github.com/Rahimshershah/scrumbies.git
cd scrumbies
cp /path/to/.env .env  # Copy your env file
chmod +x server-deploy.sh
./server-deploy.sh
```

### Important Notes
- `deploy.sh` (local rsync version) is in `.gitignore` - contains credentials, never commit!
- `server-deploy.sh` is safe to commit - no credentials
- Database is NOT touched by git - only migrations run via `prisma migrate deploy`
- Uploads directory (`/var/www/scrumbies/uploads/`) persists independently of git

---

## Architecture Notes

### Image Storage
- **User Avatars:** Stored as files in `/uploads/avatars/`, served via `/api/uploads/avatars/[filename]`
- **Project Logos:** Stored as base64 data URLs in the database (`logoUrl` field)
- **Task Attachments:** Stored as files in `/uploads/attachments/`

### Key Components
- `src/components/app-shell.tsx` - Main application wrapper
- `src/components/header.tsx` - Top navigation with project selector
- `src/components/admin/admin-layout.tsx` - Admin section wrapper

### Database
- Uses Prisma ORM
- Schema at `prisma/schema.prisma`
- Migrations at `prisma/migrations/`

---

## Troubleshooting

### Images Not Loading
1. Check if using correct component (img vs AvatarImage)
2. Verify the URL format (data: URL vs file path vs API route)
3. Check browser network tab for 404s

### Build Failures
1. Run `npm run db:generate` to update Prisma client
2. Check for TypeScript errors: `npx tsc --noEmit`
3. Clear `.next` folder and rebuild

### Deployment Issues
1. Verify SSH connection: `ssh -p 8899 sher@64.62.163.94`
2. Check PM2 status: `pm2 status scrumbies`
3. View logs: `pm2 logs scrumbies`
