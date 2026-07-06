# A Better Me — droplet deployment

Frontend stays on GitHub Pages. The droplet runs the FastAPI state store + the
Telegram bot (shared SQLite `data.db`), exposed over HTTPS via a **Cloudflare
Tunnel** (no open ports, doesn't touch the existing Nginx/ChumbsAgent setup).

```
GitHub Pages (app.js)  --HTTPS-->  Cloudflare Tunnel  -->  127.0.0.1:8787 (server.py)
Telegram  <-->  bot.py  ------------ shared data.db ---------------^
```

## A. API + bot  (automatable over SSH)
On the droplet, with the repo synced to `/root/ABetterMe` and the bot token in
`/root/.env` (`ABETTERME_BOT_TOKEN=...`):

```bash
cd /root/ABetterMe
bash deploy/deploy.sh
```

This creates a venv, installs deps, and starts `abetterme-api` + `abetterme-bot`
as systemd services. The API listens on **127.0.0.1:8787** only.

## B. Cloudflare Tunnel  (one-time, needs your Cloudflare login)
A *stable* public hostname needs a domain on Cloudflare (free plan is fine).

```bash
# install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
     -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared

cloudflared tunnel login                 # opens a URL — authorize your domain in the browser
cloudflared tunnel create abetterme      # note the Tunnel ID it prints
```

Create `/root/.cloudflared/config.yml`:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: abetterme.<YOUR_DOMAIN>
    service: http://127.0.0.1:8787
  - service: http_status:404
```

Route DNS + run as a service:
```bash
cloudflared tunnel route dns abetterme abetterme.<YOUR_DOMAIN>
cp deploy/abetterme-tunnel.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now abetterme-tunnel
```

**No domain?** Quick tunnel (ephemeral URL, changes on restart — fine for testing):
`cloudflared tunnel --url http://127.0.0.1:8787` → copy the printed
`https://xxxx.trycloudflare.com`.

## C. Point the frontend at the backend
Open the app once with the tunnel URL; it's remembered in localStorage:
```
https://chuachua69.github.io/a-better-me/?api=https://abetterme.<YOUR_DOMAIN>
```
Also add that origin to the API's allow-list (optional; the browser needs it for
GET/POST): set `ABETTERME_ORIGINS` in the api service, or it already includes the
Pages origin. Restart: `systemctl restart abetterme-api`.

## Verify
```bash
curl -s http://127.0.0.1:8787/api/state          # {} or your state
systemctl status abetterme-api abetterme-bot
```
Telegram: message the bot `/start`.
