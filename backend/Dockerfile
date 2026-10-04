FROM node:22-alpine AS development
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:docker"]

FROM development AS build
RUN npx prisma generate && npm run build

# One-shot migration job, completed before the application starts.
FROM build AS migration
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM build AS runtime-dependencies
RUN npm prune --omit=dev

FROM node:22-alpine AS release
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts/seed-demo.cjs ./scripts/seed-demo.cjs
COPY --from=build --chown=node:node /app/scripts/seed-showcase.cjs ./scripts/seed-showcase.cjs
RUN mkdir -p /app/.local && chown node:node /app/.local
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
