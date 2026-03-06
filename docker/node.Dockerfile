FROM node:20-alpine

WORKDIR /usr/src/app

COPY backend/package.json backend/package-lock.json* ./backend/
COPY prisma ./prisma

WORKDIR /usr/src/app/backend

RUN npm install

WORKDIR /usr/src/app
COPY backend ./backend

WORKDIR /usr/src/app/backend

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]

