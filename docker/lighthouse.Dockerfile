FROM node:24.21.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global lighthouse@13.5.0 \
    && npm cache clean --force

ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /workspace
CMD ["node", ".github/scripts/lighthouse-report.mjs"]
