FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install --legacy-peer-deps || npm install --force
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm","run","preview"]
