FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json jest.config.js ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 bridge && \
    adduser --system --uid 1001 --ingroup bridge bridge && \
    chown -R bridge:bridge /app

USER bridge

COPY --from=builder --chown=bridge:bridge /app/package*.json ./
COPY --from=builder --chown=bridge:bridge /app/node_modules ./node_modules
COPY --from=builder --chown=bridge:bridge /app/dist ./dist

# Sin puerto HTTP expuesto: el bridge es cliente TCP hacia la pesa y HTTP hacia el backend.
CMD ["node", "dist/index.js"]
