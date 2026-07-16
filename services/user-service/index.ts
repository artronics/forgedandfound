import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import {withLambdaLogger} from "@forgedandfound/logger/lambda";
import {getLogger} from "@forgedandfound/logger";

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  return withLambdaLogger(context, async () => {
    return await userService(event);
  });
};

const userService = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const logger = getLogger();
  logger.debug({path: event.path, method: event.httpMethod}, "received event");

  // Routing stub: echo what was received so the domain → API GW → Cognito auth →
  // Lambda path can be verified end-to-end. The Cognito email update lands next.
  const id = event.pathParameters?.id;
  const body = event.body ? JSON.parse(event.body) : null;

  return {
    statusCode: 200,
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      message: "user-service reached",
      method: event.httpMethod,
      id,
      body,
    }),
  };
};
