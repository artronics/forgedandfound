import http from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.CODE_FLOW_CLIENT_ID!;
const CLIENT_SECRET = process.env.CODE_FLOW_CLIENT_SECRET!;

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error(
    "FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET environment variables are required",
  );
}

const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/`;

const authUrl =
  "https://www.facebook.com/v25.0/dialog/oauth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "public_profile,email",
  });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", REDIRECT_URI);
    const code = url.searchParams.get("code");

    if (!code) {
      res.writeHead(400);
      res.end("Missing authorization code");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Login successful. You can close this tab.");

    server.close();

    console.log("Authorization code:");
    console.log(code);

    const tokenResponse = await fetch(
      "https://graph.facebook.com/v25.0/oauth/access_token?" +
        new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          code,
        }),
    );

    const token = await tokenResponse.json();

    console.log("\nToken response:");
    console.dir(token, { depth: null });

    if (!("access_token" in token)) {
      return;
    }

    const proof = appSecretProof(token.access_token, CLIENT_SECRET);
    const meResponse = await fetch(
      "https://graph.facebook.com/v25.0/me?" +
        new URLSearchParams({
          fields: "id,email,first_name,last_name",
          access_token: token.access_token,
          appsecret_proof: proof,
        }),
    );

    const me = await meResponse.json();

    console.log("\n/me response:");
    console.dir(me, { depth: null });
  } catch (err) {
    console.error(err);
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`Listening on ${REDIRECT_URI}`);
  console.log("Opening browser...");

  const command =
    process.platform === "darwin"
      ? `open -a "/Applications/Google Chrome.app" "${authUrl}"`
      : process.platform === "win32"
        ? `start "" "${authUrl}"`
        : `xdg-open "${authUrl}"`;

  exec(command);
});


import crypto from "node:crypto";

function appSecretProof(accessToken: string, appSecret: string): string {
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
}
