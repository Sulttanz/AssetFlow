# Build from the repository root. Pin NODE_IMAGE to an approved digest for a release.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json vite.config.ts drizzle.config.ts ./
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
COPY migrations ./migrations
ENV NODE_ENV=production
# Preserve the project's dependency-audit gate; do not bypass it for images.
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5000
# The current production bundle statically imports Vite and its plugin config.
# Keep the audited dependency tree until that runtime import graph is separated.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/migrations/onprem ./migrations/onprem
RUN mkdir -p server/uploads && chown -R node:node server
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/system/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
