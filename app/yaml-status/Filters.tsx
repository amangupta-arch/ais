"use client";

// Filter bar for /yaml-status — dropdowns that auto-submit on change
// using URL searchParams as the filter state. Server-rendered page
// reads the params and applies the filter; the meta http-equiv refresh
// preserves them across the 8-second auto-refresh.
//
// Kept as a tiny client island so the rest of the page stays server-
// rendered (the data load is heavy enough that we don't want a full
// client component).
//
// Option lists are computed server-side via faceted narrowing — each
// dropdown only shows values that exist when the OTHER 3 filters are
// applied. The cascading is the server's job; this component just
// renders what it's given.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { MEDIUM_LABELS } from "@/lib/curriculum/boards";

type Option = { value: string; label: string };

export default function Filters({
  bundles,
  courses,
  boards,
  mediums,
}: {
  /** Bundles available under the current (course, board, medium) filters — { slug, title }. */
  bundles: Option[];
  /** Courses available under the current (bundle, board, medium) filters — { slug, title }. */
  courses: Option[];
  /** Boards present in entries under the current (bundle, course, medium) filters. */
  boards: string[];
  /** Mediums present in entries under the current (bundle, course, board) filters. */
  mediums: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  // useTransition keeps the dropdowns responsive during navigation —
  // React renders the new state immediately and applies the URL change
  // in a non-blocking transition. We intentionally do NOT disable the
  // selects while pending, so rapid filter changes feel snappy.
  const [, startTransition] = useTransition();

  const current = {
    bundle: sp.get("bundle") ?? "",
    course: sp.get("course") ?? "",
    board: sp.get("board") ?? "",
    medium: sp.get("medium") ?? "",
    status: sp.get("status") ?? "",
  };

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    // Course is bundle-scoped — when the bundle changes, an old
    // course selection can't survive (it belongs to a different
    // bundle). Drop it so the visitor doesn't see "Course = Y" in
    // the dropdown with zero results. Board/medium are peer filters
    // (a bundle can be tagged for multiple), so they stay.
    if (key === "bundle") next.delete("course");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/yaml-status?${qs}` : "/yaml-status");
    });
  }

  const anyActive =
    !!current.bundle ||
    !!current.course ||
    !!current.board ||
    !!current.medium ||
    !!current.status;

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
          ...bundles,
        ]}
        ariaLabel="Bundle"
      />

      <FilterSelect
        value={current.course}
        onChange={(v) => setParam("course", v)}
        options={[
          { value: "", label: "All courses" },
          ...courses,
        ]}
        ariaLabel="Course"
      />

      <FilterSelect
        value={current.board}
        onChange={(v) => setParam("board", v)}
        options={[
          { value: "", label: "All boards" },
          ...boards.map((b) => ({ value: b, label: b.toUpperCase() })),
        ]}
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
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  ariaLabel: string;
}) {
  // If the URL has a value not in our options (e.g. server validated it
  // away after a sibling filter changed), the <select> shows it as a
  // ghost option so the form remains controlled. We add the orphan
  // value to options invisibly to avoid React's "controlled select must
  // have matching option" warning, but the server already treats it as
  // null for filtering.
  const hasValue = value === "" || options.some((o) => o.value === value);
  const ghostOptions = hasValue ? options : [{ value, label: value }, ...options];
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #CBD5E1",
        fontSize: 13,
        background: "#fff",
        color: "#0F172A",
        fontFamily: "inherit",
        cursor: "pointer",
        maxWidth: 280,
      }}
    >
      {ghostOptions.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
