import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button, Input } from "../components/ui";

export default function Login() {
  const { signIn, configReady } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signIn(email, password);
      nav("/", { replace: true });
    } catch (e: unknown) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-in mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 pb-10">
      <div className="mb-8">
        <img
          src="/favicon.svg"
          alt=""
          aria-hidden="true"
          className="mb-5 size-12 rounded-[12px]"
        />
        <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-[15px] text-[color:var(--color-muted)]">
          Sign in to log your workouts.
        </p>
      </div>

      {!configReady && (
        <div className="mb-4 rounded-[12px] bg-[color:var(--color-warn)]/12 p-3 text-[13px] text-[color:var(--color-warn)]">
          Firebase config missing. See <code>.env.example</code>.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && (
          <div className="text-[13px] text-[color:var(--color-danger)]">{err}</div>
        )}
        <Button type="submit" size="lg" block disabled={busy} className="!mt-5">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 text-center text-[15px] text-[color:var(--color-muted)]">
        Don't have an account?{" "}
        <Link to="/signup" className="text-[color:var(--color-accent)]">
          Sign up
        </Link>
      </div>
    </div>
  );
}

function friendly(e: unknown): string {
  const msg = (e as { code?: string; message?: string })?.code ?? "";
  if (msg.includes("invalid-credential")) return "Wrong email or password.";
  if (msg.includes("user-not-found")) return "No account found with that email.";
  if (msg.includes("wrong-password")) return "Wrong password.";
  if (msg.includes("too-many-requests"))
    return "Too many attempts. Try again in a minute.";
  return (e as { message?: string })?.message ?? "Something went wrong.";
}
