import fs from "node:fs";
import jwt from "jsonwebtoken";

const TEAM_ID = "46P5AX565G";
const KEY_ID = "9U46V4UPKY";
const CLIENT_ID = "com.forgedandfound.co.uk.service"; // Services ID

const privateKey = fs.readFileSync(`./AuthKey_${KEY_ID}.p8`, "utf8");

const now = Math.floor(Date.now() / 1000);

const token = jwt.sign(
  {
    iss: TEAM_ID,
    iat: now,
    exp: now + 60 * 60 * 24 * 180, // 180 days
    aud: "https://appleid.apple.com",
    sub: CLIENT_ID,
  },
  privateKey,
  {
    algorithm: "ES256",
    keyid: KEY_ID,
  },
);

const info = {
  jwt: token,
  privateKeyBase64: Buffer.from(privateKey).toString("base64"),
};
console.log(info);