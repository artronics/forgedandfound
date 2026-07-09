import {VercelConfig} from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: 'pnpm run build',
  cleanUrls: true,
  trailingSlash: false,
};