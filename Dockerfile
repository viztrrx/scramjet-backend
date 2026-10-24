# Node server from src/index.js. On Render it does everything; in the Oracle
# setup (oracle/) it only answers /health and /dns, and epoxy-server handles /wisp/.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV WISP_ENABLED=true PORT=8080
USER node
EXPOSE 8080
CMD ["node", "src/index.js"]
