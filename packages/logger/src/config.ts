import pino, {LoggerOptions} from "pino";
import {serializers} from "./serialisers";

export interface CreateLoggerOptions {
  service: string;
}

export function createLogger({service}: CreateLoggerOptions) {
  // Lambda's advanced logging controls export the configured application log
  // level as AWS_LAMBDA_LOG_LEVEL (e.g. "INFO"/"DEBUG"). Honour it so pino's own
  // threshold matches the level Lambda is filtering at, instead of always
  // dropping debug/trace at "info". An explicit LOG_LEVEL still wins.
  const level = (
    process.env.LOG_LEVEL ?? process.env.AWS_LAMBDA_LOG_LEVEL ?? "info"
  ).toLowerCase();

  const options: LoggerOptions = {
    level,

    // Lambda's log-level filtering reads a *string* "level" field
    // (trace/debug/info/warn/error/fatal). Pino defaults to a numeric level,
    // which Lambda can't parse and treats as INFO — breaking filtering. Emit the
    // level label so Lambda routes each line to its real level.
    formatters: {
      level(label) {
        return {level: label.toUpperCase()};
      },
    },

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
        "email",
        "verificationCode",
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