export const REQUEST_ID_HEADER = "x-request-id";
export const TRACEPARENT_HEADER = "traceparent";

export interface TraceContext {
  traceId: string;
  spanId: string;
}

export function parseTraceparent(
  header: string | null | undefined,
): TraceContext | undefined {
  if (!header) return undefined;

  const [, traceId, spanId] = header.split("-");
  if (!traceId || !spanId) return undefined;

  return {traceId, spanId};
}
