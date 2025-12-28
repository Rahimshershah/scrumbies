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
echo "=== Setting up standalone build ==="
# Copy static files
cp -r .next/static .next/standalone/.next/

# Copy public folder
cp -r public .next/standalone/

# Copy .env file
cp .env .next/standalone/

# Copy missing auth dependencies (not included in standalone trace)
cp -r node_modules/next-auth .next/standalone/node_modules/
cp -r node_modules/@auth .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/jose .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/cookie .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/uuid .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/openid-client .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/preact .next/standalone/node_modules/ 2>/dev/null || true
cp -r node_modules/preact-render-to-string .next/standalone/node_modules/ 2>/dev/null || true

# Create uploads symlink (so uploads persist across deploys)
rm -rf .next/standalone/uploads
ln -sf /var/www/scrumbies/uploads .next/standalone/uploads

echo ""
echo "=== Restarting PM2 ==="
pm2 delete scrumbies 2>/dev/null || true
cd .next/standalone
pm2 start server.js --name scrumbies
pm2 save

echo ""
echo "=== Deployment complete! ==="
pm2 status scrumbies
