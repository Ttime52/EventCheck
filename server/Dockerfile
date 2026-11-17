# ==============================================================================
# TokTickIT — Backend Dockerfile for local Docker Compose (server + migrate)
# ==============================================================================
# Used by docker-compose.yml (`server` and `migrate` services).
# Cloud Run does NOT use this file — Cloud Run uses the root `Dockerfile`.
# Ref: https://docs.docker.com/reference/dockerfile/
#
# ⭐ CHANGE ME (groups using another tech stack):
#   # CHANGE ME: base image (node:24-alpine), install/build commands,
#   #            copied folders (prisma, src), PORT and CMD.
# ==============================================================================

# CHANGE ME: base image for your backend runtime.
FROM node:24-alpine AS build
WORKDIR /app
# Prisma requires openssl on alpine.
RUN apk add --no-cache openssl

# --- Install dependencies (cached until package*.json changes) ----------------
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci

# --- Generate Prisma client ---------------------------------------------------
# CHANGE ME: remove or replace if your stack does not use Prisma.
COPY server/ ./server/
RUN npm run prisma:generate --workspace=@eventcheck/server

# --- Copy source and build TypeScript -> dist/ --------------------------------
RUN npm run build --workspace=@eventcheck/server \
    && chmod +x ./server/docker-entrypoint.sh

FROM node:24-alpine AS runtime
WORKDIR /app/server
RUN apk add --no-cache openssl

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/src ./src
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/docker-entrypoint.sh ./docker-entrypoint.sh

# --- Runtime settings ---------------------------------------------------------
ENV NODE_ENV=production
ENV TZ=Asia/Bangkok
# CHANGE ME: port your backend listens on (must match docker-compose.yml).
ENV PORT=3000
EXPOSE 3000

# Run as non-root user.
USER node

# CHANGE ME: start command for your backend.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
