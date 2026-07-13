"use server";

import {signOut} from "@/auth";
import {refresh} from "next/cache";

export async function signOutWithCognito(returnTo?: string) {
  await signOut({redirectTo: returnTo});
  refresh();
}