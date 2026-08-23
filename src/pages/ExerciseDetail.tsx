import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  getExerciseHistory,
  listExercises,
  updateExercise,
  deleteExercise,
  uploadExerciseGif,
  removeExerciseGif,
  type ExerciseHistoryEntry,
} from "../lib/db";
import { findGifForName } from "../lib/exerciseGifs";
import { findInstructionsForName } from "../lib/exerciseInstructions";
import type { Exercise } from "../lib/types";
import { BackLink, Button, Card, Group, PageSkeleton, Row, SectionHeader, Tag } from "../components/ui";
import ExerciseGif from "../components/ExerciseGif";
import { prettyDate } from "../lib/dates";

export default function ExerciseDetail() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [ex, setEx] = useState<Exercise | null | undefined>(undefined);
  const [history, setHistory] = useState<ExerciseHistoryEntry[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !exerciseId) return;
    let alive = true;
    (async () => {
      const all = await listExercises(user.uid);
      const found = all.find((e) => e.id === exerciseId) ?? null;
      if (!alive) return;
      setEx(found);
      const h = await getExerciseHistory(user.uid, exerciseId, 10);
      if (alive) setHistory(h);
    })();
    return () => {
      alive = false;
    };
  }, [user, exerciseId]);

  if (ex === undefined) {
    return <PageSkeleton rows={4} />;
  }
  if (ex === null) {
    return <div className="py-10 text-center text-[color:var(--color-muted)]">Not found.</div>;
  }

  async function onToggleBan() {
    if (!user || !ex) return;
    await updateExercise(user.uid, ex.id, { isBannedLatarjet: !ex.isBannedLatarjet });
    setEx({ ...ex, isBannedLatarjet: !ex.isBannedLatarjet });
  }

  async function onDelete() {
    if (!user || !ex) return;
    if (!confirm(`Delete "${ex.name}"? This doesn't remove it from past workouts.`))
      return;
    await deleteExercise(user.uid, ex.id);
    nav("/exercises", { replace: true });
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same filename later
    if (!file || !user || !ex) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadExerciseGif(user.uid, ex.id, file);
      setEx({ ...ex, gifUrl: url });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveGif() {
    if (!user || !ex) return;
    if (!confirm("Remove the uploaded GIF? The bundled fallback (if any) will return.")) return;
    setUploading(true);
    try {
      await removeExerciseGif(user.uid, ex.id);
      setEx({ ...ex, gifUrl: undefined });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  const pr = personalRecord(history);
  const hasExplicitGif = !!ex.gifUrl;
  const hasFallbackGif = !hasExplicitGif && !!findGifForName(ex.name);

  return (
    <div className="space-y-4">
      <BackLink fallback="/exercises" label="Exercises" />

      <ExerciseGif name={ex.name} gifUrl={ex.gifUrl} size="hero" />

      {/* Upload / replace GIF */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/gif,image/png,image/jpeg,image/webp"
          onChange={onFilePicked}
          className="hidden"
        />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? "Uploading…"
              : hasExplicitGif
                ? "Replace GIF"
                : hasFallbackGif
                  ? "Override with your own GIF"
                  : "Upload GIF or PNG"}
          </Button>
          {hasExplicitGif && (
            <Button variant="secondary" onClick={onRemoveGif} disabled={uploading}>
              Remove
            </Button>
          )}
        </div>
        {!hasExplicitGif && !hasFallbackGif && (
          <div className="text-[13px] leading-snug text-[color:var(--color-muted)]">
            No demo for this exercise. Upload one (GIF, PNG, JPG or WebP, up to
            20MB) to show it during workouts.
          </div>
        )}
        {uploadError && (
          <Card>
            <div className="text-[15px] font-semibold text-[color:var(--color-danger)]">
              Upload failed
            </div>
            <div className="mt-1 break-words text-[13px] text-[color:var(--color-muted)]">
              {uploadError}
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">
              {ex.name}
            </h1>
            <div className="mt-0.5 text-[15px] text-[color:var(--color-muted)]">
              {ex.category}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 pt-1.5">
            {ex.isPT && <Tag variant="info">PT</Tag>}
            {ex.isBannedLatarjet && <Tag variant="danger">Banned</Tag>}
          </div>
        </div>
        {ex.equipment.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ex.equipment.map((eq) => (
              <Tag key={eq}>{eq}</Tag>
            ))}
          </div>
        )}
        {ex.notes ? (
          <div className="text-[15px] leading-snug text-[color:var(--color-muted)]">{ex.notes}</div>
        ) : (
          (() => {
            const cues = findInstructionsForName(ex.name);
            if (!cues) return null;
            return (
              <div>
                <div className="mb-1 text-[15px] font-semibold tracking-[-0.01em]">
                  How to do it
                </div>
                <div className="text-[15px] leading-snug text-[color:var(--color-muted)]">
                  {cues}
                </div>
              </div>
            );
          })()
        )}
      </div>

      {pr && (
        <Card>
          <div className="text-[13px] text-[color:var(--color-muted)]">Personal best</div>
          <div className="mt-1 text-[28px] font-semibold tnum tracking-[-0.02em]">
            {pr.actualReps}
            <span className="ml-1 text-[17px] font-normal text-[color:var(--color-muted)]">
              reps
            </span>
            {pr.actualWeight ? (
              <>
                <span className="mx-1.5 text-[color:var(--color-muted-2)]">·</span>
                {pr.actualWeight}
                <span className="ml-1 text-[17px] font-normal text-[color:var(--color-muted)]">
                  lb
                </span>
              </>
            ) : null}
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-muted-2)]">
            {prettyDate(pr.date)}
          </div>
        </Card>
      )}

      <section>
        <SectionHeader title="Recent history" />
        {history === null ? (
          <div className="text-[15px] text-[color:var(--color-muted)]">Loading…</div>
        ) : history.length === 0 ? (
          <div className="text-[15px] text-[color:var(--color-muted)]">
            No completed sets yet.
          </div>
        ) : (
          <Group>
            {history.map((h, i) => (
              <Row
                key={i}
                to={`/history/${h.workoutId}`}
                title={h.workoutTitle}
                subtitle={
                  h.userNotes
                    ? `${prettyDate(h.date)} · "${h.userNotes.slice(0, 30)}${
                        h.userNotes.length > 30 ? "…" : ""
                      }"`
                    : prettyDate(h.date)
                }
                value={`${h.actualReps ?? 0}${
                  h.actualWeight ? ` @ ${h.actualWeight} lb` : ""
                }`}
              />
            ))}
          </Group>
        )}
      </section>

      <Group className="!mt-7">
        <Row
          title={
            ex.isBannedLatarjet
              ? "Unflag as shoulder-unsafe"
              : "Flag as shoulder-unsafe"
          }
          onClick={onToggleBan}
        />
        <Row title="Delete exercise" onClick={onDelete} destructive />
      </Group>
    </div>
  );
}

function personalRecord(history: ExerciseHistoryEntry[] | null): ExerciseHistoryEntry | null {
  if (!history || history.length === 0) return null;
  // Best = highest weight, then highest reps.
  let best = history[0];
  for (const h of history) {
    const bw = best.actualWeight ?? 0;
    const hw = h.actualWeight ?? 0;
    if (hw > bw) best = h;
    else if (hw === bw && (h.actualReps ?? 0) > (best.actualReps ?? 0)) best = h;
  }
  return best;
}
