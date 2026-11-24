# syntax=docker/dockerfile:1

# Etapa 1: compilación (TypeScript -> JavaScript)
FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: ejecución (solo dependencias de producción y código compilado)
FROM node:24-slim AS runner

ENV NODE_ENV=production

# curl lo usa el healthcheck definido en docker-compose.yml
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /app/dist ./dist

USER node

# Debe coincidir con APP_PORT del archivo .env
EXPOSE 2000

CMD ["node", "dist/index.js"]
