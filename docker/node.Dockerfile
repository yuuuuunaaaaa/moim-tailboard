FROM node:18-alpine

WORKDIR /usr/src/app

COPY backend/package.json backend/package-lock.json* ./backend/

WORKDIR /usr/src/app/backend

RUN npm install

WORKDIR /usr/src/app
COPY backend ./backend

EXPOSE 3000

CMD ["npm", "start"]

