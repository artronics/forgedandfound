"use server";

import {signIn, signOut as authSignOut} from "@/auth";
import {redirect} from "next/navigation";
import {account, app} from "@/lib/env";

export async function signInWithCognito() {
  await signIn("cognito");
}

export async function signOutWithCognito() {
  await authSignOut({redirect: false});

  const logoutUrl =
    account.url + "/logout" +
    `?client_id=${process.env.AUTH_COGNITO_ID}` +
    `&logout_uri=${encodeURIComponent(app.url)}`;

  redirect(logoutUrl);
}