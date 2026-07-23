"use client";

import React from "react";
import {useSession} from "next-auth/react";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import {useLoginSheet} from "@/lib/auth/useLoginSheet";
import {useAccountMe} from "@/lib/account/useAccountMe";
import {ProfileSection} from "./ProfileSection";
import {EmailSection} from "./EmailSection";
import {PasswordSection} from "./PasswordSection";
import {MarketingSection} from "./MarketingSection";
import {DeleteAccountSection} from "./DeleteAccountSection";

export default function AccountSettings() {
  const {status, update} = useSession();
  const {me, loading, error, refetch} = useAccountMe();
  const {setOpen} = useLoginSheet();

  if (status === "unauthenticated") {
    return (
      <div className="w-full bg-secondary text-center py-4">
        <div className="text-secondary-foreground">
          Please{" "}
          <button
            onClick={() => setOpen(true)}
            className="cursor-pointer underline underline-offset-4"
          >
            sign in
          </button>{" "}
          to manage your account.
        </div>
      </div>
    );
  }

  if (loading || status === "loading") {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-48 w-full"/>
        <Skeleton className="h-40 w-full"/>
        <Skeleton className="h-32 w-full"/>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">We couldn&apos;t load your account. Please try again.</p>
        <Button onClick={() => void refetch()}>Retry</Button>
      </div>
    );
  }

  // After a change lands: force the session to re-read the fresh Cognito
  // claims (name/email would otherwise stay stale for up to an hour), then
  // pull the updated profile back into the page.
  const handleSaved = async () => {
    await update();
    await refetch();
  };

  // A social sign-up with no real email (placeholder) has nothing to email, so a
  // marketing toggle is meaningless — keep their page to just what applies.
  const emailPlaceholder = me.isSocial && !me.email;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <ProfileSection me={me} onSaved={handleSaved}/>
      <EmailSection me={me} onSaved={handleSaved}/>
      <PasswordSection me={me}/>
      {!emailPlaceholder && <MarketingSection me={me} onSaved={handleSaved}/>}
      <DeleteAccountSection/>
    </div>
  );
}
