FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /usr/app

RUN corepack enable

# Workspace files
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./

# Package manifests
COPY services/user-service/package.json ./services/user-service/
COPY packages/logger/package.json ./packages/logger/

RUN pnpm --filter @forgedandfound/user-service... install

# Source code
COPY services/user-service ./services/user-service
COPY packages ./packages

WORKDIR /usr/app/services/user-service

RUN pnpm run build

FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/services/user-service/dist/index.js ./

CMD ["index.handler"]