"use client";

// Filter bar for /yaml-status — dropdowns that auto-submit on change
// using URL searchParams as the filter state. Server-rendered page
// reads the params and applies the filter; the meta http-equiv refresh
// preserves them across the 8-second auto-refresh.
//
// Kept as a tiny client island so the rest of the page stays server-
// rendered (the data load is heavy enough that we don't want a full
// client component).

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { MEDIUM_LABELS } from "@/lib/curriculum/boards";

type Option = { value: string; label: string };

export default function Filters({
  bundles,
  boards,
  mediums,
}: {
  /** Bundles that actually appear in the catalog — { slug, title }. */
  bundles: Option[];
  /** Boards that actually appear in tagged bundles — slugs like "cbse". */
  boards: string[];
  /** Mediums that actually appear in tagged bundles — codes like "en". */
  mediums: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = {
    bundle: sp.get("bundle") ?? "",
    board: sp.get("board") ?? "",
    medium: sp.get("medium") ?? "",
    status: sp.get("status") ?? "",
  };

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/yaml-status?${qs}` : "/yaml-status");
    });
  }

  const anyActive =
    !!current.bundle || !!current.board || !!current.medium || !!current.status;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        marginBottom: 14,
        padding: 12,
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
      }}
    >
      <FilterLabel>Filter</FilterLabel>

      <FilterSelect
        value={current.bundle}
        onChange={(v) => setParam("bundle", v)}
        options={[
          { value: "", label: "All bundles" },
          ...bundles.map((b) => ({ value: b.value, label: b.label })),
        ]}
        disabled={pending}
        ariaLabel="Bundle"
      />

      <FilterSelect
        value={current.board}
        onChange={(v) => setParam("board", v)}
        options={[
          { value: "", label: "All boards" },
          ...boards.map((b) => ({ value: b, label: b.toUpperCase() })),
        ]}
        disabled={pending}
        ariaLabel="Board"
      />

      <FilterSelect
        value={current.medium}
        onChange={(v) => setParam("medium", v)}
        options={[
          { value: "", label: "All mediums" },
          ...mediums.map((m) => ({
            value: m,
            label: MEDIUM_LABELS[m] ?? m,
          })),
        ]}
        disabled={pending}
        ariaLabel="Medium"
      />

      {anyActive && (
        <a
          href="/yaml-status"
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#4F46BA",
            fontFamily: "ui-monospace, monospace",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ✕ clear filters
        </a>
      )}
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#475569",
        fontFamily: "ui-monospace, monospace",
        marginRight: 4,
      }}
    >
      {children}
    </span>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #CBD5E1",
        fontSize: 13,
        background: "#fff",
        color: "#0F172A",
        fontFamily: "inherit",
        cursor: disabled ? "wait" : "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
