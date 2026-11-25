# syntax=docker/dockerfile:1

# Etapa 1: compilación (TypeScript + React -> archivos estáticos)
FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: Nginx sirve los estáticos y reenvía /api al backend
FROM nginx:1.28-alpine AS runner

# URL interna del backend en la red de docker-compose
ENV BACKEND_URL=http://backend:2000

COPY nginx/seguridad.conf /etc/nginx/snippets/seguridad.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
