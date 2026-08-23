import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { deleteWorkout, getWorkout, listExercises, saveWorkout } from "../lib/db";
import type { Exercise, PlannedSet, Workout } from "../lib/types";
import { BackLink, Button, Card, Group, PageHeader, PageSkeleton, Row } from "../components/ui";
import { prettyDate } from "../lib/dates";
import PlanEditor from "../components/PlanEditor";

export default function WorkoutDetail() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!user || !workoutId) return;
    let alive = true;
    (async () => {
      const [w, list] = await Promise.all([
        getWorkout(user.uid, workoutId),
        listExercises(user.uid),
      ]);
      if (!alive) return;
      setWorkout(w);
      setExercises(list);
    })();
    return () => {
      alive = false;
    };
  }, [user, workoutId]);

  if (workout === undefined) {
    return <PageSkeleton rows={4} />;
  }
  if (workout === null) {
    return <div className="py-10 text-center text-[color:var(--color-muted)]">Not found.</div>;
  }

  // Only planned (not in-progress/completed) sets are freely editable in this view.
  // Planned workouts are freely editable; anything started or finished is a
  // record, so it's read-only here.
  const isEditable = workout.status === "planned";
  // Where the user actually came from wins over a guess based on status —
  // opening a Friday workout from Plan and being returned to Today is
  // disorienting. Falls back to a status-based guess for direct links.
  const from = searchParams.get("from");
  const [backTo, backLabel] = from
    ? ([from, from === "/plan" ? "Plan" : from === "/" ? "Today" : "Back"] as const)
    : workout.status === "planned"
    // Deliberately Today, not the /planned list — that page has no inbound
    // links anywhere in the app, so sending someone there is a dead end.
    ? (["/", "Today"] as const)
    : workout.status === "in_progress"
    ? (["/", "Today"] as const)
    : (["/history", "History"] as const);

  async function onDelete() {
    if (!user || !workout) return;
    await deleteWorkout(user.uid, workout.id);
    // Deleting can't just pop: the entry we'd return to may be this same
    // workout further down the stack. Replace with a real destination.
    nav(backTo, { replace: true });
  }

  // PlanEditor calls this with the full next sets array. We do optimistic local
  // update + firestore write.
  async function handlePlanChange(nextSets: PlannedSet[]) {
    if (!user || !workout) return;
    setWorkout({ ...workout, plannedSets: nextSets });
    await saveWorkout(user.uid, workout.id, { plannedSets: nextSets });
  }

  return (
    <div className="space-y-4">
      <BackLink fallback={backTo} label={backLabel} />

      <PageHeader
        title={workout.title}
        subtitle={`${prettyDate(workout.date)} · ${workout.focus}`}
      />

      {/* AMRAP score — the whole record for this session is the round count. */}
      {workout.format === "amrap" && typeof workout.roundsCompleted === "number" && (
        <Card className="text-center">
          <div className="text-[13px] text-[color:var(--color-muted)]">
            {workout.capMinutes ?? 20} min · rounds completed
          </div>
          <div className="mt-1 text-[56px] font-semibold leading-none tnum tracking-[-0.03em]">
            {workout.roundsCompleted}
          </div>
          <div className="mt-1.5 text-[15px] text-[color:var(--color-muted)]">
            rounds{workout.extraReps ? ` + ${workout.extraReps} reps` : ""}
          </div>
        </Card>
      )}

      {workout.format === "amrap" && workout.status !== "completed" && (
        <Card>
          <div className="text-[16px] tracking-[-0.01em]">
            {workout.capMinutes ?? 20} min · as many rounds as possible
          </div>
          <p className="mt-1.5 text-[15px] leading-snug text-[color:var(--color-muted)]">
            The exercises below are one round. Repeat them until the clock runs
            out; your score is how many rounds you finish.
          </p>
        </Card>
      )}

      {workout.format === "flow" && workout.status !== "completed" && (
        <Card>
          <div className="text-[16px] tracking-[-0.01em]">
            {workout.capMinutes ?? 5} min guided flow
          </div>
          <p className="mt-1.5 text-[15px] leading-snug text-[color:var(--color-muted)]">
            Each hold is timed and advances on its own. Start it and follow along
            — nothing to tap between stretches.
          </p>
        </Card>
      )}

      {workout.status !== "completed" && (
        <Button
          size="lg"
          block
          onClick={() =>
            nav(
              workout.status === "planned"
                ? `/workout/${workout.id}/review?from=${encodeURIComponent(backTo)}`
                : `/workout/${workout.id}?from=${encodeURIComponent(backTo)}`
            )
          }
        >
          {workout.status === "in_progress" ? "Resume workout" : "Start workout"}
        </Button>
      )}

      <PlanEditor
        workout={workout}
        exercises={exercises}
        editable={isEditable}
        onChange={handlePlanChange}
      />

      <div className="pt-3">
        {!confirmDelete ? (
          <Group>
            <Row title="Delete workout" onClick={() => setConfirmDelete(true)} destructive />
          </Group>
        ) : (
          <Card>
            <div className="text-[17px] font-semibold tracking-[-0.01em]">
              Delete this workout?
            </div>
            <div className="mt-1 text-[15px] text-[color:var(--color-muted)]">
              This can't be undone.
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={onDelete}>
                Delete
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
