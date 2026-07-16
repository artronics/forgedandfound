import React, {useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import {signIn} from "next-auth/react";
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {cn} from "@/lib/utils";
import {SlideDeck} from "@/components/auth/SlideDeck";
import {LoginButton} from "@/components/auth/LoginButton";

type Tab = "signin" | "register";
type View = "auth" | "forgot";

type LoginFormProps = {
  className?: string;
  onSuccess?: () => void;
};

export default function LoginForm({className, onSuccess}: LoginFormProps) {
  const [tab, setTab] = useState<Tab>("signin");
  const [view, setView] = useState<View>("auth");

  return (
    <Card className={cn("mx-auto bg-surface-container px-4", className)}>
      <SlideDeck index={view === "auth" ? 0 : 1}>
        {/* Panel 0 — sign in / create account */}
        <div>
          <CardHeader className="px-0 pt-8 pb-0">
            <CardTitle className="text-center pb-4">Sign in or create an account</CardTitle>
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setTab("signin")}
                className={cn(
                  "flex-1 py-2 text-xs uppercase tracking-wider transition-colors",
                  tab === "signin"
                    ? "border-b-2 border-foreground font-semibold text-foreground -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setTab("register")}
                className={cn(
                  "flex-1 py-2 text-xs uppercase tracking-wider transition-colors",
                  tab === "register"
                    ? "border-b-2 border-foreground font-semibold text-foreground -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Create Account
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pt-6 pb-4">
            {tab === "signin" ? (
              <SignInForm onSuccess={onSuccess} onForgot={() => setView("forgot")}/>
            ) : (
              <RegisterForm onSuccess={onSuccess}/>
            )}
          </CardContent>
        </div>

        {/* Panel 1 — forgot password */}
        <div>
          <CardHeader className="px-0 pt-8 pb-0">
            <CardTitle className="text-center pb-4">Reset your password</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pt-6 pb-4">
            <ForgotPasswordForm onBack={() => setView("auth")}/>
          </CardContent>
        </div>
      </SlideDeck>
      <CardFooter className="px-8 pb-8 justify-center text-center">
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link href="/app/(store)/pages/return-policy" className="underline hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/app/(store)/pages/privacy-policy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}

function SignInForm({onSuccess, onForgot}: { onSuccess?: () => void; onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const currentPath = usePathname();

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        const emailNotVerified = res.code === "EmailNotVerified";
        setUnverified(emailNotVerified);
        setError(
          emailNotVerified
            ? "Please verify your email before signing in."
            : "Invalid email or password.",
        );
        return;
      }

      const returnTo = currentPath.endsWith("account/login") ? "/" : currentPath;
      onSuccess?.();
      router.push(returnTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signin-email" className="text-xs uppercase tracking-wider text-muted-foreground">
            Email
          </label>
          <Input
            id="signin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signin-password" className="text-xs uppercase tracking-wider text-muted-foreground">
            Password
          </label>
          <Input
            id="signin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={onForgot}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Forgot password?
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {unverified && <ResendVerificationButton email={email}/>}
        <LoginButton provider="email" type="submit" size="lg" className="mt-1" disabled={loading}>
          {loading ? "Signing in…" : undefined}
        </LoginButton>
      </form>
      <Divider/>
      <div className="flex flex-col gap-3">
        <LoginButton
          provider="google"
          size="lg"
          onClick={() =>
            signIn(
              "cognito",
              {callbackUrl: currentPath ?? "/account"},
              {identity_provider: "Google"},
            )
          }
        />
        <LoginButton
          provider="facebook"
          size="lg"
          onClick={() =>
            signIn(
              "cognito",
              {callbackUrl: currentPath ?? "/account"},
              {identity_provider: "Facebook"},
            )
          }
        />
        <LoginButton
          provider="apple"
          size="lg"
          onClick={() =>
            signIn(
              "cognito",
              {callbackUrl: currentPath ?? "/account"},
              {identity_provider: "SignInWithApple"},
            )
          }
        />
      </div>
    </div>
  );
}

function RegisterForm({onSuccess}: { onSuccess?: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationRequired, setConfirmationRequired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          email,
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          acceptsMarketing,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Account creation failed.");
        return;
      }

      if (data.userConfirmed) {
        onSuccess?.();
      } else {
        setConfirmationRequired(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmationRequired) {
    return (
      <div className="flex flex-col gap-4 text-center py-4">
        <p className="text-sm font-medium">Check your email</p>
        <p className="text-xs text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>. Verify your address then sign in.
        </p>
        <ResendVerificationButton email={email} className="items-center"/>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-first" className="text-xs uppercase tracking-wider text-muted-foreground">
            First name
          </label>
          <Input
            id="reg-first"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-last" className="text-xs uppercase tracking-wider text-muted-foreground">
            Last name
          </label>
          <Input
            id="reg-last"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Smith"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-email" className="text-xs uppercase tracking-wider text-muted-foreground">
          Email
        </label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-password" className="text-xs uppercase tracking-wider text-muted-foreground">
          Password
        </label>
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-confirm" className="text-xs uppercase tracking-wider text-muted-foreground">
          Confirm password
        </label>
        <Input
          id="reg-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <div className="flex items-start gap-2.5">
        <input
          id="reg-marketing"
          type="checkbox"
          checked={acceptsMarketing}
          onChange={(e) => setAcceptsMarketing(e.target.checked)}
          className="mt-0.5 accent-foreground"
        />
        <label htmlFor="reg-marketing" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
          I&apos;d like to receive news, updates, and exclusive offers via email
        </label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full mt-1" disabled={loading}>
        {loading ? "Creating account…" : "Create Account"}
      </Button>
    </form>
  );
}

function ResendVerificationButton({email, className}: { email: string; className?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const resend = async () => {
    if (!email || state === "sending" || state === "sent") return;
    setState("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({email}),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Verification link sent. Check your inbox.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={resend}
        disabled={state === "sending"}
        className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Resend verification link"}
      </button>
      {state === "error" && (
        <p className="text-xs text-destructive">Couldn&apos;t resend. Please try again.</p>
      )}
    </div>
  );
}

function ForgotPasswordForm({onBack}: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({email}),
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
      <div className="flex flex-col gap-4 text-center py-2">
        <p className="text-sm font-medium">Check your email</p>
        <p className="text-xs text-muted-foreground">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mx-auto text-xs text-muted-foreground underline hover:text-foreground"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="text-xs uppercase tracking-wider text-muted-foreground">
          Email
        </label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full mt-1" disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="mx-auto mt-1 text-xs text-muted-foreground underline hover:text-foreground"
      >
        Back to sign in
      </button>
    </form>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-border"/>
      <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
      <div className="flex-1 border-t border-border"/>
    </div>
  );
}
