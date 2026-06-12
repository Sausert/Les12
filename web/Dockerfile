FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# DATABASE_URL is not needed at build time; prisma only generates the client.
RUN npx prisma generate && npm run build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
# Apply migrations and (idempotent) seed before serving.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm start"]
