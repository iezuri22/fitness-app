import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute() {
  const { user, loading, configReady } = useAuth();
  const location = useLocation();

  if (!configReady) {
    return <ConfigMissing />;
  }

  if (loading) {
    // Branded splash while Firebase restores the session — beats a text flash.
    return (
      <div className="min-h-full grid place-items-center">
        <img
          src="/favicon.svg"
          alt="Lift"
          className="animate-shimmer size-14 rounded-[14px]"
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

function ConfigMissing() {
  return (
    <div className="min-h-full max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Firebase config missing</h1>
      <p className="text-[color:var(--color-muted)]">
        This app needs a Firebase project. Create one at{" "}
        <a href="https://console.firebase.google.com" className="underline">
          console.firebase.google.com
        </a>
        , then copy <code>.env.example</code> to <code>.env.local</code> and fill in the values.
      </p>
      <ol className="list-decimal pl-5 space-y-1 text-sm text-[color:var(--color-muted)]">
        <li>Create a new Firebase project.</li>
        <li>Enable Authentication → Sign-in method → Email/Password.</li>
        <li>Create a Firestore database (Production mode).</li>
        <li>Add a Web app — copy the config.</li>
        <li>Paste values into <code>.env.local</code> and restart <code>npm run dev</code>.</li>
      </ol>
    </div>
  );
}
