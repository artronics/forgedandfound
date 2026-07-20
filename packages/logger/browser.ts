import pino from "pino";

function resolveLevel(): string {
  if (process.env.NEXT_PUBLIC_LOG_LEVEL) {
    return process.env.NEXT_PUBLIC_LOG_LEVEL;
  }

  const isDevServer = process.env.NODE_ENV === "development";
  const isVercelNonProd =
    !!process.env.NEXT_PUBLIC_VERCEL_ENV &&
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

  return isDevServer || isVercelNonProd ? "debug" : "info";
}

export const browserLogger = pino({
  level: resolveLevel(),
  base: {
    service: "web-client",
  },
  browser: {
    asObject: true,
  },
});
