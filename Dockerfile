FROM node:alpine as builder

ARG APP_VERSION_ARG=latest

WORKDIR /app

ENV APP_VERSION=$RELEASE_VERSION_ARG

COPY package.json .
COPY yarn.lock .
RUN yarn
COPY . .

RUN yarn run build

# Start Nginx server
CMD ["yarn", "run", "start:prod"]