import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

/* ==========================================================================
   Primitives

   House rules, so screens stay coherent without each one re-deciding:
     · One accent. Blue means "the action" or "the active thing" — never
       decoration. Status colors only for real status.
     · Surfaces carry elevation, not borders. A card is a lighter fill on
       black; it does not also get a stroke.
     · Section headers are sentence case at normal tracking. No uppercase
       eyebrows, no letter-spacing.
     · Radii are 12 (card) / 10 (control). Pills are for chips only.
     · No gradients, no colored shadows.
   ========================================================================== */

/* --------------------------------- Button -------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "plain";
  size?: "sm" | "md" | "lg";
  /** Stretch to the container. The bottom-docked CTA shape. */
  block?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  ...props
}: ButtonProps) {
  const sizes: Record<string, string> = {
    sm: "h-7 px-2.5 text-[13px] rounded-lg",
    md: "h-9 px-3.5 text-[15px] rounded-[10px]",
    lg: "h-11 px-4 text-[16px] rounded-xl",
  };
  const variants: Record<string, string> = {
    // Flat fill. The press state is a darker blue, not a scale transform —
    // iOS controls dim, they don't shrink.
    primary:
      "bg-[color:var(--color-accent)] text-white font-semibold active:bg-[color:var(--color-accent-pressed)]",
    secondary:
      "bg-[color:var(--color-surface-2)] text-white font-semibold active:bg-[color:var(--color-surface-3)]",
    ghost:
      "bg-transparent text-[color:var(--color-accent)] font-semibold active:opacity-60",
    danger:
      "bg-[color:var(--color-surface-2)] text-[color:var(--color-danger)] font-semibold active:bg-[color:var(--color-surface-3)]",
    // Text-only, inherits color. For inline "Cancel" / "Edit" affordances.
    plain: "bg-transparent font-normal active:opacity-60",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 tracking-[-0.01em] transition-colors duration-100 select-none disabled:opacity-30 disabled:pointer-events-none ${
        sizes[size]
      } ${variants[variant]} ${block ? "w-full" : ""} ${className}`}
    />
  );
}

/* --------------------------------- Input --------------------------------- */

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string };

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[13px] text-[color:var(--color-muted)]">
          {label}
        </span>
      )}
      <input
        {...props}
        className={`h-10 w-full rounded-[10px] bg-[color:var(--color-surface-2)] px-3 text-[16px] outline-none placeholder:text-[color:var(--color-muted-2)] focus:bg-[color:var(--color-surface-3)] transition-colors ${className}`}
      />
    </label>
  );
}

/* --------------------------- Titles & headers ---------------------------- */

/**
 * iOS large title. One line, no eyebrow above it — the date or context goes
 * underneath as a subtitle where it reads as information rather than
 * decoration.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-none">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 text-[14px] leading-tight text-[color:var(--color-muted)]">
            {subtitle}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Header above a grouped section. Sentence case, secondary weight, optional
 * trailing action — the iOS grouped-table convention.
 */
export function SectionHeader({
  title,
  action,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 mb-1.5 ${className}`}>
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      {action}
    </div>
  );
}

/* ---------------------------- Surfaces & lists --------------------------- */

/**
 * Elevated surface. Fill only — no border. `padded` off when the card hosts
 * a Row list that needs to reach the edges.
 */
export function Card({
  children,
  className = "",
  padded = true,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`block w-full text-left rounded-[12px] bg-[color:var(--color-surface)] ${
        padded ? "p-3.5" : ""
      } ${onClick ? "active:bg-[color:var(--color-surface-2)] transition-colors" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

/**
 * A grouped list: one surface, hairline-separated rows. This is the shape
 * that replaces "a card per item" — it reads as a single object, which is
 * what makes a long list feel calm.
 */
export function Group({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[12px] bg-[color:var(--color-surface)] divide-rows ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * One row in a Group. Optional leading media, title + subtitle, trailing
 * value and/or chevron. Renders as Link, button, or div depending on props.
 */
export function Row({
  leading,
  title,
  subtitle,
  value,
  trailing,
  chevron = false,
  to,
  onClick,
  className = "",
  destructive = false,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  to?: string;
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
}) {
  const inner = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div
          className={`text-[15px] leading-tight tracking-[-0.01em] truncate ${
            destructive ? "text-[color:var(--color-danger)]" : ""
          }`}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-px text-[13px] text-[color:var(--color-muted)] truncate">
            {subtitle}
          </div>
        )}
      </div>
      {value && (
        <div className="shrink-0 text-[14px] text-[color:var(--color-muted)] tnum">
          {value}
        </div>
      )}
      {trailing}
      {chevron && <Chevron />}
    </>
  );

  const cls = `flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${
    to || onClick ? "active:bg-[color:var(--color-surface-2)] transition-colors" : ""
  } ${className}`;

  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    // role=button on a div rather than a real <button>: rows routinely carry
    // their own controls in `trailing` (move, delete, overflow), and nesting a
    // button inside a button is invalid HTML that React refuses to render.
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={`${cls} cursor-pointer`}
      >
        {inner}
      </div>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function Chevron() {
  return (
    <svg
      className="shrink-0 text-[color:var(--color-muted-2)]"
      width="8"
      height="13"
      viewBox="0 0 8 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="1.5 1.5 6.5 6.5 1.5 11.5" />
    </svg>
  );
}

/* ---------------------------------- Chip --------------------------------- */

/**
 * Small status pill. Neutral by default — a chip should only take color when
 * the color carries meaning.
 */
export function Tag({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "accent" | "warn" | "success" | "danger" | "info";
}) {
  const colors: Record<string, string> = {
    default: "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]",
    accent: "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]",
    warn: "bg-[color:var(--color-warn)]/15 text-[color:var(--color-warn)]",
    success: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    danger: "bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]",
    info: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Chip rail ------------------------------- */

/**
 * Horizontally scrolling single-select filter. Bleeds to the screen edges so
 * it reads as scrollable rather than boxed in — pass the page's horizontal
 * padding as `bleed` (default matches the 16px app gutter).
 *
 * Options with a zero count render dimmed and disabled: a filter that would
 * return nothing should say so before you tap it.
 */
export function ChipRail<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label?: string;
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 text-[13px] text-[color:var(--color-muted)]">{label}</div>
      )}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {options.map((o) => {
          const on = o.value === value;
          const empty = o.count === 0 && !on;
          return (
            <button
              key={o.value}
              type="button"
              disabled={empty}
              onClick={() => onChange(o.value)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                on
                  ? "bg-[color:var(--color-accent)] text-white"
                  : empty
                  ? "bg-[color:var(--color-surface)] text-[color:var(--color-muted-2)] opacity-40"
                  : "bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]"
              }`}
            >
              {o.label}
              {o.count !== undefined && <span className="ml-1.5 tnum opacity-60">{o.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- Switch --------------------------------- */

/**
 * iOS toggle. Presentational only — put the click handler on the enclosing
 * Row so the whole row is the target, which is how iOS settings behave.
 */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
        on ? "bg-[color:var(--color-success)]" : "bg-[color:var(--color-surface-3)]"
      }`}
    >
      <span
        className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-sm transition-[left] duration-200 ${
          on ? "left-[22px]" : "left-[2px]"
        }`}
      />
    </span>
  );
}

