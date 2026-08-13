import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  getSupplementLog,
  getSupplements,
  listSupplementLogs,
  saveSupplementLog,
  saveSupplements,
  type SupplementItem,
} from "../lib/db";
import {
  Button,
  Card,
  EmptyState,
  Group,
  PageHeader,
  PageSkeleton,
  Row,
  SectionHeader,
} from "../components/ui";
import { todayStr } from "../lib/dates";

const HISTORY_DAYS = 14;

/**
 * Daily vitamins and supplements.
 *
 * Owns both the checklist and the list itself — an earlier version put the
 * items in Settings, which meant discovering the feature required already
 * knowing it existed. Everything lives here now, and Settings no longer
 * duplicates it.
 */
export default function Vitamins() {
  const { user } = useAuth();
  const [items, setItems] = useState<SupplementItem[] | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState(false);

  const today = todayStr();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [defs, log, hist] = await Promise.all([
        getSupplements(user.uid),
        getSupplementLog(user.uid, today),
        listSupplementLogs(user.uid, addDays(today, -(HISTORY_DAYS - 1)), today),
      ]);
      if (!alive) return;
      setItems(defs);
      setTaken(log);
      setHistory(hist);
    })();
    return () => {
      alive = false;
    };
  }, [user, today]);

  const toggle = useCallback(
    (id: string) => {
      if (!user) return;
      setTaken((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        setHistory((h) => ({ ...h, [today]: next }));
        void saveSupplementLog(user.uid, today, next);
        return next;
      });
    },
    [user, today]
  );

  const persist = useCallback(
    (next: SupplementItem[]) => {
      setItems(next);
      if (user) void saveSupplements(user.uid, next);
    },
    [user]
  );

  const days = useMemo(
    () =>
      Array.from({ length: HISTORY_DAYS }, (_, i) =>
        addDays(today, -(HISTORY_DAYS - 1 - i))
      ),
    [today]
  );

  // Consecutive complete days back from today. Today only counts once it's
  // done, but an unfinished today doesn't break a run that's still live.
  const streak = useMemo(() => {
    if (!items || items.length === 0) return 0;
    const ids = items.map((i) => i.id);
    const complete = (d: string) => {
      const log = d === today ? taken : history[d] ?? [];
      return ids.every((id) => log.includes(id));
    };
    let n = 0;
    let cursor = complete(today) ? today : addDays(today, -1);
    while (complete(cursor) && n < 400) {
      n += 1;
      cursor = addDays(cursor, -1);
    }
    return n;
  }, [items, taken, history, today]);

  if (items === null) return <PageSkeleton rows={4} />;

  const doneCount = items.filter((i) => taken.includes(i.id)).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vitamins"
        subtitle={
          items.length === 0
            ? "Daily supplements"
            : `${doneCount} of ${items.length} today`
        }
        action={
          items.length > 0 ? (
            <button
              onClick={() => setEditing((v) => !v)}
              className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
            >
              {editing ? "Done" : "Edit"}
            </button>
          ) : undefined
        }
      />

      {items.length === 0 && !editing && (
        <EmptyState
          title="Nothing to track yet"
          description="Add what you take — vitamin D, creatine, a protein shake — and tick them off each day."
          action={<Button onClick={() => setEditing(true)}>Add supplements</Button>}
        />
      )}

      {items.length > 0 && !editing && (
        <>
          <Group>
            {items.map((it) => {
              const on = taken.includes(it.id);
              return (
                <Row
                  key={it.id}
                  onClick={() => toggle(it.id)}
                  leading={<CheckCircle on={on} />}
                  title={
                    <span className={on ? "text-[color:var(--color-muted)]" : ""}>
                      {it.name}
                    </span>
                  }
                />
              );
            })}
          </Group>

          <Card>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px]">Last {HISTORY_DAYS} days</span>
              <span className="text-[13px] tnum text-[color:var(--color-muted)]">
                {streak > 0 ? `${streak} day streak` : "No streak yet"}
              </span>
            </div>
            <div className="mt-3 flex justify-between gap-1">
              {days.map((d) => {
                const log = d === today ? taken : history[d] ?? [];
                const n = items.filter((i) => log.includes(i.id)).length;
                const pct = items.length ? n / items.length : 0;
                return (
                  <div key={d} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div
                      title={`${d}: ${n} of ${items.length}`}
                      className={`h-7 w-full rounded-[4px] ${
                        pct === 1
                          ? "bg-[color:var(--color-success)]"
                          : pct > 0
                          ? "bg-[color:var(--color-success)]/40"
                          : "bg-[color:var(--color-surface-3)]"
                      } ${d === today ? "ring-1 ring-[color:var(--color-accent)]" : ""}`}
                    />
                    <span className="text-[10px] tnum text-[color:var(--color-muted-2)]">
                      {Number(d.slice(8))}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {editing && (
        <section>
          <SectionHeader
            title="Your list"
            action={
              <button
                onClick={() =>
                  persist([
                    ...items,
                    { id: crypto.randomUUID(), name: "", order: items.length },
                  ])
                }
                className="text-[15px] text-[color:var(--color-accent)] active:opacity-60"
              >
                Add
              </button>
            }
          />
          {items.length === 0 ? (
            <Card>
              <div className="text-[15px] leading-snug text-[color:var(--color-muted)]">
                Tap Add to create your first one.
              </div>
            </Card>
          ) : (
            <Group>
              {items.map((it, i) => (
                <Row
                  key={it.id}
                  title={
                    <input
                      value={it.name}
                      onChange={(e) =>
                        setItems((s) =>
                          (s ?? []).map((x) =>
                            x.id === it.id ? { ...x, name: e.target.value } : x
                          )
                        )
                      }
                      onBlur={() =>
                        persist((items ?? []).filter((x) => x.name.trim() !== ""))
                      }
                      placeholder="Name"
                      aria-label="Supplement name"
                      autoFocus={it.name === ""}
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-[color:var(--color-muted-2)]"
                    />
                  }
                  trailing={
                    <span className="flex shrink-0 items-center">
                      <button
                        onClick={() => {
                          if (i === 0) return;
                          const next = [...items];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          persist(next);
                        }}
                        disabled={i === 0}
                        aria-label={`Move ${it.name} up`}
                        className="grid size-9 place-items-center text-[color:var(--color-muted-2)] disabled:opacity-30"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        onClick={() => persist(items.filter((x) => x.id !== it.id))}
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
          {items.length > 0 && (
            <Button variant="secondary" block className="mt-3" onClick={() => setEditing(false)}>
              Done
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function CheckCircle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-[26px] shrink-0 place-items-center rounded-full transition-colors ${
        on
          ? "bg-[color:var(--color-success)] text-white"
          : "bg-[color:var(--color-surface-2)] text-transparent"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}
