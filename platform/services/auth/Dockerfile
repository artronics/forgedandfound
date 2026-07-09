FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /usr/app

RUN corepack enable

# Workspace files
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./

# Package manifests
COPY auth/package.json ./auth/
COPY --from=root packages/lib/package.json ./packages/lib/
COPY --from=root packages/email/package.json ./packages/email/

# Install auth and all workspace dependencies
RUN pnpm --filter @forgedandfound/auth... install

# Source code
COPY auth ./auth
COPY --from=root packages/lib ./packages/lib
COPY --from=root packages/email ./packages/email

WORKDIR /usr/app/auth

RUN pnpm run build


FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/auth/dist/index.js ./

CMD ["index.handler"]