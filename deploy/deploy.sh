#!/usr/bin/env bash
# Deploy the A Better Me API + Telegram bot on the droplet.
# Run ON the droplet from /root/ABetterMe after the files are synced there.
# The Cloudflare Tunnel is set up separately (see DEPLOY.md) because it needs an
# interactive `cloudflared tunnel login` against your Cloudflare account.
set -euo pipefail

APP_DIR=/root/ABetterMe
cd "$APP_DIR"

echo "== 1. Python venv + deps =="
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt

echo "== 2. Check bot token (/root/.env) =="
if ! grep -q '^ABETTERME_BOT_TOKEN=' /root/.env 2>/dev/null; then
  echo "!! ABETTERME_BOT_TOKEN missing in /root/.env — bot will not start until it's set."
fi

echo "== 3. Install systemd services =="
cp deploy/abetterme-api.service /etc/systemd/system/abetterme-api.service
cp deploy/abetterme-bot.service /etc/systemd/system/abetterme-bot.service
systemctl daemon-reload
systemctl enable --now abetterme-api.service
systemctl enable --now abetterme-bot.service

echo "== 4. Status =="
systemctl --no-pager --lines=5 status abetterme-api.service || true
systemctl --no-pager --lines=5 status abetterme-bot.service || true

echo
echo "API is now on http://127.0.0.1:8787 (localhost only)."
echo "Next: set up the Cloudflare Tunnel (DEPLOY.md step B) to expose it over HTTPS."
