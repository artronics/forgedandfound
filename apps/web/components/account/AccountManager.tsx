"use client";

import React, {useState} from "react";
import {useRouter} from "next/navigation";
import {signOut} from "next-auth/react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Separator} from "@/components/ui/separator";
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
type Initial = {
  /** Single display name — the profile UI deliberately doesn't split first/last. */
  name: string;
  /** Empty when the user has no real email of their own (synthetic or relay). */
  email: string;
};

/** An address as returned by the account API (with its Shopify id). */
type StoredAddress = {
  id: string;
  firstName?: string;
  lastName?: string;
  line1: string;
  line2?: string;
  city: string;
  province?: string;
  postalCode: string;
  country: string;
  phone?: string;
};

export default function AccountManager({initial}: { initial: Initial }) {
  return (
    <div className="flex flex-col gap-10">
      <ProfileSection initial={initial}/>
      <Separator/>
      <EmailSection initial={initial}/>
      <Separator/>
      <AddressSection/>
      <Separator/>
      <PasswordSection/>
      <Separator/>
      <DangerSection/>
    </div>
  );
}

/**
 * `initial.email` is already blank when the address is synthetic or a relay —
 * the server decides that from `custom:email_placeholder`, so there's no address
 * pattern-matching here.
 */
function hasUsableEmail(email?: string | null): boolean {
  return !!email;
}

// ─── Section shell ──────────────────────────────────────────────────────────

function Section({title, description, children}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-xl tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({id, label, ...props}: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  );
}

// ─── Profile (change name) ──────────────────────────────────────────────────

function ProfileSection({initial}: { initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty = name !== initial.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({name}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update your name.");
        setStatus("idle");
        return;
      }
      setStatus("saved");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <Section title="Profile" description="Update the name shown on your account and orders.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field
          id="acc-name"
          label="Name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStatus("idle");
          }}
          placeholder="Jane Smith"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || status === "saving"}>
            {status === "saving" ? "Saving…" : "Save changes"}
          </Button>
          {status === "saved" && !dirty && (
            <span className="text-xs text-muted-foreground">Saved.</span>
          )}
        </div>
      </form>
    </Section>
  );
}

// ─── Email (add / verify) ───────────────────────────────────────────────────

function EmailSection({initial}: { initial: Initial }) {
  if (hasUsableEmail(initial.email)) {
    return (
      <Section title="Email" description="The email used for sign-in and order updates.">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">{initial.email}</span>
          <p className="text-xs text-muted-foreground">Changing your email is coming soon.</p>
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="Email"
      description="Add an email and password so you can sign in with them and receive order updates."
    >
      <AddEmailForm/>
    </Section>
  );
}

function AddEmailForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          email,
          password,
          origin: window.location.origin,
          returnTo: window.location.pathname,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <p className="text-xs text-muted-foreground">
        We sent a verification link to <strong>{email}</strong>. Open it to confirm and finish adding your
        email.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field
        id="add-email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="add-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <Field
          id="add-confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div>
        <Button type="submit" disabled={loading}>
          {loading ? "Sending…" : "Add email"}
        </Button>
      </div>
    </form>
  );
}

// ─── Addresses ──────────────────────────────────────────────────────────────

function AddressSection() {
  const empty = {
    firstName: "",
    lastName: "",
    line1: "",
    line2: "",
    city: "",
    province: "",
    postalCode: "",
    country: "",
    phone: "",
  };
  const [form, setForm] = useState(empty);
  const [addresses, setAddresses] = useState<StoredAddress[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({...f, [key]: e.target.value}));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save your address.");
        return;
      }
      setAddresses((prev) => [...prev, data.address]);
      setForm(empty);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Addresses" description="Add a delivery address to speed up checkout.">
      {addresses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="bg-surface-container p-3 text-xs leading-relaxed text-muted-foreground"
            >
              <span className="text-foreground">
                {[a.firstName, a.lastName].filter(Boolean).join(" ")}
              </span>
              <br/>
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              <br/>
              {[a.city, a.province, a.postalCode].filter(Boolean).join(", ")}
              <br/>
              {a.country}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field id="addr-first" label="First name" autoComplete="given-name"
                 value={form.firstName} onChange={set("firstName")} placeholder="Jane"/>
          <Field id="addr-last" label="Last name" autoComplete="family-name"
                 value={form.lastName} onChange={set("lastName")} placeholder="Smith"/>
        </div>
        <Field id="addr-line1" label="Address" autoComplete="address-line1" required
               value={form.line1} onChange={set("line1")} placeholder="123 Forge Lane"/>
        <Field id="addr-line2" label="Apartment, suite, etc. (optional)" autoComplete="address-line2"
               value={form.line2} onChange={set("line2")} placeholder=""/>
        <div className="grid grid-cols-2 gap-3">
          <Field id="addr-city" label="City" autoComplete="address-level2" required
                 value={form.city} onChange={set("city")} placeholder="London"/>
          <Field id="addr-province" label="County / State" autoComplete="address-level1"
                 value={form.province} onChange={set("province")} placeholder="Greater London"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="addr-postal" label="Postal code" autoComplete="postal-code" required
                 value={form.postalCode} onChange={set("postalCode")} placeholder="EC1A 1BB"/>
          <Field id="addr-country" label="Country" autoComplete="country-name" required
                 value={form.country} onChange={set("country")} placeholder="United Kingdom"/>
        </div>
        <Field id="addr-phone" label="Phone (optional)" type="tel" autoComplete="tel"
               value={form.phone} onChange={set("phone")} placeholder="+44 20 7946 0000"/>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add address"}
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ─── Password reset ─────────────────────────────────────────────────────────

function PasswordSection() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleReset = async () => {
    setState("sending");
    try {
      const res = await fetch("/api/account/password", {method: "POST"});
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <Section
      title="Password"
      description="We'll email you a secure link to choose a new password."
    >
      {state === "sent" ? (
        <p className="text-xs text-muted-foreground">
          Reset link sent. Check your inbox to finish setting a new password.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div>
            <Button variant="outline" onClick={handleReset} disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Reset password"}
            </Button>
          </div>
          {state === "error" && (
            <p className="text-xs text-destructive">Couldn&apos;t send the link. Please try again.</p>
          )}
        </div>
      )}
    </Section>
  );
}

// ─── Danger zone (delete account) ───────────────────────────────────────────

function DangerSection() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {method: "POST"});
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete your account.");
        setDeleting(false);
        return;
      }
      // Account gone — clear the session and send them home.
      await signOut({redirect: false});
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <Section
      title="Delete account"
      description="Permanently remove your account and all associated data. This cannot be undone."
    >
      <Dialog>
        <DialogTrigger asChild>
          <div>
            <Button variant="destructive">Delete my account</Button>
          </div>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and cannot be undone. Type{" "}
              <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || deleting}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
