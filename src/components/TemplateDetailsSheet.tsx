import { useMemo, useState } from "react";
import type { WorkoutTemplate } from "../lib/types";
import type { TemplatePatch } from "../lib/db";
import { Button, Sheet, SheetHeader } from "./ui";
import { estimatePlannedMinutes } from "../lib/timeEstimate";

/**
 * Edit a routine's name and how long it says it takes.
 *
 * Replaced a `prompt()` rename, which couldn't touch the duration at all —
 * and the duration was the actual problem: names promise a length
 * ("Home · Kettlebell 25") while the card showed whatever the per-set model
 * guessed, which for that one was 22 min.
 *
 * Which field the duration writes depends on the format:
 *   · amrap / flow — writes `capMinutes`, the clock the runner counts down.
 *     There is no separate estimate for these; the cap IS the duration.
 *   · standard — writes `estimatedMinutes`, an override on the per-set model.
 *     Clearing it hands the number back to the model.
 */
export default function TemplateDetailsSheet({
  template,
  onSave,
  onClose,
}: {
  template: WorkoutTemplate;
  onSave: (patch: TemplatePatch) => void | Promise<void>;
  onClose: () => void;
}) {
  const clocked = template.format === "amrap" || template.format === "flow";

  const [name, setName] = useState(template.name);
  const [minutes, setMinutes] = useState(
    String((clocked ? template.capMinutes : template.estimatedMinutes) ?? "")
  );
  const [saving, setSaving] = useState(false);

  /** What the per-set model says, ignoring any override. Shown as the
   *  placeholder so "leave it blank" has a visible consequence. */
  const autoMinutes = useMemo(
    () => Math.round(estimatePlannedMinutes({ plannedSets: template.plannedSets })),
    [template.plannedSets]
  );

  /** For a flow, what the holds actually add up to — the cap should match it,
   *  and if it doesn't the user should be able to see that before saving. */
  const holdMinutes = useMemo(() => {
    if (template.format !== "flow") return null;
    const secs = template.plannedSets.reduce((n, s) => n + (s.workSeconds ?? 0), 0);
    return secs > 0 ? secs / 60 : null;
  }, [template.format, template.plannedSets]);

  const trimmedName = name.trim();
  const parsed = minutes.trim() === "" ? null : Number(minutes);
  const minutesInvalid =
    parsed !== null && (!Number.isFinite(parsed) || parsed < 1 || parsed > 300);
  // A clocked format has nothing to fall back on, so it can't be left blank.
  const missingCap = clocked && parsed === null;
  const canSave =
    trimmedName.length > 0 && !minutesInvalid && !missingCap && !saving;

  const capChanged =
    clocked && parsed !== null && parsed !== (template.capMinutes ?? null);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      const patch: TemplatePatch = {};
      if (trimmedName !== template.name) patch.name = trimmedName;
      if (clocked) {
        if (parsed !== template.capMinutes) patch.capMinutes = parsed;
      } else if (parsed !== (template.estimatedMinutes ?? null)) {
        // null, not undefined — undefined is dropped from the write and the
        // old value would survive. See TemplatePatch in lib/db.
        patch.estimatedMinutes = parsed;
      }
      if (Object.keys(patch).length > 0) await onSave(patch);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet onClose={onClose} label="Edit name and duration">
      <SheetHeader
        title="Name & duration"
        onCancel={onClose}
        action={
          <button
            onClick={() => void submit()}
            disabled={!canSave}
            className="text-[16px] font-semibold text-[color:var(--color-accent)] disabled:opacity-30 active:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />

      <div className="space-y-5 overflow-y-auto px-4 pb-6 pt-1">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="Routine name"
            aria-label="Routine name"
            autoComplete="off"
            className="h-11 w-full rounded-xl bg-[color:var(--color-surface-2)] px-3.5 text-[16px] outline-none placeholder:text-[color:var(--color-muted-2)] focus:bg-[color:var(--color-surface-3)]"
          />
          <Hint>
            A number in the name is treated as its length, so keep the two in
            step — "Quick Upper 20" should be 20 minutes.
          </Hint>
        </Field>

        <Field label={clocked ? "Time cap" : "Duration"}>
          <div className="flex items-center gap-2">
            <input
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              type="text"
              inputMode="numeric"
              placeholder={clocked ? "Minutes" : `Auto · ${autoMinutes}`}
              aria-label={clocked ? "Time cap in minutes" : "Duration in minutes"}
              className="h-11 w-28 rounded-xl bg-[color:var(--color-surface-2)] px-3.5 text-[16px] tnum outline-none placeholder:text-[color:var(--color-muted-2)] focus:bg-[color:var(--color-surface-3)]"
            />
            <span className="text-[15px] text-[color:var(--color-muted)]">min</span>
            {!clocked && minutes.trim() !== "" && (
              <button
                onClick={() => setMinutes("")}
                className="ml-auto text-[15px] text-[color:var(--color-accent)] active:opacity-60"
              >
                Use auto
              </button>
            )}
          </div>

          {minutesInvalid && (
            <Hint danger>Enter a length between 1 and 300 minutes.</Hint>
          )}
          {missingCap && !minutesInvalid && (
            <Hint danger>
              This format runs to a clock, so it needs a cap.
            </Hint>
          )}

          {!minutesInvalid && !missingCap && !clocked && (
            <Hint>
              {minutes.trim() === ""
                ? `Estimated from the set list: ${autoMinutes} min. It'll move as you add or remove sets.`
                : `Overrides the estimate of ${autoMinutes} min. The estimate doesn't count setup, plate changes or walking between machines, so it usually reads low.`}
            </Hint>
          )}

          {!minutesInvalid && !missingCap && template.format === "flow" && (
            <Hint>
              {holdMinutes !== null
                ? `The holds add up to ${round1(holdMinutes)} min. This sets the clock, not the holds — edit the routine to change those.`
                : "This sets the clock the runner counts down."}
            </Hint>
          )}

          {template.format === "amrap" && capChanged && (
            <Hint danger>
              Past scores were set on a {template.capMinutes ?? "?"}-minute
              clock. Change the cap and they stop being comparable.
            </Hint>
          )}
        </Field>

        <Button size="lg" block onClick={() => void submit()} disabled={!canSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[13px] font-medium uppercase tracking-[0.04em] text-[color:var(--color-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}

function Hint({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <p
      className={`text-[13px] leading-snug ${
        danger ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-muted)]"
      }`}
    >
      {children}
    </p>
  );
}

const round1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
