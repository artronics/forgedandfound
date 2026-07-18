import {aws} from "../../env";

import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const MAX_DELETE = 4;

export async function cognitoDeleteAll() {
  const client = new CognitoIdentityProviderClient({});

  const users = await client.send(
    new ListUsersCommand({
      UserPoolId: aws.cognito.userPoolId,
      Limit: MAX_DELETE,
    }),
  );

  if (!users.Users?.length) {
    console.log("No users found.");
    return;
  }

  console.log(
    `Deleting ${users.Users.length} user(s) (maximum ${MAX_DELETE}).`,
  );

  for (const user of users.Users) {
    if (!user.Username) continue;

    console.log(`Deleting ${user.Username}`);

    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: aws.cognito.userPoolId,
        Username: user.Username,
      }),
    );
  }

  console.log("Done.");
}