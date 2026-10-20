FROM node:22.19.0-alpine AS build
WORKDIR /source
COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --ignore-scripts
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN npm run build --workspace @hospital/web
FROM nginx:1.29.6-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /source/apps/web/dist /usr/share/nginx/html
EXPOSE 80
