# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .

# VITE_BACKEND_URL is a build-time arg.
# Set it in fly.toml [build.args] to point to your FastAPI backend.
ARG VITE_BACKEND_URL=/api/v1
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx-fly.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
