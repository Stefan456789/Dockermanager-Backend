FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
