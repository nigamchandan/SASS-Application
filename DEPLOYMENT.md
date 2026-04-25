# BizAutomate — Production Deployment Guide

This guide takes you from a fresh GitHub repo to a live BizAutomate instance on
an AWS EC2 t3.micro free-tier box, with GitHub Actions deploying every push to
`main`.

## Architecture

```
                 EC2 t3.micro (Ubuntu 22.04)
   ┌──────────────────────────────────────────────────────┐
   │  Docker Engine                                       │
   │                                                      │
   │   client (nginx :80)                                 │
   │     ├── /            -> static React build           │
   │     ├── /api/*       -> proxy_pass server:5000       │
   │     └── /uploads/*   -> proxy_pass server:5000       │
   │                                                      │
   │   server (node :5000)  -> postgres:5432              │
   │   postgres (internal only, named volume)             │
   │                                                      │
   │   volumes:  pgdata,  uploads  (persist across deploys)│
   └──────────────────────────────────────────────────────┘
                 ▲
        GitHub Actions on push to main
```

Only port `80` is exposed to the internet. Postgres has no host port mapping.

---

## 0. Prerequisites

- AWS account
- GitHub repo containing this code
- Local machine with SSH (any OS)

---

## 1. Launch EC2 instance (one-time)

1. AWS Console → EC2 → **Launch instance**.
2. **Name:** `bizautomate-prod`
3. **AMI:** Ubuntu Server 22.04 LTS (free tier eligible)
4. **Instance type:** `t3.micro` (free tier eligible)
5. **Key pair:** create or pick an existing one. Save the `.pem` file safely.
6. **Network → Security group:** create new with these inbound rules:
   - SSH (22) — source: **My IP**
   - HTTP (80) — source: **0.0.0.0/0**
   - HTTPS (443) — source: **0.0.0.0/0** (reserved for later)
7. **Storage:** 30 GB gp3 (free tier).
8. Launch.
9. **Allocate an Elastic IP** (EC2 → Elastic IPs → Allocate → Associate to the
   instance). This keeps the IP stable across reboots.
10. Note the public IP — we'll call it `EC2_IP`.

---

## 2. Bootstrap the EC2 instance (one-time)

From your laptop, copy the setup script over and run it:

```bash
scp -i your-key.pem deploy/setup-ec2.sh ubuntu@<EC2_IP>:/tmp/
ssh -i your-key.pem ubuntu@<EC2_IP> 'sudo bash /tmp/setup-ec2.sh'
```

This installs Docker, Compose, ufw, fail2ban, a 1 GB swap file, and creates
`/srv/bizautomate/`.

Log out, log back in (so the `ubuntu` user picks up the `docker` group):

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
docker version  # should print client + server versions without sudo
```

---

## 3. Create the production `.env` on EC2 (one-time)

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
cd /srv/bizautomate

# Paste in the real values
nano .env
```

Use `deploy/.env.production.example` from this repo as a template. Generate
strong secrets:

```bash
# JWT_SECRET
openssl rand -hex 48
# POSTGRES_PASSWORD
openssl rand -base64 24
```

Set `IMAGE_REGISTRY` to `ghcr.io/<your-github-username-lowercase>` and
`CLIENT_URL=http://<EC2_IP>`.

---

## 4. GHCR access (one-time)

GitHub Container Registry hosts the built images. Both CI and the EC2 host need
to authenticate to it.

### 4a. Create a Personal Access Token (classic)

1. GitHub → Settings → Developer settings → **Personal access tokens (classic)**
2. Generate new token with scope: `read:packages`
3. Save it somewhere — you'll use it twice below.

### 4b. Login on EC2 (one-time)

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
echo "<YOUR-PAT>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

This persists credentials in `~/.docker/config.json` so future pulls work.

---

## 5. Configure GitHub Actions secrets (one-time)

In your GitHub repo → Settings → Secrets and variables → Actions → **New
repository secret**. Add the following:

| Name              | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `EC2_HOST`        | The Elastic IP, e.g. `13.234.56.78`                              |
| `EC2_USER`        | `ubuntu`                                                         |
| `EC2_SSH_KEY`     | The contents of `your-key.pem` (full file, including `BEGIN/END`)|
| `GHCR_USERNAME`   | Your GitHub username                                             |
| `GHCR_TOKEN`      | The PAT from step 4a                                             |

Note: `GITHUB_TOKEN` is automatic — you don't need to add it.

---

## 6. First deploy

Push to `main`:

```bash
git add .
git commit -m "ci: enable docker deploy"
git push origin main
```

Watch the run under **Actions** in your GitHub repo. The workflow will:

1. Build `bizautomate-server` and `bizautomate-client` images.
2. Push them to `ghcr.io/<you>/bizautomate-server:<sha>` and `:latest`.
3. SSH into EC2, copy `docker-compose.prod.yml`, `docker compose pull`,
   recreate containers, run `prisma migrate deploy`, and curl `/api/health`.

Open `http://<EC2_IP>` in your browser. You should see the BizAutomate login
page.

Register your first user. Done.

---

## 7. Day-2 operations

### Tail logs

```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
cd /srv/bizautomate
docker compose -f docker-compose.prod.yml logs -f --tail=200 server
docker compose -f docker-compose.prod.yml logs -f --tail=200 client
```

### Restart everything

```bash
docker compose -f docker-compose.prod.yml restart
```

### Roll back to a previous image

The image tag is the 7-char git SHA. To roll back, set it manually:

```bash
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=abc1234|' /srv/bizautomate/.env
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Database backup (manual, idempotent)

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "/srv/bizautomate/backups/biz-$(date +%F-%H%M).sql.gz"
```

Wire that into a daily cron later.

### Restore from a backup

```bash
gunzip -c biz-2026-04-25-1300.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
      psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

### Run a one-off Prisma command

```bash
docker compose -f docker-compose.prod.yml exec server \
  npx prisma migrate status
```

---

## 8. Adding HTTPS later (when you buy a domain)

When you have a domain pointing to `EC2_IP`:

1. Stop the `client` container temporarily.
2. Run a `certbot --nginx` flow on the host (or add a `letsencrypt` companion
   container).
3. Mount the certs into the client container and update `client/nginx.conf` to
   listen on 443 with `ssl_certificate` directives.
4. Open port 443 in the security group.

A `docker-compose.prod.https.yml` overlay can be added later — left out for now
to keep the free-tier setup minimal.

---

## 9. Local docker-compose (optional)

To test the full prod stack on your laptop:

```bash
docker compose up --build
# open http://localhost:8080
```

This builds images from source and runs a complete copy of the stack with a
local Postgres. Useful before pushing to main.
