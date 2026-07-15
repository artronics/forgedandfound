import {AsyncLocalStorage} from "node:async_hooks";
import {Logger} from "pino";

const storage = new AsyncLocalStorage<Logger>();

export function withLogger<T>(
  logger: Logger,
  fn: () => T,
): T {
  return storage.run(logger, fn);
}

export function getLogger(): Logger {
  const logger = storage.getStore();

  if (!logger) {
    throw new Error("No logger available in AsyncLocalStorage");
  }

  return logger;
}