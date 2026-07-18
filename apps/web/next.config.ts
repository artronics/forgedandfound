import type {NextConfig} from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  transpilePackages: ["@forgedandfound/logger"],
  serverExternalPackages: ["pino", "pino-pretty"],
  images: {
    remotePatterns: [
      {hostname: "cdn.shopify.com"},
      {hostname: "lh3.googleusercontent.com"},
    ],
  },
  turbopack: {
        root: path.join(__dirname, '../..'),
  }
};

export default nextConfig;
