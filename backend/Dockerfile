FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* tsconfig.json ./

RUN npm install

COPY src/ ./src/

RUN npm run build

FROM node:20-alpine

WORKDIR /app

ARG APP_VERSION=unknown
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME

COPY package.json package-lock.json* ./

RUN npm install --production

COPY --from=builder /app/dist ./dist

EXPOSE 8088

CMD ["node", "dist/index.js"]
