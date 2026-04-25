# How to Automate Code Using GitHub

A complete handbook for the BizAutomate SaaS — covering the full one-time setup,
how to deploy new changes from now on, how to debug, how to roll back, and how
to keep the system healthy.

> Project: **BizAutomate** (Local Business Automation SaaS)
> Repo: **github.com/nigamchandan/SASS-Application**
> Server: **AWS EC2 t3.micro · Ubuntu 22.04 · `98.92.99.170`**
> Stack: **React + Vite (frontend) · Node.js + Express + Prisma (backend) · PostgreSQL**
> Pipeline: **GitHub Actions → GHCR → EC2 (Docker Compose)**

---

## Table of Contents

1. [How the automation works](#1-how-the-automation-works)
2. [One-time setup (already done)](#2-one-time-setup-already-done)
3. [Daily workflow — deploy a code change](#3-daily-workflow--deploy-a-code-change)
4. [How to view logs and debug](#4-how-to-view-logs-and-debug)
5. [How to roll back to an older version](#5-how-to-roll-back-to-an-older-version)
6. [How to back up and restore the database](#6-how-to-back-up-and-restore-the-database)
7. [How to update secrets (passwords, JWT, etc.)](#7-how-to-update-secrets-passwords-jwt-etc)
8. [Common failures and fixes](#8-common-failures-and-fixes)
9. [What's next — recommended hardening](#9-whats-next--recommended-hardening)
10. [Glossary](#10-glossary)

---

## 1. How the automation works

```
   YOUR LAPTOP                    GITHUB                          GITHUB ACTIONS                    EC2 (Ubuntu)
                                                                  (CI/CD pipeline)
   ┌──────────┐    git push    ┌─────────────┐                  ┌─────────────────┐               ┌──────────────────────┐
   │   code   │  ───────────▶  │  main branch│  ─── trigger ──▶ │ 1. checkout code│               │                      │
   │  edits   │                │             │                  │ 2. build images │ ── push ────▶ │   ghcr.io            │
   └──────────┘                └─────────────┘                  │ 3. push to GHCR │               │   (image registry)   │
                                                                │ 4. ssh to EC2   │               │                      │
                                                                │ 5. compose pull │ ◀── pull ──── │                      │
                                                                │ 6. compose up   │               │                      │
                                                                │ 7. health check │ ── ssh ────▶ │  ┌────────────────┐  │
                                                                └─────────────────┘               │  │ docker compose │  │
                                                                                                  │  │  ├─ postgres   │  │
                                                                                                  │  │  ├─ server     │  │
                                                                                                  │  │  └─ client     │  │
                                                                                                  │  └────────────────┘  │
                                                                                                  └──────────────────────┘
                                                                                                              ▲
                                                                                                  http://EC2_IP
                                                                                                  (browser)
```

**The 6-second mental model:**

1. You write code on your laptop.
2. You `git push origin main`.
3. GitHub Actions builds Docker images for the frontend and backend.
4. The images are pushed to GitHub Container Registry (GHCR).
5. GitHub Actions SSHes into your EC2 server and tells it to pull the new images.
6. EC2 runs the new containers. Database migrations run automatically.
7. Site is live with your new code.

**You never SSH into EC2 to deploy.** Just `git push`. That's it.

---

## 2. One-time setup (already done)

This is a record of what was set up — don't repeat unless you're rebuilding the system from scratch.

### 2.1 Files in the repo

| File | Purpose |
|---|---|
| `server/Dockerfile` | Multi-stage build of the Node.js + Prisma backend image |
| `server/docker-entrypoint.sh` | Waits for DB, runs `prisma migrate deploy`, starts the server |
| `server/.dockerignore` | Excludes `node_modules`, `.env`, etc. from the build context |
| `client/Dockerfile` | Multi-stage build: `vite build` + Nginx that serves the bundle |
| `client/nginx.conf` | Nginx config: serves the SPA, proxies `/api/*` and `/uploads/*` to the backend |
| `client/.dockerignore` | Excludes junk from the client build |
| `docker-compose.yml` | Local dev compose (builds locally) |
| `docker-compose.prod.yml` | Production compose (pulls pre-built images from GHCR) |
| `.github/workflows/deploy.yml` | The CI/CD pipeline definition |
| `deploy/setup-ec2.sh` | One-shot bootstrap script for a new EC2 instance |
| `deploy/.env.production.example` | Template for the production `.env` file |

### 2.2 GitHub Actions secrets (in repo Settings → Secrets and variables → Actions)

| Secret | Value (example) | Where it's used |
|---|---|---|
| `EC2_HOST` | `98.92.99.170` | SSH target host |
| `EC2_USER` | `ubuntu` | SSH login user |
| `EC2_SSH_KEY` | Full contents of `your-key.pem` | SSH private key (must include BEGIN/END lines) |
| `GHCR_USERNAME` | `nigamchandan` | GHCR login on EC2 |
| `GHCR_TOKEN` | `ghp_...` (GitHub PAT with `read:packages`) | GHCR login on EC2 |

### 2.3 EC2 server bootstrap

The EC2 was provisioned with these one-time steps:

```bash
# Installed: docker-ce, docker-compose-plugin, ufw, fail2ban
# Created:   1 GB swap file at /swapfile
# Opened:    ports 22, 80, 443
# Created:   /srv/bizautomate/  (owned by ubuntu)
# Logged in: docker login ghcr.io -u nigamchandan
```

### 2.4 Production `.env` on EC2

Lives at `/srv/bizautomate/.env` (owner: `ubuntu`, perms: `600`):

```bash
IMAGE_REGISTRY=ghcr.io/nigamchandan
IMAGE_TAG=latest
POSTGRES_USER=bizadmin
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=bizautomate
JWT_SECRET=<strong-96-char-hex-secret>
CLIENT_URL=http://98.92.99.170
```

**Never commit this file to git.** It contains production secrets.

### 2.5 What got created on the EC2

- **3 containers** (when running):
  - `bizautomate-client-1` — Nginx, listens on `:80` published to host
  - `bizautomate-server-1` — Node.js, listens on `:5000` (internal only)
  - `bizautomate-postgres-1` — Postgres 14, listens on `:5432` (internal only)
- **2 named volumes** (data persists across deploys):
  - `bizautomate_pgdata` — PostgreSQL data files
  - `bizautomate_uploads` — Multer logo uploads
- **1 docker network** (`bizautomate_bizautomate`) so the three containers talk to each other.

---

## 3. Daily workflow — deploy a code change

This is what you do **every time you want to ship a code change**.

### 3.1 On your laptop

```powershell
cd "e:\GIT Project\SASS aplication"

# 1. Pull latest (in case of any out-of-band edits)
git pull origin main

# 2. Make your code changes (edit files normally)
#    e.g. fix a bug, add a feature, update a UI

# 3. Stage, commit, push
git add .
git commit -m "feat: brief description of what you changed"
git push origin main
```

That's the entire deploy. **No SSH, no manual Docker commands.**

### 3.2 What happens automatically (~2 minutes after the push)

1. GitHub receives your push.
2. The "Build & Deploy" workflow triggers.
3. GitHub Actions builds the new images (using the build cache, ~60–90 seconds).
4. The images are pushed to GHCR with a tag = your commit's short SHA (e.g. `abc1234`).
5. GitHub Actions SSHes into EC2, updates `.env` with the new tag, runs `docker compose pull` and `docker compose up -d`.
6. Old containers are gracefully replaced with new ones.
7. `prisma migrate deploy` runs automatically inside the new server container — any new migrations apply.
8. Health check (`curl http://127.0.0.1/api/health`) confirms the deploy succeeded.

### 3.3 Watching it happen

Open: **https://github.com/nigamchandan/SASS-Application/actions**

You'll see your push as a workflow run with a yellow spinner → green checkmark.

If a step fails (red X), click into it to see logs. Then jump to [Section 8](#8-common-failures-and-fixes).

### 3.4 Re-deploying without code changes

Sometimes you just want to "kick" the deploy (e.g. to apply a manually-changed `.env`):

```powershell
git commit --allow-empty -m "deploy: trigger redeploy"
git push origin main
```

---

## 4. How to view logs and debug

SSH into EC2 from your laptop:

```powershell
ssh -i "C:\path\to\your-key.pem" ubuntu@98.92.99.170
```

Then `cd /srv/bizautomate` and use these commands:

### 4.1 Container status

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see all 3 containers as `Up (healthy)`. If one is `Restarting` or `Exited`, that's where the problem is.

### 4.2 Live logs

```bash
# Backend (Node API)
docker compose -f docker-compose.prod.yml logs -f --tail=200 server

# Frontend (Nginx)
docker compose -f docker-compose.prod.yml logs -f --tail=200 client

# Database
docker compose -f docker-compose.prod.yml logs -f --tail=200 postgres

# Everything at once
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

Press `Ctrl+C` to stop tailing.

### 4.3 Resource usage (RAM tightness check on t3.micro)

```bash
# Per-container CPU & memory (live, ~1 sec refresh)
docker stats

# Host RAM/swap snapshot
free -h
```

If `free -h` shows `available` consistently below ~80 MB, or swap is constantly at >300 MB used → time to upgrade to t3.small ($15/mo) or trim Postgres `shared_buffers`.

### 4.4 Inspect the running database

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U bizadmin -d bizautomate

# Now inside psql, you can run:
\dt                          -- list tables
SELECT COUNT(*) FROM "User"; -- count users
\q                           -- exit
```

### 4.5 Run a one-off Prisma command

```bash
# Migration status
docker compose -f docker-compose.prod.yml exec server npx prisma migrate status

# Open Prisma Studio (NOT recommended in prod — exposes data)
# Better: copy DB to local laptop and use studio there.
```

### 4.6 Restart a single container

```bash
docker compose -f docker-compose.prod.yml restart server
```

(Use this if you changed `.env` and need the server to re-read it. For env changes, use `up -d --force-recreate` instead — see [Section 7](#7-how-to-update-secrets-passwords-jwt-etc).)

---

## 5. How to roll back to an older version

Every deploy tags images with the 7-character git SHA, so rolling back is just changing one variable.

### 5.1 Find a known-good image tag

```bash
# On EC2:
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedSince}}" | grep bizautomate
```

You'll see something like:

```
ghcr.io/nigamchandan/bizautomate-server   abc1234   2 hours ago
ghcr.io/nigamchandan/bizautomate-server   def5678   1 day ago
ghcr.io/nigamchandan/bizautomate-server   latest    2 hours ago
```

Pick a tag from before the broken deploy (e.g. `def5678`).

### 5.2 Pin the tag in `.env` and redeploy

```bash
cd /srv/bizautomate
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=def5678|' .env
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

The next push to `main` will overwrite `IMAGE_TAG` again with the new SHA, so this is a temporary roll-back. Fix the broken commit on a branch and push a fix to `main` to restore normal flow.

### 5.3 Roll back a database migration

If a migration broke things, you need a database restore from backup (see [Section 6](#6-how-to-back-up-and-restore-the-database)). Prisma doesn't auto-rollback migrations.

---

## 6. How to back up and restore the database

### 6.1 Manual one-off backup

```bash
# On EC2:
mkdir -p /srv/bizautomate/backups
docker compose -f /srv/bizautomate/docker-compose.prod.yml exec -T postgres \
  pg_dump -U bizadmin bizautomate \
  | gzip > "/srv/bizautomate/backups/biz-$(date +%F-%H%M).sql.gz"

ls -lh /srv/bizautomate/backups/
```

### 6.2 Daily automated backup (highly recommended)

```bash
# On EC2:
mkdir -p /srv/bizautomate/backups

# Create a backup script
sudo tee /usr/local/bin/biz-backup.sh > /dev/null <<'EOF'
#!/bin/bash
set -e
cd /srv/bizautomate
. ./.env
TS=$(date +%F-%H%M)
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "/srv/bizautomate/backups/biz-${TS}.sql.gz"
# Keep only the last 14 daily backups
find /srv/bizautomate/backups -name 'biz-*.sql.gz' -mtime +14 -delete
EOF
sudo chmod +x /usr/local/bin/biz-backup.sh

# Schedule daily at 02:30
( crontab -l 2>/dev/null; echo "30 2 * * * /usr/local/bin/biz-backup.sh >> /var/log/biz-backup.log 2>&1" ) | crontab -
```

Verify it's scheduled:

```bash
crontab -l
```

### 6.3 Restore from a backup

```bash
# Pick the backup file
ls /srv/bizautomate/backups/

# Restore (this WIPES the existing data!)
gunzip -c /srv/bizautomate/backups/biz-2026-04-25-0230.sql.gz \
  | docker compose -f /srv/bizautomate/docker-compose.prod.yml exec -T postgres \
      psql -U bizadmin -d bizautomate
```

For extra safety, copy backups off the EC2 box periodically:

```bash
# From your laptop, pull a backup down:
scp -i your-key.pem ubuntu@98.92.99.170:/srv/bizautomate/backups/biz-2026-04-25-0230.sql.gz .
```

---

## 7. How to update secrets (passwords, JWT, etc.)

Since secrets live in `/srv/bizautomate/.env` (not in the image), updating them is fast.

### 7.1 Rotate the JWT secret

```bash
# On EC2:
NEW_JWT=$(openssl rand -hex 48)
sudo sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT}|" /srv/bizautomate/.env
sudo chown ubuntu:ubuntu /srv/bizautomate/.env
sudo chmod 600 /srv/bizautomate/.env
cd /srv/bizautomate
docker compose -f docker-compose.prod.yml up -d --force-recreate server
```

> **Side effect:** rotating the JWT secret invalidates all existing user sessions. Everyone has to log in again. Do this off-peak.

### 7.2 Change the Postgres password

This is more involved because the password is also stored inside Postgres' data files. Three steps:

```bash
# 1. Pick a new password
NEW_PASS=$(openssl rand -base64 24 | tr -d '/+=')
echo "$NEW_PASS"   # save this somewhere safe

# 2. Change it inside Postgres FIRST
docker compose -f /srv/bizautomate/docker-compose.prod.yml exec postgres \
  psql -U bizadmin -d bizautomate -c "ALTER USER bizadmin WITH PASSWORD '${NEW_PASS}';"

# 3. Update .env to match, then recreate server (which uses the password to connect)
sudo sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${NEW_PASS}|" /srv/bizautomate/.env
cd /srv/bizautomate
docker compose -f docker-compose.prod.yml up -d --force-recreate server
```

### 7.3 Rotate the GitHub PAT

GitHub PATs expire (default 90 days). When the old one is about to expire:

1. **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)** → generate a new one with `read:packages` scope.
2. **In your repo Settings → Secrets and variables → Actions**, update the `GHCR_TOKEN` secret with the new value.
3. **On EC2:**
   ```bash
   echo "ghp_NEW_TOKEN" | docker login ghcr.io -u nigamchandan --password-stdin
   ```
4. (Optional) revoke the old token from the same GitHub page.

---

## 8. Common failures and fixes

### 8.1 GitHub Actions: build job fails with "permission denied" pushing to GHCR

**Fix:** open `.github/workflows/deploy.yml`, confirm the workflow has:

```yaml
permissions:
  contents: read
  packages: write
```

Also confirm the repo is configured to allow GHCR pushes: **repo Settings → Actions → General → Workflow permissions → "Read and write permissions"**.

### 8.2 GitHub Actions: deploy job fails with `permission denied (publickey)`

**Cause:** the `EC2_SSH_KEY` secret is missing line breaks or BEGIN/END lines.

**Fix:** open the `.pem` file in **Notepad** (not Word/WordPad). Select all (`Ctrl+A`), copy (`Ctrl+C`), and re-paste into the `EC2_SSH_KEY` secret. Make sure the first line is `-----BEGIN RSA PRIVATE KEY-----` (or `-----BEGIN OPENSSH PRIVATE KEY-----`) and the last line is the matching `-----END ...-----`.

### 8.3 GitHub Actions: deploy job fails with `denied: requested access denied` on `docker pull`

**Cause:** EC2's `docker login` to GHCR has expired or the PAT was revoked.

**Fix:** SSH to EC2, run:
```bash
echo "ghp_YOUR_TOKEN" | docker login ghcr.io -u nigamchandan --password-stdin
```

### 8.4 Frontend shows "JWT_SECRET is missing or too short"

**Cause:** `JWT_SECRET` in `/srv/bizautomate/.env` is too short or unset.

**Fix:** see [Section 7.1](#71-rotate-the-jwt-secret).

### 8.5 Browser shows "This site can't be reached"

**Cause:** EC2 security group doesn't allow port 80, OR the `client` container isn't running.

**Fix:**
1. Check security group: AWS Console → EC2 → your instance → Security tab → make sure inbound rule for HTTP 80 from `0.0.0.0/0` exists.
2. Check container: `docker compose ps` should show `client` as `0.0.0.0:80->80/tcp`.

### 8.6 Containers OOM-killed (RAM exhausted)

**Symptoms:** containers randomly restart, `dmesg | grep -i kill` shows OOM events.

**Fix (cheapest):**
- Make sure swap is on: `free -h` should show `Swap` > 0.
- Lower Postgres memory: edit `docker-compose.prod.yml`, set the postgres service memory limit to `200M`.

**Fix (proper):**
- Upgrade to t3.small ($15/mo) — doubles RAM to 2 GB. Worth it once you have real users.

### 8.7 New deploy works but old browser sessions show errors

**Cause:** breaking API change, or you rotated `JWT_SECRET`.

**Fix:** users hard-refresh (`Ctrl+Shift+R`). Or in your code, version your API and bump `app-version` in localStorage to force re-login.

---

## 9. What's next — recommended hardening

### 9.1 Daily DB backups (covered in Section 6.2) — DO THIS

This is the single most important thing. Server can fail; backups can't.

### 9.2 CloudWatch alarms (free tier compatible)

Set up basic alarms in AWS Console for:
- CPU > 80% for 5 minutes → email alert
- Disk free < 20% → email alert
- Status check failures → email alert

### 9.3 Get a domain name (~₹600/year on Cloudflare or Namecheap)

Replaces `http://98.92.99.170` with `https://bizautomate.in` — drastically more professional.

### 9.4 Add HTTPS (Let's Encrypt, free)

After you have a domain pointing to your EC2:

```bash
# Install certbot
sudo apt-get install -y certbot
# Stop client briefly to free port 80
docker compose -f docker-compose.prod.yml stop client
# Get a cert
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com --agree-tos -m you@example.com
# Mount /etc/letsencrypt into the client container, update nginx.conf to listen on 443.
# (Detailed steps: ask in chat when ready.)
```

### 9.5 Set up a staging environment

Create a `dev` branch in GitHub. Have the workflow on `dev` deploy to a second EC2 instance. Test there before merging to `main`. Cost: ~$6/mo for a second t3.micro after free tier.

### 9.6 Switch to GitHub Container Registry packages visibility

In GitHub → your profile → **Packages** → click `bizautomate-server` → **Package settings** → leave it private (default). Don't make images public unless you intend to.

### 9.7 Pin image digests, not tags (advanced)

Replace `:latest` and `:abc1234` references with `@sha256:...` digests. Bulletproofs supply-chain attacks. Worth it after you have a few production weeks under your belt.

---

## 10. Glossary

| Term | What it means |
|---|---|
| **CI/CD** | Continuous Integration / Continuous Deployment — automated pipeline that builds and deploys your code on every push |
| **Docker image** | A frozen blueprint for a container — your code + its OS + its deps, all in one file |
| **Container** | A running instance of an image |
| **Volume** | A persistent disk attached to a container — survives container restarts/recreations |
| **GHCR** | GitHub Container Registry — where built images are stored (`ghcr.io/...`) |
| **PAT** | Personal Access Token — a long string used in place of your password for git/GHCR auth |
| **SSH key (`.pem`)** | A private key file used to log into EC2 — the public half is on the server, you keep the private half |
| **Security group** | AWS firewall — a per-instance rule list of which ports are open to which IPs |
| **Elastic IP** | A static public IP for an EC2 instance — survives reboots |
| **Compose file** | YAML that describes a multi-container app (which services, networks, volumes) |
| **Migration** | A versioned, ordered change to the database schema (Prisma manages these in `prisma/migrations/`) |
| **Health check** | A periodic `curl` or similar that the container/CI uses to verify a service is alive |

---

## Quick command cheat sheet

```bash
# DEPLOY a change                     [LAPTOP]
git add . && git commit -m "..." && git push origin main

# WATCH the deploy                    [BROWSER]
https://github.com/nigamchandan/SASS-Application/actions

# OPEN the live site                  [BROWSER]
http://98.92.99.170

# SSH into the server                 [LAPTOP]
ssh -i your-key.pem ubuntu@98.92.99.170

# CHECK containers                    [EC2]
cd /srv/bizautomate && docker compose -f docker-compose.prod.yml ps

# TAIL logs                           [EC2]
docker compose -f docker-compose.prod.yml logs -f --tail=200 server

# RESTART a container                 [EC2]
docker compose -f docker-compose.prod.yml restart server

# UPDATE .env then reload             [EC2]
sudo nano /srv/bizautomate/.env
docker compose -f docker-compose.prod.yml up -d --force-recreate server

# BACKUP the database (manual)        [EC2]
docker compose -f /srv/bizautomate/docker-compose.prod.yml exec -T postgres \
  pg_dump -U bizadmin bizautomate | gzip > "biz-$(date +%F).sql.gz"

# ROLLBACK to a previous image        [EC2]
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=abc1234|' /srv/bizautomate/.env
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

**That's the whole system.** From now on, deploying a change is just `git push`. Everything else is automated.
