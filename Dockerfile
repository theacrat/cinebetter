FROM oven/bun:latest AS base
WORKDIR /app

FROM base AS build

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM base AS runner

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/schemas ./schemas
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./

ENV NODE_ENV=production

EXPOSE ${PORT}

ENTRYPOINT ["./docker-entrypoint.sh"]