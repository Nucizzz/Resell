# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# assicurati che devDependencies vengano installate
ENV NODE_ENV=development
RUN npm ci || npm install
COPY . .
RUN npm run build

# ---- runtime (statico) ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# opzionale: SPA fallback per React Router
RUN printf "server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files \$uri /index.html;\n  }\n}\n" > /etc/nginx/conf.d/default.conf
EXPOSE 80
