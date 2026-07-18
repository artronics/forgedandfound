import {VercelConfig} from "@vercel/config/v1";
export const config: VercelConfig = {
  framework: 'nextjs',
  cleanUrls: true,
  trailingSlash: false,

  buildCommand: 'turbo run build --filter=@forgedandfound/web',

  // Skip the deployment entirely unless `web` OR one of its workspace
  // dependencies changed in the pushed commit range.
  ignoreCommand: 'npx turbo-ignore @forgedandfound/web',
};
