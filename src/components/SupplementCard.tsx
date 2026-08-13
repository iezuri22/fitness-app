import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  getSupplementLog,
  getSupplements,
  listSupplementLogs,
  saveSupplementLog,
  type SupplementItem,
} from "../lib/db";
import { Card, Group, Row, SectionHeader } from "../components/ui";
import { todayStr } from "../lib/dates";

/**
 * Daily supplement checklist for Today.
 *
 * Ticking writes immediately and optimistically — the whole interaction is one
 * tap standing in a kitchen, so it must not wait on a round trip. Renders
 * nothing at all until the user has defined items, rather than nagging with an
 * empty card.
 */
export default function SupplementCard() {
  const { user } = useAuth();
  const [items, setItems] = useState<SupplementItem[] | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [history, setHistory] = useState<Record<string, string[]>>({});

  const today = todayStr();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [defs, log, hist] = await Promise.all([
        getSupplements(user.uid),
        getSupplementLog(user.uid, today),
        listSupplementLogs(user.uid, daysAgoStr(30), today),
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

  // Consecutive days back from today where every item was ticked. Today only
  // counts once it's complete, so the number never overstates the run — but an
  // incomplete today doesn't break a streak that's still live.
  const streak = useMemo(() => {
    if (!items || items.length === 0) return 0;
    const ids = items.map((i) => i.id);
    const complete = (d: string) => {
      const log = d === today ? taken : history[d] ?? [];
      return ids.every((id) => log.includes(id));
    };
    let n = 0;
    let cursor = today;
    if (!complete(today)) cursor = addDaysStr(today, -1);
    while (complete(cursor) && n < 400) {
      n += 1;
      cursor = addDaysStr(cursor, -1);
    }
    return n;
  }, [items, taken, history, today]);

  // Nothing configured yet — stay out of the way.
  if (!items || items.length === 0) return null;

  const doneCount = items.filter((i) => taken.includes(i.id)).length;
  const allDone = doneCount === items.length;

  return (
    <section>
      <SectionHeader
        title="Supplements"
        action={
          <span className="text-[13px] tnum text-[color:var(--color-muted)]">
            {doneCount} of {items.length}
          </span>
        }
      />
      <Group>
        {items.map((it) => {
          const on = taken.includes(it.id);
          return (
            <Row
              key={it.id}
              onClick={() => toggle(it.id)}
              leading={<CheckCircle on={on} />}
              title={
                <span className={on ? "text-[color:var(--color-muted)]" : ""}>{it.name}</span>
              }
            />
          );
        })}
      </Group>
      {streak > 0 && (
        <p className="mt-2 text-center text-[13px] text-[color:var(--color-muted)]">
          {allDone ? "All done · " : ""}
          {streak} day{streak === 1 ? "" : "s"} in a row
        </p>
      )}
    </section>
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

/** Empty-state prompt, shown in Settings rather than on Today. */
export function SupplementSetupHint() {
  return (
    <Card>
      <div className="text-[15px] leading-snug text-[color:var(--color-muted)]">
        Add what you take — vitamin D, creatine, a protein shake — and it'll show
        up on Today as a checklist.
      </div>
      <Link
        to="/settings"
        className="mt-3 inline-block text-[15px] text-[color:var(--color-accent)]"
      >
        Set them up
      </Link>
    </Card>
  );
}

function addDaysStr(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}

function daysAgoStr(n: number): string {
  return addDaysStr(todayStr(), -n);
}
