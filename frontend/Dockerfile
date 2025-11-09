FROM node:20-alpine AS build
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps || npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm install -g serve
EXPOSE 4173
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL:-/api}
CMD ["serve", "-s", "dist", "-l", "4173"]
