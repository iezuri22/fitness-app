import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  listExercises,
  createExercise,
  importMissingNotionExercises,
  countMissingCatalog,
} from "../lib/db";
import {
  Button,
  Card,
  EmptyState,
  Group,
  Input,
  PageHeader,
  PageSkeleton,
  Row,
  Sheet,
  SheetHeader,
  Switch,
  Tag,
  ChipRail,
} from "../components/ui";
import { BODY_PARTS, bodyPartsForName, type BodyPart } from "../lib/generateWorkout";
import ExerciseGif from "../components/ExerciseGif";
import { findGifForName } from "../lib/exerciseGifs";
import type { Exercise, ExerciseCategory } from "../lib/types";

const CATEGORIES: ExerciseCategory[] = [
  "PT/Rehab",
  "Upper Body",
  "Lower Body",
  "Core",
  "Full Body",
  "Cardio",
  "Mobility",
];

export default function Exercises() {
  const { user } = useAuth();
  const [items, setItems] = useState<Exercise[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ExerciseCategory | "All">("All");
  const [part, setPart] = useState<BodyPart | "All">("All");
  const [onlyMissingGif, setOnlyMissingGif] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    const ex = await listExercises(user.uid);
    setItems(ex);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const ql = q.trim().toLowerCase();
    return items.filter((e) => {
      if (cat !== "All" && e.category !== cat) return false;
      if (part !== "All" && !bodyPartsForName(e.name).includes(part)) return false;
      if (ql && !e.name.toLowerCase().includes(ql)) return false;
      if (onlyMissingGif && (e.gifUrl || findGifForName(e.name))) return false;
      return true;
    });
  }, [items, q, cat, part, onlyMissingGif]);

  // Counts respect the category filter but not the body-part one, so the rail
  // shows what each option would give you rather than what's selected now.
  const partCounts = useMemo(() => {
    const base = (items ?? []).filter((e) => cat === "All" || e.category === cat);
    const counts = Object.fromEntries(BODY_PARTS.map((b) => [b.key, 0])) as Record<BodyPart, number>;
    for (const e of base) for (const bp of bodyPartsForName(e.name)) counts[bp] += 1;
    return counts;
  }, [items, cat]);

  const missingGifCount = useMemo(() => {
    if (!items) return 0;
    return items.filter((e) => !e.gifUrl && !findGifForName(e.name)).length;
  }, [items]);

  const notionMissingCount = useMemo(() => {
    if (!items) return 0;
    return countMissingCatalog(items);
  }, [items]);

  async function onImportNotion() {
    if (!user || importing) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const added = await importMissingNotionExercises(user.uid);
      setImportMsg(added === 0 ? "Everything already imported." : `Added ${added} exercises to your library.`);
      await refresh();
    } catch (err: unknown) {
      setImportMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  if (items === null) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exercises"
        subtitle={`${items.length} in your library`}
        action={
          <button
            onClick={() => setCreating(true)}
            className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
          >
            New
          </button>
        }
      />

      <Input
        placeholder="Search exercises"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <ChipRail<ExerciseCategory | "All">
        label="Category"
        value={cat}
        onChange={setCat}
        options={(["All", ...CATEGORIES] as const).map((c) => ({ value: c, label: c }))}
      />

      <ChipRail<BodyPart | "All">
        label="Body part"
        value={part}
        onChange={setPart}
        options={[
          { value: "All" as const, label: "All" },
          ...BODY_PARTS.map((b) => ({
            value: b.key,
            label: b.label,
            count: partCounts[b.key],
          })),
        ]}
      />

      <Group>
        <Row
          to="/body"
          title="Study body parts"
          subtitle="What each area does, and how to train it"
          chevron
        />
      </Group>

      {notionMissingCount > 0 && (
        <Card>
          <div className="text-[16px] tracking-[-0.01em]">
            {notionMissingCount} new exercises available
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[color:var(--color-muted)]">
            Notion catalog, home hypertrophy set and gym pack (barbell, machine,
            cable, cardio equipment).
          </p>
          {importMsg && (
            <p className="mt-2 text-[13px] text-[color:var(--color-muted)]">{importMsg}</p>
          )}
          <Button
            variant="secondary"
            onClick={onImportNotion}
            disabled={importing}
            block
            className="mt-3"
          >
            {importing ? "Importing…" : "Import"}
          </Button>
        </Card>
      )}
      {notionMissingCount === 0 && importMsg && (
        <Card>
          <div className="text-[13px] text-[color:var(--color-muted)]">{importMsg}</div>
        </Card>
      )}

      {missingGifCount > 0 && (
        <Group>
          <Row
            onClick={() => setOnlyMissingGif((v) => !v)}
            title="Missing a demo"
            value={String(missingGifCount)}
            trailing={<Switch on={onlyMissingGif} />}
          />
        </Group>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "No exercises yet" : "No matches"}
          description={
            items.length === 0
              ? "Tap New to create your first exercise, or import from Notion."
              : "Try a different search or category."
          }
        />
      ) : (
        <Group>
          {filtered.map((e) => (
            <Row
              key={e.id}
              to={`/exercises/${e.id}`}
              leading={<ExerciseGif name={e.name} gifUrl={e.gifUrl} size="thumb" />}
              title={e.name}
              subtitle={
                e.equipment.length > 0
                  ? `${e.category} · ${e.equipment.join(", ")}`
                  : e.category
              }
              trailing={
                e.isBannedLatarjet ? (
                  <Tag variant="danger">Banned</Tag>
                ) : e.isPT ? (
                  <Tag variant="info">PT</Tag>
                ) : undefined
              }
              chevron
            />
          ))}
        </Group>
      )}

      {creating && (
        <CreateExerciseModal
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateExerciseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExerciseCategory>("Upper Body");
  const [equipment, setEquipment] = useState("");
  const [isPT, setIsPT] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      await createExercise(user.uid, {
        name: name.trim(),
        category,
        equipment: equipment
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        muscleGroups: [],
        isPT,
        isBannedLatarjet: false,
      });
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} label="New exercise">
      <SheetHeader title="New exercise" onCancel={onClose} />
      <form onSubmit={onSubmit} className="space-y-3 overflow-y-auto px-4 pb-6 pt-2">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-[color:var(--color-muted)]">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
            className="h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] px-3.5 text-[16px] outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Equipment (comma-separated)"
          placeholder="Bands, Kettlebell 20lb"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        />
        <Group>
          <Row
            title="PT / rehab exercise"
            onClick={() => setIsPT((v) => !v)}
            trailing={<Switch on={isPT} />}
          />
        </Group>
        <Button size="lg" block type="submit" disabled={busy} className="!mt-5">
          {busy ? "Saving…" : "Save exercise"}
        </Button>
      </form>
    </Sheet>
  );
}
