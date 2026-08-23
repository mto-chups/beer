FROM node:22-alpine AS build

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/backend/dist ./dist
COPY --chown=node:node public /app/public

RUN mkdir -p /app/backend/logs && chown -R node:node /app/backend

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "dist/server.js"]
