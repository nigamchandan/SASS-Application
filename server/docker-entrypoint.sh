#!/bin/sh
set -e

echo "[entrypoint] Waiting for database to accept connections..."
# Block until the DB is reachable. Uses Node's built-in `net` so we don't need
# to bake psql into the image.
node -e "
const net = require('net');
const u = new URL(process.env.DATABASE_URL);
const host = u.hostname;
const port = Number(u.port || 5432);
const max = 60;
const tryOnce = () => new Promise((resolve, reject) => {
  const s = net.createConnection({ host, port, timeout: 2000 });
  s.once('connect', () => { s.destroy(); resolve(); });
  s.once('error', reject);
  s.once('timeout', () => { s.destroy(); reject(new Error('timeout')); });
});
(async () => {
  for (let i = 1; i <= max; i++) {
    try { await tryOnce(); console.log('[entrypoint] db is up'); return; }
    catch (e) { await new Promise(r => setTimeout(r, 1000)); }
  }
  console.error('[entrypoint] db never became ready');
  process.exit(1);
})();
"

echo "[entrypoint] Running prisma migrate deploy..."
npx --no-install prisma migrate deploy

echo "[entrypoint] Starting app: $@"
exec "$@"
