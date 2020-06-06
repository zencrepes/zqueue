FROM node:alpine as builder
WORKDIR /app

COPY package.json .
COPY yarn.lock .
RUN yarn
COPY . .

RUN yarn run build

# Start Nginx server
CMD ["yarn", "run", "start:prod"]