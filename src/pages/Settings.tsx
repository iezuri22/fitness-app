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
import { listExercises } from "../lib/db";
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
