FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --chown=node:node package.json server.mjs index.html favicon.svg ./
COPY --chown=node:node src ./src
COPY --chown=node:node server ./server
COPY --chown=node:node styles ./styles
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
