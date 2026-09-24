import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDataVersion } from "../hooks/useDataVersion";
import { cacheKey } from "../lib/dbCache";
import { listWorkouts } from "../lib/db";
import {
  EmptyState,
  Group,
  PageHeader,
  PageSkeleton,
  Row,
} from "../components/ui";
import { prettyDate, todayStr } from "../lib/dates";
import type { Workout } from "../lib/types";

/**
 * Planned screen — upcoming workouts that the coach / planner has queued up
 * (status === "planned" AND date >= today). Sorted by date ascending so the
 * next day up is at the top.
 *
 * History shows things that actually happened (completed / in_progress /
 * skipped). Planned shows what's on deck.
 */
export default function Planned() {
  const { user } = useAuth();
  // Re-read when a background refresh finds newer data (see useDataVersion).
  const uid = user?.uid ?? "";
  const dataVersion = useDataVersion(cacheKey.workouts(uid));
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const all = await listWorkouts(user.uid, { limit: 60 });
      const today = todayStr();
      const upcoming = all
        .filter((w) => w.status === "planned" && w.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (alive) setWorkouts(upcoming);
    })();
    return () => {
      alive = false;
    };
  }, [user, dataVersion]);

  if (workouts === null) {
    return <PageSkeleton rows={5} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Planned" subtitle="What's on deck" />
      {workouts.length === 0 ? (
        <EmptyState
          title="Nothing planned"
          description="No upcoming workouts are queued up yet."
        />
      ) : (
        <Group>
          {workouts.map((w) => (
            <Row
              key={w.id}
              to={`/planned/${w.id}`}
              title={w.title}
              subtitle={`${prettyDate(w.date)} · ${w.plannedSets.length} sets · ${w.focus}`}
              chevron
            />
          ))}
        </Group>
      )}
    </div>
  );
}
