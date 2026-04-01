FROM node:20-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start"]
