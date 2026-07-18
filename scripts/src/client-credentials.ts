export async function getClientCredentialsToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
) {
  const response = await fetch(
    tokenUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Token request failed: ${response.status} ${await response.text()}`,
    );
  }

  return await response.json() as Promise<{
    access_token: string;
    scope: string;
    expires_in: number;
  }>;
}