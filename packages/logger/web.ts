import {randomUUID} from "node:crypto";
import {Logger} from "pino";

import {createLogger} from "./src/config";
import {tryGetLogger, withLogger} from "./src/context";
import {parseTraceparent, REQUEST_ID_HEADER, TRACEPARENT_HEADER} from "./src/trace";

const rootLogger = createLogger({
  service: "web",
});

export function getRequestId(headers: Headers): string {
  return headers.get(REQUEST_ID_HEADER) ?? randomUUID();
}

export function getLogger(): Logger {
  return tryGetLogger() ?? rootLogger;
}

/**
 * Runs `handler` inside a request-scoped logging context.
 *
 * A child logger is created from the root web logger and bound to the current
 * async execution via `AsyncLocalStorage`. Any code called during `handler`
 * (including nested async calls) can retrieve that same logger with
 * `getLogger()`, so every log line for the request shares the same context
 * without threading a logger through function arguments.
 *
 * The child logger is enriched with:
 * - `requestId` — taken from the incoming `x-request-id` header (set upstream
 *   in `proxy.ts`), or a freshly generated UUID if absent.
 * - `traceId` / `spanId` — parsed from the W3C `traceparent` header when
 *   present, so logs correlate with OpenTelemetry / Vercel traces.
 * - `method` and `url` of the request.
 *
 * Establishing the context is synchronous and near-zero cost: it sets the
 * store and immediately invokes `handler`, returning its promise unchanged —
 * it does not await or otherwise block.
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   return withWebLogger(req, async () => {
 *     getLogger().info("handling request");
 *     return NextResponse.json({ok: true});
 *   });
 * }
 *
 * @param request - The incoming request; its headers supply the log context.
 * @param handler - The work to run within the logging context.
 * @returns Whatever `handler` resolves to.
 */
export async function withWebLogger<T>(
  request: Request,
  handler: () => Promise<T>,
): Promise<T> {
  const {headers} = request;
  const trace = parseTraceparent(headers.get(TRACEPARENT_HEADER));

  const logger = rootLogger.child({
    requestId: getRequestId(headers),
    ...(trace && {traceId: trace.traceId, spanId: trace.spanId}),
    method: request.method,
    url: request.url,
  });

  return withLogger(logger, handler);
}

export {REQUEST_ID_HEADER, TRACEPARENT_HEADER} from "./src/trace";
