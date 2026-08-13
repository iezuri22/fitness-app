import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button, Input } from "../components/ui";

export default function Signup() {
  const { signUp, configReady } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password);
      nav("/", { replace: true });
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? "Something went wrong.");
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
          Create your account
        </h1>
        <p className="mt-1 text-[15px] text-[color:var(--color-muted)]">
          Your data stays yours — stored in your own private Firestore subtree.
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {err && (
          <div className="text-[13px] text-[color:var(--color-danger)]">{err}</div>
        )}
        <Button type="submit" size="lg" block disabled={busy} className="!mt-5">
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="mt-6 text-center text-[15px] text-[color:var(--color-muted)]">
        Already have an account?{" "}
        <Link to="/login" className="text-[color:var(--color-accent)]">
          Sign in
        </Link>
      </div>
    </div>
  );
}
