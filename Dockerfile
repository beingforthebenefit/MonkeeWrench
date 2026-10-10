# Two stages. `base` has every dependency and the source: the dev stack runs
# it (docker-compose.dev.yml, target: base) and it builds the app. The final
# stage is what's published (ghcr.io/beingforthebenefit/bandstand): the
# built app with production dependencies only.
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
RUN if [ "$APP_ENV" = "production" ]; then npm run build && rm -rf .next/cache; else echo "Skipping build for dev image"; fi

EXPOSE 3000
ENTRYPOINT ["/app/scripts/entrypoint.sh"]

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl bash curl postgresql-client
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# Production dependencies (prisma and tsx among them: migrations on start,
# and the scripts/ an owner runs by hand)
COPY package.json package-lock.json ./
# The compiler is for building (270 MB); `next start` never loads it
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force && \
    rm -rf node_modules/@next/swc-*
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/scripts ./scripts
COPY --from=base /app/src ./src
COPY next.config.mjs tsconfig.json ./

# The commit this image was built from, for /api/health (CI and make
# hosted-deploy pass it). Last, so it never invalidates the layers above.
ARG GIT_SHA=
ENV GIT_SHA=$GIT_SHA

EXPOSE 3000
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
