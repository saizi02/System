# SSTWAS 2.0: one image runs the API and serves the built web app.
FROM node:20-alpine AS web
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production STATIC_DIR=/app/dist PORT=3001
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=web /app/dist /app/dist
RUN mkdir -p /app/server/uploads && chown -R node:node /app/server/uploads
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
# Apply any new database migrations, then start. Safe to repeat on every start.
CMD ["sh","-c","node scripts/migrate.js && node src/index.js"]
