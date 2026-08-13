import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { listTemplates, listWorkoutsInRange, startWorkoutFromTemplate } from "../lib/db";
import {
  Button,
  Card,
  Group,
  PageHeader,
  PageSkeleton,
  Row,
  SectionHeader,
  Segmented,
} from "../components/ui";
import { BODY_PARTS, type BodyPart } from "../lib/generateWorkout";
import { joinParts, recommend, type Suggestion } from "../lib/recommend";
import { formatMinutes } from "../lib/timeEstimate";
import { todayStr } from "../lib/dates";
import type { WorkoutTemplate } from "../lib/types";

type TimeKey = "any" | "15" | "30" | "45";

const TIMES: { value: TimeKey; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
];

/**
 * "What should I do today?" — pick the sore areas, get one concrete answer.
 *
 * The recommendation always shows its reasoning. A black-box suggestion is
 * one you override once and then stop opening, so the verdict is followed by
 * the sentence that justifies it and every option carries what it hits.
 */
export default function Recommend() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[] | undefined>(undefined);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof listWorkoutsInRange>>>([]);
  const [sore, setSore] = useState<BodyPart[]>([]);
  const [time, setTime] = useState<TimeKey>("any");
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = todayStr();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const [t, r] = await Promise.all([
          listTemplates(user.uid),
          listWorkoutsInRange(user.uid, daysAgoStr(7), today),
        ]);
        if (!alive) return;
        setTemplates(t);
        setRecent(r);
      } catch (e: unknown) {
        console.error("[Recommend] load failed:", e);
        if (alive) {
          setError(e instanceof Error ? e.message : String(e));
          setTemplates([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, today]);

  const rec = useMemo(() => {
    if (!templates) return null;
    return recommend({
      sore,
      templates,
      recent,
      maxMinutes: time === "any" ? undefined : Number(time),
      today,
    });
  }, [templates, recent, sore, time, today]);

  function toggle(part: BodyPart) {
    setSore((s) => (s.includes(part) ? s.filter((p) => p !== part) : [...s, part]));
  }

  async function start(t: WorkoutTemplate) {
    if (!user || starting) return;
    setStarting(t.id);
    try {
      const id = await startWorkoutFromTemplate(user.uid, t);
      nav(`/workout/${id}`);
    } catch (e: unknown) {
      console.error("[Recommend] start failed:", e);
      setError(e instanceof Error ? e.message : String(e));
      setStarting(null);
    }
  }

  if (templates === undefined) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="What should I do?"
        subtitle="Tell me what's sore"
        action={
          <Link to="/" className="text-[16px] text-[color:var(--color-accent)] active:opacity-60">
            Cancel
          </Link>
        }
      />

      {error && (
        <Card>
          <div className="text-[15px] font-semibold text-[color:var(--color-danger)]">
            Something went wrong
          </div>
          <div className="mt-1 break-words text-[13px] text-[color:var(--color-muted)]">
            {error}
          </div>
        </Card>
      )}

      <section>
        <SectionHeader
          title="Sore areas"
          action={
            sore.length > 0 ? (
              <button
                onClick={() => setSore([])}
                className="text-[15px] text-[color:var(--color-accent)] active:opacity-60"
              >
                Clear
              </button>
            ) : (
              <span className="text-[13px] text-[color:var(--color-muted)]">
                Tap any that ache
              </span>
            )
          }
        />
        <div className="flex flex-wrap gap-2">
          {BODY_PARTS.map((b) => {
            const on = sore.includes(b.key);
            return (
              <button
                key={b.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(b.key)}
                className={`rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors ${
                  on
                    ? "bg-[color:var(--color-accent)] text-white"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="Time you've got" />
        <Segmented<TimeKey> value={time} onChange={setTime} options={TIMES} />
      </section>

      {rec && (
        <>
          <section>
            <Card>
              <div className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">
                {rec.verdict}
              </div>
              <p className="mt-1.5 text-[15px] leading-snug text-[color:var(--color-muted)]">
                {rec.rationale}
              </p>
            </Card>
          </section>

          {rec.primary && (
            <section>
              <SectionHeader title={rec.restDay ? "If you do train" : "Do this"} />
              <SuggestionCard
                suggestion={rec.primary}
                busy={starting === rec.primary.template.id}
                disabled={!!starting}
                onStart={() => void start(rec.primary!.template)}
              />
            </section>
          )}

          {rec.mobility && (
            <section>
              <SectionHeader title={rec.restDay ? "Do this instead" : "And loosen up"} />
              <SuggestionCard
                suggestion={rec.mobility}
                busy={starting === rec.mobility.template.id}
                disabled={!!starting}
                onStart={() => void start(rec.mobility!.template)}
              />
            </section>
          )}

          {rec.alternatives.length > 0 && (
            <section>
              <SectionHeader title="Other options" />
              <Group>
                {rec.alternatives.map((s) => (
                  <Row
                    key={s.template.id}
                    title={s.template.name}
                    subtitle={s.reason}
                    value={formatMinutes(s.minutes)}
                    onClick={() => void start(s.template)}
                  />
                ))}
              </Group>
            </section>
          )}

          {sore.length > 0 && (
            <p className="pb-2 text-center text-[13px] text-[color:var(--color-muted-2)]">
              Working around {joinParts(sore)}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  busy,
  disabled,
  onStart,
}: {
  suggestion: Suggestion;
  busy: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const { template, minutes, reason } = suggestion;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">
            {template.name}
          </div>
          <div className="mt-0.5 text-[13px] text-[color:var(--color-muted)]">{reason}</div>
        </div>
        <div className="shrink-0 text-[15px] tnum text-[color:var(--color-muted)]">
          {formatMinutes(minutes)}
        </div>
      </div>
      <Button block onClick={onStart} disabled={disabled} className="mt-4">
        {busy ? "Starting…" : "Start"}
      </Button>
    </Card>
  );
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}
