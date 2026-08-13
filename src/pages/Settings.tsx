import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  Button,
  Card,
  Group,
  PageHeader,
  ProgressBar,
  Row,
  SectionHeader,
} from "../components/ui";
import { buildDateLabel, forceRefresh } from "../lib/appUpdate";
import {
  getSupplements,
  listExercises,
  saveSupplements,
  type SupplementItem,
} from "../lib/db";
import {
  countCached,
  demoUrlsForLibrary,
  estimateBytes,
  formatBytes,
  prefetchDemos,
} from "../lib/offlineDemos";

export default function Settings() {
  const { user, logOut } = useAuth();
  const nav = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  // Offline demos — the entire exercise library, not just what's scheduled.
  const [demoUrls, setDemoUrls] = useState<string[] | null>(null);
  const [cachedCount, setCachedCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Supplement definitions. Edited locally and flushed on blur / structural
  // change, so typing a name isn't one write per keystroke.
  const [supplements, setSupplements] = useState<SupplementItem[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void getSupplements(user.uid).then((s) => {
      if (alive) setSupplements(s);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const persist = useCallback(
    (next: SupplementItem[]) => {
      setSupplements(next);
      if (user) void saveSupplements(user.uid, next);
    },
    [user]
  );

  function addItem() {
    persist([
      ...supplements,
      { id: crypto.randomUUID(), name: "", order: supplements.length },
    ]);
  }
  function renameItem(id: string, name: string) {
    setSupplements((s) => s.map((it) => (it.id === id ? { ...it, name } : it)));
  }
  function commitItems() {
    // Drop blanks on the way out so an abandoned "Add" doesn't linger on Today.
    persist(supplements.filter((it) => it.name.trim() !== ""));
  }
  function removeItem(id: string) {
    persist(supplements.filter((it) => it.id !== id));
  }
  function moveItem(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= supplements.length) return;
    const next = [...supplements];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  }

  const loadDemoState = useCallback(async () => {
    if (!user) return;
    const library = await listExercises(user.uid);
    const urls = demoUrlsForLibrary(library);
    setDemoUrls(urls);
    setCachedCount(await countCached(urls));
    setTotalBytes(await estimateBytes(urls));
  }, [user]);

  useEffect(() => {
    void loadDemoState();
  }, [loadDemoState]);

  async function saveDemosOffline() {
    if (!demoUrls?.length || saving) return;
    setSaving(true);
    setProgress({ done: 0, total: 0 });
    try {
      await prefetchDemos(demoUrls, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setCachedCount(await countCached(demoUrls));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function onRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    // forceRefresh always ends in a page reload, so there's no success state
    // to render — the spinner label just covers the gap until it happens.
    await forceRefresh();
  }

  async function onSignOut() {
    if (!confirm("Sign out of Lift?")) return;
    await logOut();
    nav("/login", { replace: true });
  }

  const allSaved = !!demoUrls && cachedCount >= demoUrls.length;

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />

      <section>
        <SectionHeader title="App" />
        <Group>
          <Row title="Version" value={buildDateLabel()} />
          <Row
            title={refreshing ? "Updating…" : "Check for updates"}
            subtitle="Reloads the app with the newest version"
            onClick={onRefresh}
            chevron
          />
        </Group>
      </section>

      <section>
        <SectionHeader title="Offline" />
        <Card>
          <div className="text-[16px] tracking-[-0.01em]">Save all demos offline</div>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-muted)]">
            Every demo in your library, so any workout works without signal —
            even one you swap to at the gym.
          </p>

          {demoUrls === null ? (
            <div className="mt-4 text-[13px] text-[color:var(--color-muted-2)]">
              Checking…
            </div>
          ) : demoUrls.length === 0 ? (
            <div className="mt-4 text-[13px] text-[color:var(--color-muted-2)]">
              No demos in your library yet — import exercises first.
            </div>
          ) : (
            <>
              <ProgressBar
                className="mt-4"
                tone={allSaved ? "success" : "accent"}
                value={progress?.total ? progress.done : cachedCount}
                max={progress?.total ? progress.total : demoUrls.length}
              />
              <div className="mt-2 text-[13px] tnum text-[color:var(--color-muted)]">
                {progress
                  ? `Saving ${progress.done} of ${progress.total}…`
                  : `${cachedCount} of ${demoUrls.length} demos saved${
                      totalBytes && !allSaved
                        ? ` · ~${formatBytes(
                            Math.round(
                              (totalBytes * (demoUrls.length - cachedCount)) /
                                demoUrls.length
                            )
                          )} to download`
                        : ""
                    }`}
              </div>
              <Button
                onClick={saveDemosOffline}
                disabled={saving || allSaved}
                variant={allSaved ? "secondary" : "primary"}
                block
                className="mt-4"
              >
                {saving ? "Saving…" : allSaved ? "All saved" : "Save for offline"}
              </Button>
            </>
          )}
        </Card>
      </section>

      <section>
        <SectionHeader
          title="Supplements"
          action={
            <button
              onClick={addItem}
              className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
            >
              Add
            </button>
          }
        />
        {supplements.length === 0 ? (
          <Card>
            <div className="text-[15px] leading-snug text-[color:var(--color-muted)]">
              Add what you take — vitamin D, creatine, a protein shake — and it'll
              show up on Today as a checklist.
            </div>
          </Card>
        ) : (
          <Group>
            {supplements.map((it, i) => (
              <Row
                key={it.id}
                title={
                  <input
                    value={it.name}
                    onChange={(e) => renameItem(it.id, e.target.value)}
                    onBlur={commitItems}
                    placeholder="Name"
                    aria-label="Supplement name"
                    className="w-full bg-transparent text-[16px] outline-none placeholder:text-[color:var(--color-muted-2)]"
                  />
                }
                trailing={
                  <span className="flex shrink-0 items-center">
                    <button
                      onClick={() => moveItem(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${it.name} up`}
                      className="grid size-9 place-items-center text-[color:var(--color-muted-2)] disabled:opacity-30"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeItem(it.id)}
                      aria-label={`Remove ${it.name}`}
                      className="grid size-9 place-items-center text-[color:var(--color-muted-2)] active:text-[color:var(--color-danger)]"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                }
              />
            ))}
          </Group>
        )}
      </section>

      <section>
        <SectionHeader title="Account" />
        <Group>
          <Row title="Signed in as" value={user?.email ?? "—"} />
          <Row title="Sign out" onClick={onSignOut} destructive />
        </Group>
      </section>

      <p className="pb-2 text-center text-[13px] text-[color:var(--color-muted-2)]">
        Lift — your private workout log.
      </p>
    </div>
  );
}
