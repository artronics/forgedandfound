FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /usr/app

RUN corepack enable

# Workspace files
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./

# Package manifests
COPY services/auth-shopify-customer-sync-handler/package.json ./services/auth-shopify-customer-sync-handler/
COPY packages/shopify-admin-client/package.json ./packages/shopify-admin-client/
COPY packages/secret-manager/package.json ./packages/secret-manager/

RUN pnpm --filter @forgedandfound/auth-shopify-customer-sync-handler... install

# Source code
COPY services/auth-shopify-customer-sync-handler ./services/auth-shopify-customer-sync-handler
COPY packages ./packages

WORKDIR /usr/app/services/auth-shopify-customer-sync-handler

RUN pnpm run build

FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/services/auth-shopify-customer-sync-handler/dist/index.js ./

CMD ["index.handler"]