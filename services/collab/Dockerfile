FROM node:20-alpine

# docker-cli lets the terminal sandbox spawn sibling containers via the host
# Docker socket (mounted at runtime). git/bash support common workspace tasks.
RUN apk add --no-cache docker-cli git bash

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
