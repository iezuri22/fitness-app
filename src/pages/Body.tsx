import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { listExercises } from "../lib/db";
import { BackLink, Card, Group, PageHeader, PageSkeleton, Row, SectionHeader, Tag } from "../components/ui";
import ExerciseGif from "../components/ExerciseGif";
import { BODY_PARTS, bodyPartsForName, type BodyPart } from "../lib/generateWorkout";
import { BODY_PART_GUIDE } from "../lib/bodyPartGuide";
import type { Exercise } from "../lib/types";

/**
 * Body-part reference. The index lists the seven areas; the detail page is a
 * short study sheet — what the muscles are, what they do, how to train them,
 * what people get wrong — followed by the exercises you actually own that
 * train it, so reading turns straight into doing.
 */
export default function Body() {
  const { part } = useParams<{ part?: string }>();
  const key = BODY_PARTS.find((b) => b.key === part)?.key;
  return key ? <BodyPartDetail part={key} /> : <BodyIndex />;
}

function BodyIndex() {
  return (
    <div className="space-y-4">
      <PageHeader title="Body" subtitle="How each area works, and how to train it" />
      <Group>
        {BODY_PARTS.map((b) => (
          <Row
            key={b.key}
            to={`/body/${b.key}`}
            title={b.label}
            subtitle={BODY_PART_GUIDE[b.key].muscles.map((m) => m.name.split(" (")[0]).join(", ")}
            chevron
          />
        ))}
      </Group>
      <p className="pb-2 text-center text-[13px] leading-snug text-[color:var(--color-muted-2)]">
        Written around your shoulder — areas that carry real risk say so.
      </p>
    </div>
  );
}

/** One number from the training prescription. Wraps, unlike Stat. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-[color:var(--color-muted)]">{label}</div>
      <div className="mt-0.5 text-[15px] leading-tight tracking-[-0.01em]">{value}</div>
    </div>
  );
}

function BodyPartDetail({ part }: { part: BodyPart }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Exercise[] | null>(null);
  const guide = BODY_PART_GUIDE[part];
  const label = BODY_PARTS.find((b) => b.key === part)!.label;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const ex = await listExercises(user.uid);
      if (alive) setItems(ex);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  // Banned movements sort last rather than disappearing — knowing what to avoid
  // for this area is part of studying it.
  const matches = useMemo(() => {
    return (items ?? [])
      .filter((e) => bodyPartsForName(e.name).includes(part))
      .sort((a, b) => Number(a.isBannedLatarjet) - Number(b.isBannedLatarjet));
  }, [items, part]);

  return (
    <div className="space-y-4">
      <BackLink fallback="/body" label="Body" />

      <PageHeader title={label} subtitle={guide.patterns.join(" · ")} />

      {guide.caution && (
        <Card>
          <div className="flex items-center gap-2">
            <Tag variant="warn">Shoulder</Tag>
          </div>
          <p className="mt-2 text-[15px] leading-snug text-[color:var(--color-warn)]">
            {guide.caution}
          </p>
        </Card>
      )}

      {/* Illustrated first. Reading about the lateral deltoid is far less
          useful than seeing the three movements that train it. */}
      <section>
        <div className="grid grid-cols-3 gap-2">
          {guide.keyExercises.map((name) => {
            const match = (items ?? []).find(
              (e) => e.name.toLowerCase() === name.toLowerCase()
            );
            return (
              <Link
                key={name}
                to={match ? `/exercises/${match.id}` : "/exercises"}
                className="min-w-0 active:opacity-70"
              >
                <div className="overflow-hidden rounded-[10px]">
                  <ExerciseGif name={name} gifUrl={match?.gifUrl} size="card" />
                </div>
                <div className="mt-1.5 text-[12px] leading-tight text-[color:var(--color-muted)]">
                  {name}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <Card>
          <div className="grid grid-cols-3 gap-3">
            <Fact label="Frequency" value={guide.training.frequency} />
            <Fact label="Volume" value={guide.training.volume} />
            <Fact label="Reps" value={guide.training.reps} />
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader title="What it does" />
        <Card>
          <p className="text-[15px] leading-snug">{guide.what}</p>
        </Card>
      </section>

      <section>
        <SectionHeader title="The muscles" />
        <Group>
          {guide.muscles.map((m) => (
            <Row key={m.name} title={m.name} subtitle={m.role} />
          ))}
        </Group>
      </section>

      <section>
        <SectionHeader title="How to train it" />
        <Card>
          <p className="text-[15px] leading-snug">{guide.how}</p>
        </Card>
      </section>

      <section>
        <SectionHeader title="Making progress" />
        <Card>
          <p className="text-[15px] leading-snug">{guide.progression}</p>
        </Card>
      </section>

      <section>
        <SectionHeader title="Common mistakes" />
        <Card>
          <ul className="space-y-2.5">
            {guide.mistakes.map((m) => (
              <li key={m} className="flex gap-2.5 text-[15px] leading-snug">
                <span aria-hidden className="text-[color:var(--color-muted-2)]">
                  —
                </span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader
          title="In your library"
          action={
            <Link
              to="/exercises"
              className="text-[15px] text-[color:var(--color-accent)] active:opacity-60"
            >
              All exercises
            </Link>
          }
        />
        {items === null ? (
          <PageSkeleton rows={3} />
        ) : matches.length === 0 ? (
          <Card>
            <div className="text-[15px] text-[color:var(--color-muted)]">
              Nothing in your library matches this area yet.
            </div>
          </Card>
        ) : (
          <Group>
            {matches.slice(0, 12).map((e) => (
              <Row
                key={e.id}
                to={`/exercises/${e.id}`}
                leading={<ExerciseGif name={e.name} gifUrl={e.gifUrl} size="thumb" />}
                title={e.name}
                subtitle={
                  e.equipment.length > 0 ? `${e.category} · ${e.equipment.join(", ")}` : e.category
                }
                trailing={e.isBannedLatarjet ? <Tag variant="danger">Avoid</Tag> : undefined}
                chevron
              />
            ))}
          </Group>
        )}
        {matches.length > 12 && (
          <p className="mt-2 text-center text-[13px] text-[color:var(--color-muted-2)]">
            Showing 12 of {matches.length}. Filter the Exercises tab by {label.toLowerCase()} for
            the rest.
          </p>
        )}
      </section>
    </div>
  );
}
