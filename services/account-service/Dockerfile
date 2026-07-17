FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /usr/app

RUN corepack enable

# Workspace files
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./

# Package manifests
COPY services/account-service/package.json ./services/account-service/
COPY packages/logger/package.json ./packages/logger/
COPY packages/email/package.json ./packages/email/
COPY packages/shopify-admin-client/package.json ./packages/shopify-admin-client/
COPY packages/secret-manager/package.json ./packages/secret-manager/

RUN pnpm --filter @forgedandfound/account-service... install

# Source code
COPY services/account-service ./services/account-service
COPY packages ./packages

WORKDIR /usr/app/services/account-service

RUN pnpm run build

FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/services/account-service/dist/index.js ./

CMD ["index.handler"]
