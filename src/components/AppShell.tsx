import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useOnboardingCheck } from "../hooks/useOnboardingCheck";
import { useBackfillGifs } from "../hooks/useBackfillGifs";
import { PageSkeleton } from "./ui";

/**
 * App chrome: a translucent top bar and an iOS tab bar.
 *
 * The tab bar is deliberately plain — icon over label, accent tint when
 * active, nothing else. No pill backgrounds, no scale transforms; those read
 * as decoration and they fight the content for attention.
 */

const TABS: Array<{
  to: string;
  end?: boolean;
  label: string;
  Icon: (props: { filled: boolean }) => React.ReactNode;
}> = [
  { to: "/", end: true, label: "Today", Icon: TodayIcon },
  { to: "/plan", label: "Plan", Icon: PlanIcon },
  { to: "/library", label: "Routines", Icon: RoutinesIcon },
  { to: "/exercises", label: "Exercises", Icon: ExercisesIcon },
  { to: "/vitamins", label: "Vitamins", Icon: VitaminsIcon },
];

export default function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const { needsOnboarding } = useOnboardingCheck();
  useBackfillGifs();

  if (needsOnboarding === null) {
    return (
      <div className="mx-auto min-h-full max-w-xl px-4 pt-16">
        <PageSkeleton />
      </div>
    );
  }
  if (needsOnboarding) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div
      className="mx-auto flex min-h-full max-w-xl flex-col"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom))" }}
    >
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b border-[color:var(--color-separator)] bg-[color:var(--color-bg)]/80 px-4 pb-2.5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <div className="text-[17px] font-semibold tracking-[-0.01em]">Lift</div>
        <NavLink
          to="/settings"
          aria-label="Settings"
          title={user?.email ?? "Settings"}
          className={({ isActive }) =>
            `grid size-8 place-items-center rounded-full transition-colors ${
              isActive
                ? "text-[color:var(--color-accent)]"
                : "text-[color:var(--color-muted)] active:opacity-60"
            }`
          }
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </NavLink>
      </header>

      {/* Keyed by path so each tab switch cross-fades rather than snapping. */}
      <main key={location.pathname} className="animate-fade-in flex-1 px-4 pb-8 pt-4">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--color-separator)] bg-[color:var(--color-bg)]/80 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-xl">
          {TABS.map(({ to, end, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-[3px] pb-1.5 pt-2 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-[color:var(--color-accent)]"
                    : "text-[color:var(--color-muted-2)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon filled={isActive} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* Tab icons: 1.7px outline when idle, solid when active — the iOS treatment.
   Drawn on a 24px grid at 25px so they optically match SF Symbols weight. */

const S = { width: 25, height: 25, viewBox: "0 0 24 24" } as const;
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function TodayIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg {...S} fill="currentColor">
        <path d="M17 2a1 1 0 0 1 1 1v1h1a3 3 0 0 1 3 3v1H2V7a3 3 0 0 1 3-3h1V3a1 1 0 1 1 2 0v1h8V3a1 1 0 0 1 1-1zM2 9h20v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9zm5 3a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 7 12zm5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5z" />
      </svg>
    );
  }
  return (
    <svg {...S} {...stroke}>
      <rect x="2.75" y="4.75" width="18.5" height="16.5" rx="3" />
      <line x1="2.75" y1="9.25" x2="21.25" y2="9.25" />
      <line x1="7.5" y1="2.75" x2="7.5" y2="5.5" />
      <line x1="16.5" y1="2.75" x2="16.5" y2="5.5" />
    </svg>
  );
}

function PlanIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg {...S} fill="currentColor">
        <path d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm1 5a1 1 0 0 0 0 2h5a1 1 0 1 0 0-2H8zm0 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H8z" />
      </svg>
    );
  }
  return (
    <svg {...S} {...stroke}>
      <rect x="4.75" y="2.75" width="14.5" height="18.5" rx="3" />
      <line x1="8.25" y1="8" x2="13.5" y2="8" />
      <line x1="8.25" y1="12" x2="15.75" y2="12" />
      <line x1="8.25" y1="16" x2="14" y2="16" />
    </svg>
  );
}

function RoutinesIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg {...S} fill="currentColor">
        <rect x="2" y="3" width="6.5" height="18" rx="2" />
        <rect x="9.75" y="3" width="4.5" height="18" rx="1.75" />
        <path d="M17.4 3.6l3.1.83a1.75 1.75 0 0 1 1.24 2.14l-3.63 13.55a1.75 1.75 0 0 1-2.14 1.24l-1.2-.32 2.63-17.44z" />
      </svg>
    );
  }
  return (
    <svg {...S} {...stroke}>
      <rect x="2.75" y="3.75" width="5.5" height="16.5" rx="2" />
      <rect x="10" y="3.75" width="4" height="16.5" rx="1.75" />
      <path d="M17.1 4.4l2.6.7a1.75 1.75 0 0 1 1.24 2.14l-3.2 11.95a1.75 1.75 0 0 1-2.15 1.24l-.9-.24" />
    </svg>
  );
}

function ExercisesIcon({ filled }: { filled: boolean }) {
  // A dumbbell reads instantly at tab size; a book or grid does not.
  if (filled) {
    return (
      <svg {...S} fill="currentColor">
        <path d="M4.5 8.5a1.75 1.75 0 0 1 1.75 1.75v3.5a1.75 1.75 0 1 1-3.5 0v-3.5A1.75 1.75 0 0 1 4.5 8.5zm15 0a1.75 1.75 0 0 1 1.75 1.75v3.5a1.75 1.75 0 1 1-3.5 0v-3.5A1.75 1.75 0 0 1 19.5 8.5zM8 7a1.75 1.75 0 0 1 1.75 1.75V11h4.5V8.75a1.75 1.75 0 1 1 3.5 0v6.5a1.75 1.75 0 1 1-3.5 0V13h-4.5v2.25a1.75 1.75 0 1 1-3.5 0v-6.5A1.75 1.75 0 0 1 8 7z" />
      </svg>
    );
  }
  return (
    <svg {...S} {...stroke}>
      <path d="M9.5 12h5" />
      <rect x="6.25" y="7.75" width="3.25" height="8.5" rx="1.5" />
      <rect x="14.5" y="7.75" width="3.25" height="8.5" rx="1.5" />
      <path d="M3.5 10v4M20.5 10v4" />
    </svg>
  );
}

function VitaminsIcon({ filled }: { filled: boolean }) {
  // A capsule reads as "supplement" far faster than a pill-bottle silhouette
  // at 25px.
  if (filled) {
    return (
      <svg {...S} fill="currentColor">
        <path d="M6.3 6.3a4.7 4.7 0 0 1 6.65 0l4.75 4.75a4.7 4.7 0 1 1-6.65 6.65L6.3 12.95a4.7 4.7 0 0 1 0-6.65zm1.06 6.3l3.34 3.34 4.24-4.24-3.34-3.34-4.24 4.24z" />
      </svg>
    );
  }
  return (
    <svg {...S} {...stroke}>
      <rect x="2.6" y="7.4" width="18.8" height="9.2" rx="4.6" transform="rotate(45 12 12)" />
      <line x1="8.7" y1="8.7" x2="15.3" y2="15.3" />
    </svg>
  );
}

