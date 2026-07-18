"use client";

import React, {useState} from "react";
import {useRouter} from "next/navigation";
import {signOut} from "next-auth/react";
import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {Section} from "./Section";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);

    try {
      const res = await fetch("/api/auth/delete-account", {method: "POST"});
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "We couldn't delete your account. Please try again.");
        return;
      }
      // The server already cleared the session cookie; this updates
      // useSession() everywhere so the UI reflects it immediately.
      await signOut({redirect: false});
      router.push("/");
      router.refresh();
    } catch {
      setError("We couldn't delete your account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Section
      title="Delete account"
      description="Permanently delete your account and all associated data. This cannot be undone."
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="self-start">
            Delete account
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-surface-container">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your account and personal data will be permanently deleted,
              including your saved details and preferences. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
