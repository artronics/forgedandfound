import {randomUUID} from "node:crypto";

import {createLogger} from "./src/config";
import {withLogger} from "./src/context";

const rootLogger = createLogger({
  service: "web",
});

export async function withWebLogger<T>(
  request: Request,
  handler: () => Promise<T>,
) {
  const logger = rootLogger.child({
    requestId: randomUUID(),
    method: request.method,
    url: request.url,
  });

  return withLogger(logger, handler);
}