import type {NextConfig} from "next";
import path from "node:path";

// This app lives in a pnpm/turbo monorepo. Both roots must point at the repo root
const workspaceRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  transpilePackages: ["@forgedandfound/logger"],
  serverExternalPackages: ["pino", "pino-pretty"],
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    remotePatterns: [
      {hostname: "cdn.shopify.com"},
      {hostname: "lh3.googleusercontent.com"},
    ],
  },
};

export default nextConfig;
