import pino, {LoggerOptions} from "pino";
import {serializers} from "./serialisers";

export interface CreateLoggerOptions {
  service: string;
}

export function createLogger({service}: CreateLoggerOptions) {
  const options: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? "info",

    base: {
      service,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
    },

    timestamp: pino.stdTimeFunctions.isoTime,

    serializers,

    redact: {
      paths: [
        "password",
        "token",
        "accessToken",
        "refreshToken",
        "authorization",
        "headers.authorization",
        "cookie",
      ],
      censor: "[REDACTED]",
    },

    transport:
      process.env.NODE_ENV === "development"
        ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        }
        : undefined,
  };

  return pino(options);
}