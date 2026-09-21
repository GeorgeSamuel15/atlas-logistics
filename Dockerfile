FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /var/lib/atlas && chown -R node:node /var/lib/atlas
ENV HOST=0.0.0.0 PORT=4000 DB_PATH=/var/lib/atlas/atlas.sqlite
USER node
EXPOSE 4000
CMD ["npm","start"]
