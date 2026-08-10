FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY src ./src
COPY README.md ./README.md

ENV PORT=3001
EXPOSE 3001
CMD ["npm", "start"]
