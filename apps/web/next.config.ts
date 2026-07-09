import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*"],
  images: {
    remotePatterns: [
      {hostname: "cdn.shopify.com"},
      {hostname: "lh3.googleusercontent.com"},
    ],
  },
};

export default nextConfig;
