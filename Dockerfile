# syntax=docker/dockerfile:1
FROM node:24.4.0-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@10.22.0 --activate

# corepack unpacks pnpm's bundled node-gyp without the executable bit, and the Makefile node-gyp
# generates runs gyp_main.py as a program. Only arm64 reaches that path: node-pty ships an x64
# prebuild and never compiles there, while on arm64 it builds from source and the install dies
# with "gyp_main.py: Permission denied".
RUN find /root/.cache/node/corepack -name gyp_main.py -exec chmod +x {} +

FROM base AS build
WORKDIR /usr/src/app

# Toolchain for the native modules. Nothing here depends on the source, so the layer survives
# every source change.
RUN apt-get update && apt-get install -y python3 make g++ git python3-pip pkg-config libsecret-1-dev && rm -rf /var/lib/apt/lists/*

# Manifests before sources. Installing dependencies, which compiles native modules, is by far
# the slowest step, and copying the whole tree first made it rerun on every edit to any file.
# Copied on their own, it reruns only when the dependency set actually changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/dokploy/package.json apps/dokploy/
COPY apps/schedules/package.json apps/schedules/
COPY packages/server/package.json packages/server/
COPY packages/server/src/emails/package.json packages/server/src/emails/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# node_modules is excluded by .dockerignore, so this cannot clobber what was just installed.
COPY . .

# Deploy only the dokploy app

ENV NODE_ENV=production

# Next.js inlines NEXT_PUBLIC_* into the client bundle as it compiles, so the repository the
# panel links to on the login and crash pages is fixed here and cannot be changed by setting an
# environment variable on the running container. Declared immediately before the build it
# affects, so a fork overriding it does not rebuild the dependency layers.
ARG NEXT_PUBLIC_PANEL_REPO_URL
ENV NEXT_PUBLIC_PANEL_REPO_URL=$NEXT_PUBLIC_PANEL_REPO_URL

RUN pnpm --filter=@dokploy/server build
RUN pnpm --filter=./apps/dokploy run build

RUN pnpm --filter=./apps/dokploy --prod deploy --legacy /prod/dokploy

RUN cp -R /usr/src/app/apps/dokploy/.next /prod/dokploy/.next
RUN cp -R /usr/src/app/apps/dokploy/dist /prod/dokploy/dist

FROM base AS dokploy
WORKDIR /app

# Set production
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y curl unzip zip apache2-utils iproute2 rsync git-lfs && git lfs install && rm -rf /var/lib/apt/lists/*

# The build tooling the panel shells out to when it deploys other people's applications. None of
# it depends on this application's own code, so it is installed before the build output is copied
# in: placed after, every one of these downloads repeated on every single build, because the
# copied artifacts differ each time and invalidate everything below them.

# Install docker
RUN curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh --version 28.5.2 && rm get-docker.sh && curl https://rclone.org/install.sh | bash

# Install Nixpacks and tsx
# | VERBOSE=1 VERSION=1.21.0 bash

ARG NIXPACKS_VERSION=1.41.0
RUN curl -sSL https://nixpacks.com/install.sh -o install.sh \
    && chmod +x install.sh \
    && ./install.sh \
    && pnpm install -g tsx

# Install Railpack
ARG RAILPACK_VERSION=0.15.4
RUN curl -sSL https://railpack.com/install.sh | bash

# Install buildpacks
COPY --from=buildpacksio/pack:0.39.1 /usr/local/bin/pack /usr/local/bin/pack

# Copy only the necessary files
COPY --from=build /prod/dokploy/.next ./.next
COPY --from=build /prod/dokploy/dist ./dist
COPY --from=build /prod/dokploy/next.config.mjs ./next.config.mjs
COPY --from=build /prod/dokploy/public ./public
COPY --from=build /prod/dokploy/package.json ./package.json
COPY --from=build /prod/dokploy/drizzle ./drizzle
COPY .env.production ./.env
COPY --from=build /prod/dokploy/components.json ./components.json
COPY --from=build /prod/dokploy/node_modules ./node_modules

# Declared last: the value changes on every build, and anything after an ARG is rebuilt, so it
# must sit past the expensive layers. The panel reports this as its version and compares it
# against the published tags to decide whether an update exists.
ARG PANEL_VERSION
ENV PANEL_VERSION=$PANEL_VERSION

# Defaulted from the same build as the client bundle above, so a fork's server-side and
# client-side links agree without configuring anything. Unlike the client value this one is read
# at runtime, so setting it on the container still works.
ARG PANEL_REPO_URL
ENV PANEL_REPO_URL=$PANEL_REPO_URL

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fs http://localhost:3000/api/trpc/settings.health || exit 1

# Ejecutar node directamente: pnpm como wrapper queda residente (~100MB RSS)
  CMD ["sh", "-c", "node -r dotenv/config dist/wait-for-postgres.mjs && node -r dotenv/config dist/migration.mjs && exec node -r dotenv/config dist/server.mjs"]
