# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm run build

FROM build AS migration

ENV NODE_ENV=production
CMD ["pnpm", "run", "migration:run"]

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

RUN mkdir -p /app/.puya-tmp && chown node:node /app/.puya-tmp

USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
