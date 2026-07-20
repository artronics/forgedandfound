import pino from "pino";

export const serializers = {
  err: pino.stdSerializers.err,

  req(req: { method?: string; url?: string; headers?: Record<string, unknown> }) {
    return {
      method: req.method,
      url: req.url,
      headers: req.headers,
    };
  },

  res(res: { statusCode?: number }) {
    return {
      statusCode: res.statusCode,
    };
  },
};