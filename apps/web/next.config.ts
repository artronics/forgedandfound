import type {NextConfig} from "next";

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
};

export default nextConfig;
