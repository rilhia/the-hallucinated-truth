FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

# 🔥 IMPORTANT FIX — create the src folder so bundler can see it
RUN mkdir -p /app/src

# Copy your source code into the image (before bind mount)
COPY src /app/src

CMD ["node", "src/server.js"]
