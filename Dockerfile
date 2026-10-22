FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=5000 \
    COMMAND_TIMEOUT=15

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node app.js ./
COPY --chown=node:node views ./views
COPY --chown=node:node static ./static

RUN chown node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "app.js"]
