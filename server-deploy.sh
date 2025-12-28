#!/bin/bash

# Server-side deployment script for Scrumbies
# This script runs ON THE SERVER after git pull
# No credentials in this file - safe to commit to git

set -e

APP_DIR="/var/www/scrumbies"
cd "$APP_DIR"

echo "=== Pulling latest changes from git ==="
git pull origin main

echo ""
echo "=== Installing dependencies ==="
npm ci --production=false

echo ""
echo "=== Generating Prisma client ==="
npx prisma generate

echo ""
echo "=== Running database migrations ==="
npx prisma migrate deploy

echo ""
echo "=== Building application ==="
npm run build

echo ""
echo "=== Restarting PM2 ==="
pm2 restart scrumbies --update-env

echo ""
echo "=== Deployment complete! ==="
pm2 status scrumbies
