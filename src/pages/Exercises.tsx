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
  SectionHeader,
  Sheet,
  SheetHeader,
  Switch,
  Tag,
} from "../components/ui";
import {
  BODY_PARTS,
  bodyPartsForName,
  exerciseLocation,
  type BodyPart,
  type ExerciseLocation,
} from "../lib/generateWorkout";
import ExerciseGif from "../components/ExerciseGif";
import { findGifForName } from "../lib/exerciseGifs";
import type { Exercise, ExerciseCategory } from "../lib/types";

/** Rows rendered per page. Big enough to fill a scroll, small enough to mount fast. */
const PAGE = 40;

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
  const [loc, setLoc] = useState<ExerciseLocation | "All">("All");
  const [onlyMissingGif, setOnlyMissingGif] = useState(false);
  // The library runs to several hundred entries; mounting every row (each with
  // its own demo image) is what made this tab slow to open. Render a page at a
  // time instead.
  const [visible, setVisible] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      if (loc !== "All" && exerciseLocation(e) !== loc) return false;
      if (ql && !e.name.toLowerCase().includes(ql)) return false;
      if (onlyMissingGif && (e.gifUrl || findGifForName(e.name))) return false;
      return true;
    });
  }, [items, q, cat, part, loc, onlyMissingGif]);

  // Any change to the filters means the old offset is meaningless.
  useEffect(() => {
    setVisible(PAGE);
  }, [q, cat, part, loc, onlyMissingGif]);

  // Counts respect the category filter but not the body-part one, so the rail
  // shows what each option would give you rather than what's selected now.
  const partCounts = useMemo(() => {
    const base = (items ?? []).filter((e) => cat === "All" || e.category === cat);
    const counts = Object.fromEntries(BODY_PARTS.map((b) => [b.key, 0])) as Record<BodyPart, number>;
    for (const e of base) for (const bp of bodyPartsForName(e.name)) counts[bp] += 1;
    return counts;
  }, [items, cat]);

  const locCounts = useMemo(() => {
    let gym = 0, home = 0;
    for (const e of items ?? []) {
      if (exerciseLocation(e) === "gym") gym += 1;
      else home += 1;
    }
    return { gym, home };
  }, [items]);

  const activeFilters =
    (cat !== "All" ? 1 : 0) +
    (part !== "All" ? 1 : 0) +
    (loc !== "All" ? 1 : 0) +
    (onlyMissingGif ? 1 : 0);

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

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search exercises"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className={`h-10 shrink-0 rounded-[10px] px-3.5 text-[15px] font-medium transition-colors ${
            activeFilters > 0
              ? "bg-[color:var(--color-accent)] text-white"
              : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
          }`}
        >
          Filters{activeFilters > 0 ? ` · ${activeFilters}` : ""}
        </button>
      </div>

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
          {filtered.slice(0, visible).map((e) => (
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

      {filtered.length > visible && (
        <Button
          variant="secondary"
          block
          onClick={() => setVisible((v) => v + PAGE)}
          className="!mt-3"
        >
          Show {Math.min(PAGE, filtered.length - visible)} more
          <span className="text-[color:var(--color-muted)]">
            ({visible} of {filtered.length})
          </span>
        </Button>
      )}

      <Group>
        <Row
          to="/body"
          title="Study body parts"
          subtitle="What each area does, and how to train it"
          chevron
        />
      </Group>

      {filtersOpen && (
        <Sheet onClose={() => setFiltersOpen(false)} label="Filter exercises">
          <SheetHeader
            title="Filters"
            onCancel={() => setFiltersOpen(false)}
            action={
              activeFilters > 0 ? (
                <button
                  onClick={() => {
                    setCat("All");
                    setPart("All");
                    setLoc("All");
                    setOnlyMissingGif(false);
                  }}
                  className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
                >
                  Reset
                </button>
              ) : undefined
            }
          />
          <div className="space-y-5 overflow-y-auto px-4 pb-8 pt-2">
            <section>
              <SectionHeader title="Where" />
              <Group>
                <Row
                  title="Anywhere"
                  onClick={() => setLoc("All")}
                  trailing={loc === "All" ? <Tick /> : undefined}
                />
                <Row
                  title="Home"
                  subtitle="No gym equipment needed"
                  value={String(locCounts.home)}
                  onClick={() => setLoc("home")}
                  trailing={loc === "home" ? <Tick /> : undefined}
                />
                <Row
                  title="Gym only"
                  subtitle="Machines, cables, barbells"
                  value={String(locCounts.gym)}
                  onClick={() => setLoc("gym")}
                  trailing={loc === "gym" ? <Tick /> : undefined}
                />
              </Group>
            </section>

            <section>
              <SectionHeader title="Body part" />
              <Group>
                <Row
                  title="Any body part"
                  onClick={() => setPart("All")}
                  trailing={part === "All" ? <Tick /> : undefined}
                />
                {BODY_PARTS.map((b) => (
                  <Row
                    key={b.key}
                    title={b.label}
                    value={String(partCounts[b.key])}
                    onClick={() => setPart(b.key)}
                    trailing={part === b.key ? <Tick /> : undefined}
                  />
                ))}
              </Group>
            </section>

            <section>
              <SectionHeader title="Category" />
              <Group>
                {(["All", ...CATEGORIES] as const).map((c) => (
                  <Row
                    key={c}
                    title={c === "All" ? "All categories" : c}
                    onClick={() => setCat(c)}
                    trailing={cat === c ? <Tick /> : undefined}
                  />
                ))}
              </Group>
            </section>

            {missingGifCount > 0 && (
              <section>
                <SectionHeader title="Demos" />
                <Group>
                  <Row
                    onClick={() => setOnlyMissingGif((v) => !v)}
                    title="Missing a demo"
                    value={String(missingGifCount)}
                    trailing={<Switch on={onlyMissingGif} />}
                  />
                </Group>
              </section>
            )}

            <Button size="lg" block onClick={() => setFiltersOpen(false)}>
              Show {filtered.length} exercise{filtered.length === 1 ? "" : "s"}
            </Button>
          </div>
        </Sheet>
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

function Tick() {
  return (
    <svg
      className="shrink-0 text-[color:var(--color-accent)]"
      width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
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
