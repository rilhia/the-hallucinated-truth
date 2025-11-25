FROM alpine:latest

RUN apk add --no-cache git docker-cli docker-compose bash

COPY start.sh /start.sh
RUN chmod +x /start.sh

WORKDIR /workspace
