import {awsEnv} from "../../env.ts";
import {info} from "../log.ts";

import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const MAX_DELETE = 4;

export async function cognitoDeleteAll() {
  const aws = awsEnv();
  const client = new CognitoIdentityProviderClient({});

  const users = await client.send(
    new ListUsersCommand({
      UserPoolId: aws.cognito.userPoolId,
      Limit: MAX_DELETE,
    }),
  );

  if (!users.Users?.length) {
    info("No users found.");
    return;
  }

  info(`Deleting ${users.Users.length} user(s) (maximum ${MAX_DELETE}).`);

  for (const user of users.Users) {
    if (!user.Username) continue;

    info(`Deleting ${user.Username}`);

    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: aws.cognito.userPoolId,
        Username: user.Username,
      }),
    );
  }

  info("Done.");
}
