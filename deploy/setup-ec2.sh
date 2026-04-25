#!/usr/bin/env bash
# One-shot bootstrap for a fresh Ubuntu 22.04 EC2 t3.micro.
# Installs Docker + Compose plugin, sets up swap (cheap RAM safety net for 1GB),
# basic firewall, and lays out /srv/bizautomate.
#
# Usage on the EC2 instance:
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/setup-ec2.sh | sudo bash
# OR
#   scp deploy/setup-ec2.sh ubuntu@<ip>:/tmp/ && ssh ubuntu@<ip> 'sudo bash /tmp/setup-ec2.sh'

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Run as root (sudo bash setup-ec2.sh)"
  exit 1
fi

APP_DIR="/srv/bizautomate"
APP_USER="${SUDO_USER:-ubuntu}"

echo "[1/8] System update"
apt-get update -y
apt-get upgrade -y

echo "[2/8] Base utilities"
apt-get install -y curl ca-certificates gnupg lsb-release ufw fail2ban htop

echo "[3/8] Swap file (1G) for safety on 1GB RAM"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  sysctl vm.swappiness=10 || true
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
fi

echo "[4/8] Docker Engine + Compose plugin (official repo)"
install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
fi
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "[5/8] Add ${APP_USER} to docker group"
usermod -aG docker "${APP_USER}" || true

echo "[6/8] Enable services on boot"
systemctl enable --now docker
systemctl enable --now fail2ban

echo "[7/8] Firewall (allow 22, 80, 443 only)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[8/8] App directory layout"
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
cat <<'NOTE' > "${APP_DIR}/README.txt"
This directory holds the production deploy.
Files maintained here:
  docker-compose.prod.yml   -- pushed by GitHub Actions on every deploy
  .env                       -- production secrets (created manually, never committed)
Volumes:
  pgdata    -- Postgres data
  uploads   -- multer logo uploads
NOTE

echo
echo "============================================================="
echo "Bootstrap complete."
echo "Next steps:"
echo "  1. Log out + back in (so '${APP_USER}' picks up the docker group)"
echo "  2. Create ${APP_DIR}/.env from deploy/.env.production.example"
echo "  3. docker login ghcr.io  (with a PAT that has read:packages)"
echo "  4. Push to main on GitHub — CI will deploy automatically"
echo "============================================================="
