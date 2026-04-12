FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* tsconfig.json ./

RUN npm install

COPY src/ ./src/

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --production

COPY --from=builder /app/dist ./dist

EXPOSE 8088

CMD ["node", "dist/index.js"]
