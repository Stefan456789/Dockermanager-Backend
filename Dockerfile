FROM node:20-alpine

WORKDIR /app

# Install dependencies needed for node-gyp
RUN apk add --no-cache python3 py3-pip make g++ 
RUN pip3 install setuptools

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
