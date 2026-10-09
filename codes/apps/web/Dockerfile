FROM node:22.19.0-alpine AS build
WORKDIR /src/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
COPY packages/ /src/packages/
RUN npm run build

FROM nginx:1.28.0-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist/ /usr/share/nginx/html/
EXPOSE 80
