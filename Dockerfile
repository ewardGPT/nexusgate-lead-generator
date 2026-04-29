FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN apk add --no-cache chromium chromium-chromedriver ca-certificates curl && rm -rf /var/cache/apk/*
RUN mkdir -p /usr/local/bin && curl -sL https://github.com/gosom/google-maps-scraper/releases/download/v1.12.1/google_maps_scraper-1.12.1-linux-amd64 -o /usr/local/bin/google-maps-scraper && chmod +x /usr/local/bin/google-maps-scraper && ls -la /usr/local/bin/google-maps-scraper
RUN mkdir -p /app/output /root/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64 && ln -sf /usr/bin/chromium-browser /root/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome
COPY apps/worker/package.json apps/worker/tsconfig.json apps/worker/tsconfig.base.json ./
COPY apps/worker/src ./src
RUN pnpm install --no-frozen-lockfile --filter=worker && pnpm build
CMD ["node", "apps/worker/dist/index.js"]