import {VercelConfig} from "@vercel/config/v1";
export const config: VercelConfig = {
  framework: 'nextjs',
  cleanUrls: true,
  trailingSlash: false,

  buildCommand: 'turbo run build --filter=@forgedandfound/web',


  // Never deploy automatically from Git. We use GitHub Actions.
  ignoreCommand: "exit 0",
};
