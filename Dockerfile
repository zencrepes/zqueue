FROM node:alpine as builder
WORKDIR /app

ENV APP_VERSION $APP_VERSION

COPY package.json .
COPY yarn.lock .
RUN yarn
COPY . .

RUN yarn run build

# Start Nginx server
CMD ["yarn", "run", "start:prod"]