/* --------------------------- Segmented control --------------------------- */

/** iOS segmented control. Replaces rows of pill buttons for exclusive choice. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex gap-0.5 rounded-[10px] bg-[color:var(--color-surface-2)] p-0.5 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[8px] py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-[color:var(--color-surface-3)] text-white"
                : "text-[color:var(--color-muted)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- Metrics -------------------------------- */

/** A single number with its label. The building block of any stats strip. */
export function Stat({
  value,
  label,
  tone = "default",
}: {
  value: ReactNode;
  label: string;
  tone?: "default" | "accent" | "success" | "muted";
}) {
  const tones: Record<string, string> = {
    default: "text-white",
    accent: "text-[color:var(--color-accent)]",
    success: "text-[color:var(--color-success)]",
    muted: "text-[color:var(--color-muted)]",
  };
  return (
    <div className="min-w-0">
      <div
        className={`text-[22px] font-semibold tracking-[-0.02em] tnum leading-none ${tones[tone]}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[13px] text-[color:var(--color-muted)] truncate">
        {label}
      </div>
    </div>
  );
}

/** Thin progress track. Accent by default; pass a tone for status meaning. */
export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  className = "",
}: {
  value: number;
  max?: number;
  tone?: "accent" | "success" | "muted";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tones: Record<string, string> = {
    accent: "bg-[color:var(--color-accent)]",
    success: "bg-[color:var(--color-success)]",
    muted: "bg-[color:var(--color-muted)]",
  };
  return (
    <div
      className={`h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-3)] ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${tones[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------ Placeholders ----------------------------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-shimmer rounded-[14px] bg-[color:var(--color-surface)] ${className}`}
    />
  );
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-40 rounded-lg" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={i === 0 ? "h-32" : "h-16"} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="text-[17px] font-semibold tracking-[-0.01em]">{title}</div>
      {description && (
        <div className="mx-auto mt-1.5 max-w-[280px] text-[15px] leading-snug text-[color:var(--color-muted)]">
          {description}
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------ Bottom sheet ----------------------------- */

/**
 * Host for anything that covers the screen — sheets, timers, pickers.
 *
 * Renders into <body> instead of in place, and that is not optional. `<main>`
 * carries `animate-fade-in`, whose `animation-fill-mode: both` keeps the
 * animation applied after it finishes, which makes <main> a permanent
 * stacking context. Any overlay rendered by a page therefore had its z-index
 * scoped INSIDE <main>, so the fixed tab bar (z-20, root context) painted
 * over the bottom ~58px of it — quietly swallowing whichever button sat
 * there. Portalling out puts overlays back in the root stacking context where
 * their z-50 means what it says.
 *
 * Events still propagate through the React tree, so backdrop-click-to-close
 * and stopPropagation() work exactly as they read.
 */
export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

/**
 * Modal bottom sheet with a grabber. Backdrop dims and blurs; the sheet
 * slides from the bottom edge.
 */
export function Sheet({
  children,
  onClose,
  label,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <Overlay>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <button
          aria-label="Dismiss"
          onClick={onClose}
          className="absolute inset-0 animate-backdrop-in bg-black/50 backdrop-blur-[2px]"
        />
        <div
          className={`animate-sheet-up relative flex max-h-[88vh] w-full max-w-xl flex-col rounded-t-[16px] bg-[color:var(--color-surface)] ${className}`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-9 rounded-full bg-[color:var(--color-muted-2)]" />
          </div>
          {children}
        </div>
      </div>
    </Overlay>
  );
}

/** Sheet title bar: leading cancel, centered title, optional trailing action. */
export function SheetHeader({
  title,
  onCancel,
  action,
}: {
  title: string;
  onCancel?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
      <div className="justify-self-start">
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-[16px] text-[color:var(--color-accent)] active:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="text-[16px] font-semibold tracking-[-0.01em]">{title}</div>
      <div className="justify-self-end">{action}</div>
    </div>
  );
}
