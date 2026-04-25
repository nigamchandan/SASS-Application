# syntax=docker/dockerfile:1.7
# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Install build tools needed to build native deps if any (e.g. bcrypt-style fallbacks)
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --include=dev


# ---------- Stage 2: build (generate prisma client) ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client against the schema
RUN npx prisma generate

# Trim to production deps only for the final image
RUN npm prune --omit=dev


# ---------- Stage 3: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Install runtime deps + tini for clean signal forwarding
RUN apk add --no-cache openssl tini curl \
  && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=5000

# Copy production dependencies, generated Prisma client, and source
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json

# Persistent uploads directory (mounted as a volume in docker-compose)
RUN mkdir -p /app/uploads/logos && chown -R app:app /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER app

EXPOSE 5000

# Tini reaps zombies and forwards signals to node
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/api/health || exit 1
