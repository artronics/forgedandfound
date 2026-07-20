import dotenv from "dotenv";
dotenv.config();

const SHOP = `${process.env.SHOPIFY_STORE_NAME}.myshopify.com`;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

async function getAccessToken(client_id = CLIENT_ID, client_secret = CLIENT_SECRET) {
  console.log(client_id);
  const response = await fetch(
    `https://${SHOP}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: client_id,
        client_secret: client_secret,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Token request failed: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();

  console.log(data);
  console.log("Access Token:", data.access_token);
  console.log("Scopes:", data.scope);
  console.log("Expires In:", data.expires_in);

  return data.access_token;
}

getAccessToken().catch(console.error);
