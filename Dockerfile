FROM node:20-alpine AS base
WORKDIR /app

# System deps required by Prisma & pg client
RUN apk add --no-cache libc6-compat openssl bash curl postgresql-client

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Ensure entrypoint is executable and has LF line endings
RUN chmod +x /app/scripts/entrypoint.sh && \
    sed -i 's/\r$//' /app/scripts/entrypoint.sh

ARG APP_ENV=production
# Allow Next.js config to see NEXTAUTH_URL during build (optional)
ARG NEXTAUTH_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL
RUN if [ "$APP_ENV" = "production" ]; then npm run build; else echo "Skipping build for dev image"; fi

EXPOSE 3000
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
