# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN apk add --no-cache openssl
RUN npm install
COPY . .
RUN npx prisma generate

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app ./
EXPOSE 8000
CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && npm start"]
