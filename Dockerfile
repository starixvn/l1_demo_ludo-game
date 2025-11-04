# Multi-stage Dockerfile for Ludo Game React Application

# Stage 1: Build stage
FROM hub.lumigame.com/base/node:22-alpine-25h2 AS builder

# Set working directory
WORKDIR /app

# Set Node.js options for OpenSSL compatibility with Webpack 4
ENV NODE_OPTIONS=--openssl-legacy-provider

# Copy package files
COPY package*.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile || yarn install

# Copy source code and configuration files
COPY . .

# Build the application
RUN yarn build

# Stage 2: Production stage
FROM hub.lumigame.com/base/nginx:brotli-1.20.2-zlib

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration (optional, for SPA routing support)
RUN echo 'server { \
    listen 5000; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 5000

# Start nginx (the base image likely has nginx as ENTRYPOINT, so just pass the flags)

