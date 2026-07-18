import pino from "pino";

export const serializers = {
  err: pino.stdSerializers.err,

  req(req: any) {
    return {
      method: req.method,
      url: req.url,
      headers: req.headers,
    };
  },

  res(res: any) {
    return {
      statusCode: res.statusCode,
    };
  },
};