import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listWorkouts } from "../lib/db";
import {
  EmptyState,
  Group,
  PageHeader,
  PageSkeleton,
  Row,
  SectionHeader,
  Tag,
} from "../components/ui";
import { prettyDate } from "../lib/dates";
import type { Workout } from "../lib/types";

export default function History() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const ws = await listWorkouts(user.uid, { limit: 60 });
      // History = things that actually happened. Planned/upcoming workouts live
      // on the Planned tab. "skipped" stays so missed workouts still show up.
      const past = ws.filter((w) => w.status !== "planned");
      if (alive) setWorkouts(past);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  // Grouped by month so a long log stays scannable — you look for "that week
  // in August", not for row 34.
  const months = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of workouts ?? []) {
      const key = w.date.slice(0, 7); // YYYY-MM
      const list = map.get(key);
      if (list) list.push(w);
      else map.set(key, [w]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [workouts]);

  if (workouts === null) return <PageSkeleton rows={6} />;

  const completedCount = workouts.filter((w) => w.status === "completed").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="History"
        subtitle={
          workouts.length === 0
            ? "Your training log"
            : `${completedCount} completed workout${completedCount === 1 ? "" : "s"}`
        }
      />

      {workouts.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          description="Once you finish a workout, it'll show up here."
        />
      ) : (
        months.map(([key, list]) => (
          <section key={key}>
            <SectionHeader title={monthLabel(key)} />
            <Group>
              {list.map((w) => {
                const done = completedSets(w);
                const total = w.plannedSets.length;
                return (
                  <Row
                    key={w.id}
                    to={`/history/${w.id}`}
                    title={w.title}
                    subtitle={`${prettyDate(w.date)} · ${done} of ${total} sets`}
                    trailing={
                      // "Done" is the expected outcome — only label the others.
                      w.status === "completed" ? undefined : <StatusTag status={w.status} />
                    }
                    chevron
                  />
                );
              })}
            </Group>
          </section>
        ))
      )}
    </div>
  );
}

function StatusTag({ status }: { status: Workout["status"] }) {
  if (status === "in_progress") return <Tag variant="warn">In progress</Tag>;
  if (status === "skipped") return <Tag variant="danger">Skipped</Tag>;
  return <Tag>Planned</Tag>;
}

/** "2026-08" → "August 2026", or just "August" within the current year. */
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const sameYear = y === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function completedSets(w: Workout): number {
  return w.plannedSets.filter((s) => s.completedAt).length;
}
