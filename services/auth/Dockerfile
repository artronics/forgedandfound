FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /usr/app

RUN corepack enable

# Workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./

# Package manifests
COPY services/auth/package.json ./services/auth/
COPY packages/lib/package.json ./packages/lib/
COPY packages/email/package.json ./packages/email/

# Install auth and all workspace dependencies from the committed lockfile
RUN pnpm --filter @forgedandfound/auth... install --frozen-lockfile

# Source code
COPY services/auth ./services/auth
COPY packages ./packages

WORKDIR /usr/app/services/auth

RUN pnpm run build


FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/services/auth/dist/index.js ./

CMD ["index.handler"]