import {redirect} from "next/navigation";
import {auth} from "@/auth";
import AccountManager from "@/components/account/AccountManager";

export default async function AccountMePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/account/login");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tight">Your account</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage your details, addresses and security.
        </p>
      </header>
      <AccountManager
        initial={{
          name: session.user.name ?? "",
          // A synthetic/relay address isn't one the user owns — show no email and
          // let them add a real one.
          email: session.emailPlaceholder ? "" : (session.user.email ?? ""),
        }}
      />
    </div>
  );
}
