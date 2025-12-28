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
echo "=== Preparing standalone build ==="
# Copy static files to standalone
cp -r .next/static .next/standalone/.next/static
# Copy public folder to standalone
cp -r public .next/standalone/public
# Copy .env to standalone
cp .env .next/standalone/.env
# Ensure uploads directory exists in standalone
mkdir -p .next/standalone/uploads
cp -r uploads/* .next/standalone/uploads/ 2>/dev/null || true

echo ""
echo "=== Restarting PM2 ==="
pm2 restart scrumbies --update-env

echo ""
echo "=== Deployment complete! ==="
pm2 status scrumbies
