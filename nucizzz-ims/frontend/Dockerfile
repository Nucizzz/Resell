FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . ./
RUN npm run build
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
RUN npm i vite -g
EXPOSE 5173
CMD ["vite","preview","--host","0.0.0.0","--port","5173","--strictPort"]
