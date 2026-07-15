import {Context} from "aws-lambda";

import {createLogger} from "./src/config";
import {withLogger} from "./src/context";

const rootLogger = createLogger({
  service: "lambda",
});

let coldStart = true;

export async function withLambdaLogger<T>(
  context: Context,
  handler: () => Promise<T>,
): Promise<T> {
  const logger = rootLogger.child({
    awsRequestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    coldStart,
  });

  coldStart = false;

  return withLogger(logger, handler);
}