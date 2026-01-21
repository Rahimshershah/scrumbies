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

### Server Info
- **Host:** `64.62.163.94`
- **SSH Port:** `8899`
- **User:** `sher`
- **App Path:** `/var/www/scrumbies`
- **URL:** https://scrumbies.hesab.com
- **Process Manager:** PM2 (process name: `scrumbies`)
- **GitHub:** https://github.com/Rahimshershah/scrumbies.git

### Database Info
- **Type:** PostgreSQL (local on server)
- **Database:** `scrumbies`
- **User:** `scrumbies`
- **Connection:** Configured in `/var/www/scrumbies/.env` on server

### How to Deploy Updates

```bash
# Step 1: Commit and push your changes
git add .
git commit -m "Your commit message"
git push

# Step 2: SSH to server and run deploy script
ssh -p 8899 sher@64.62.163.94 "cd /var/www/scrumbies && ./server-deploy.sh"
```

**What the deploy script does:**
1. `git pull` - pulls latest code from GitHub
2. `npm ci` - installs dependencies
3. `npx prisma generate` - generates Prisma client
4. `npx prisma migrate deploy` - runs any new migrations (safe, won't delete data)
5. `npm run build` - builds the Next.js app
6. `pm2 restart scrumbies` - restarts the app

### Quick Commands Reference

```bash
# Check if app is running
ssh -p 8899 sher@64.62.163.94 "pm2 status scrumbies"

# View app logs
ssh -p 8899 sher@64.62.163.94 "pm2 logs scrumbies --lines 50"

# Restart without rebuilding
ssh -p 8899 sher@64.62.163.94 "pm2 restart scrumbies"

# Check database connection
ssh -p 8899 sher@64.62.163.94 "cd /var/www/scrumbies && npx prisma db pull --print"
```

### Security Notes
- `deploy.sh` is in `.gitignore` - contains SSH password, NEVER commit
- `server-deploy.sh` is safe to commit - no credentials
- Server `.env` file contains database password - not in git
- Uploads persist in `/var/www/scrumbies/uploads/` (not managed by git)

### If Something Goes Wrong

**App won't start:**
```bash
ssh -p 8899 sher@64.62.163.94 "pm2 logs scrumbies --lines 100"
```

**Database migration fails:**
```bash
# Check migration status
ssh -p 8899 sher@64.62.163.94 "cd /var/www/scrumbies && npx prisma migrate status"

# If new migration conflicts, mark as applied (use carefully!)
ssh -p 8899 sher@64.62.163.94 "cd /var/www/scrumbies && npx prisma migrate resolve --applied MIGRATION_NAME"
```

**Need to restore .env on server:**
```
DATABASE_URL="postgresql://scrumbies:PASSWORD@localhost:5432/scrumbies?schema=public"
NEXTAUTH_URL="https://scrumbies.hesab.com"
NEXTAUTH_SECRET="generate-new-secret-with-openssl-rand-base64-32"

# Email (Brevo)
BREVO_API_KEY="your-brevo-api-key"
EMAIL_FROM="scrumbies@hesab.com"
```

---

## Architecture Notes

### Email Service
- **Provider:** Brevo (formerly Sendinblue)
- **Sender:** `scrumbies@hesab.com`
- **Config:** `BREVO_API_KEY` and `EMAIL_FROM` in `.env`
- **Implementation:** `src/lib/email.ts`
- **Test Endpoint:** `POST /api/test-email` (admin only)

**Email Types:**
- Task assignment notifications
- Comment notifications
- @mention notifications
- User invite emails
- Weekly digest emails
- Document comment notifications

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
