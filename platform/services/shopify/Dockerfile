FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /usr/app

RUN corepack enable

# Workspace files
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./

# Package manifests
COPY shopify/package.json ./shopify/
COPY --from=root packages/lib/package.json ./packages/lib/
COPY --from=root packages/email/package.json ./packages/email/

# Install only shopify and its workspace dependencies
RUN pnpm --filter @forgedandfound/shopify... install

# Source code
COPY shopify ./shopify
COPY --from=root packages ./packages

WORKDIR /usr/app/shopify

RUN pnpm run build

FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/shopify/dist/index.js ./

CMD ["index.handler"]