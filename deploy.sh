#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# The directory where your project is located on the VPS.
PROJECT_DIR="/var/www/sabnode"
# The name for your PM2 process.
PM2_APP_NAME="sabnode"
# SabCRM engine (vendored Twenty stack) lives here.
SABCRM_DIR="$PROJECT_DIR/services/sabcrm"
# Set SABCRM_DEPLOY=0 to skip the SabCRM engine build/restart.
SABCRM_DEPLOY="${SABCRM_DEPLOY:-1}"

# --- Deployment Steps ---
echo "🚀 Starting deployment..."

# Navigate to the project directory
cd "$PROJECT_DIR"

# Pull the latest changes from your GitHub repository's 'main' branch.
echo "🔄 Pulling latest changes from Git..."
git fetch origin main
git reset --hard origin/main

# Install/update dependencies based on the lock file.
echo "📦 Installing dependencies..."
npm install

# Build the Next.js application for production.
echo "🛠️ Building the application..."
npm run build

# Restart the application using PM2 to apply changes.
# The '--update-env' flag ensures any new environment variables are loaded.
echo "🔄 Restarting the application with PM2..."
pm2 restart "$PM2_APP_NAME" --update-env || pm2 start npm --name "$PM2_APP_NAME" -- start

# --- SabCRM engine (vendored Twenty: NestJS API + BullMQ worker) ---
# Runs as separate PM2 apps (sabcrm-server :4300, sabcrm-worker). Failures
# here must NOT abort the main app deploy, so the block is non-fatal.
if [ "$SABCRM_DEPLOY" = "1" ] && [ -d "$SABCRM_DIR" ]; then
  echo "🧩 Deploying SabCRM engine..."
  set +e
  (
    set -e
    cd "$SABCRM_DIR"

    # Twenty pins Node ^24.5 + yarn 4 (via corepack).
    corepack enable

    echo "📦 [sabcrm] Installing engine dependencies..."
    yarn install --immutable

    echo "🛠️ [sabcrm] Building server + front..."
    npx nx build twenty-shared
    npx nx build twenty-server
    npx nx build twenty-front

    echo "🗄️ [sabcrm] Running database migrations..."
    cd packages/twenty-server
    yarn database:migrate:prod
    cd "$SABCRM_DIR"

    echo "🔄 [sabcrm] (Re)starting PM2 engine processes..."
    pm2 startOrReload ecosystem.config.js --update-env
  )
  if [ $? -eq 0 ]; then
    echo "✅ SabCRM engine deployed."
  else
    echo "⚠️  SabCRM engine deploy failed (main app is still live). Check the log above."
  fi
  set -e
else
  echo "⏭️  Skipping SabCRM engine (SABCRM_DEPLOY=$SABCRM_DEPLOY, dir present: $([ -d "$SABCRM_DIR" ] && echo yes || echo no))."
fi

echo "✅ Deployment finished successfully!"
