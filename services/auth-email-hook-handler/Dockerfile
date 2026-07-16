FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /usr/app

RUN corepack enable

# Workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./

# Package manifests
COPY services/auth-email-hook-handler/package.json ./services/auth-email-hook-handler/
COPY packages/logger/package.json ./packages/logger/
COPY packages/email/package.json ./packages/email/

# Install auth-email-hook-handler and all workspace dependencies from the committed lockfile
RUN pnpm --filter @forgedandfound/auth-email-hook-handler... install --frozen-lockfile

# Source code
COPY services/auth-email-hook-handler ./services/auth-email-hook-handler
COPY packages ./packages

WORKDIR /usr/app/services/auth-email-hook-handler

RUN pnpm run build


FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/services/auth-email-hook-handler/dist/index.js ./

CMD ["index.handler"]