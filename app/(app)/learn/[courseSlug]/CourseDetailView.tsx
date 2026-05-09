"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Flame,
  Lock,
  Play,
} from "lucide-react";

import {
  courseDescription,
  courseSubtitle,
  courseTitle,
  lessonSubtitle,
  lessonTitle,
} from "@/lib/types";
import type { Course, Lesson, UserLessonProgress } from "@/lib/types";
import { formatTier } from "@/lib/utils";

type ProgressMap = Record<string, UserLessonProgress>;

type Props = {
  course: Course;
  lessons: Lesson[];
  progByLesson: ProgressMap;
  lang: string;
  locked: boolean;
  streak: number;
};

type Hue = "indigo" | "moss" | "saffron" | "coral" | "ocean" | "plum";

function hueForGradient(g: string | null | undefined): Hue {
  switch (g) {
    case "ember": return "saffron";
    case "moss":  return "moss";
    case "plum":  return "plum";
    case "ocean": return "ocean";
    case "coral": return "coral";
    case "paper": return "indigo";
    default:      return "indigo";
  }
}

export default function CourseDetailView({
  course, lessons, progByLesson, lang, locked, streak,
}: Props) {
  const heroHue = hueForGradient(course.cover_gradient);

  const totalXp = useMemo(
    () => lessons.reduce((s, l) => s + l.xp_reward, 0),
    [lessons],
  );
  const earnedXp = useMemo(
    () => lessons.reduce((s, l) => s + (progByLesson[l.id]?.xp_earned ?? 0), 0),
    [lessons, progByLesson],
  );
  const completedCount = useMemo(
    () => lessons.filter((l) => progByLesson[l.id]?.status === "completed").length,
    [lessons, progByLesson],
  );
  const currentIdx = useMemo(() => {
    for (let i = 0; i < lessons.length; i++) {
      if (progByLesson[lessons[i]!.id]?.status !== "completed") return i;
    }
    return -1;
  }, [lessons, progByLesson]);
  const currentLesson = currentIdx >= 0 ? lessons[currentIdx] ?? null : null;

  // Hero parallax + sticky title fade
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 240], [0, -56]);
  const heroOpacity = useTransform(scrollY, [0, 220], [1, 0.55]);
  const titleOpacity = useTransform(scrollY, [120, 220], [0, 1]);

  // XP counter spring
  const xpSpring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.6 });
  const [displayedXp, setDisplayedXp] = useState(0);
  useEffect(() => {
    xpSpring.set(earnedXp);
  }, [xpSpring, earnedXp]);
  useMotionValueEvent(xpSpring, "change", (v) => {
    setDisplayedXp(Math.round(v));
  });

  const progressPct = totalXp > 0 ? (earnedXp / totalXp) * 100 : 0;

  // Accordion: current lesson is auto-expanded by default.
  const [expandedId, setExpandedId] = useState<string | null>(currentLesson?.id ?? null);

  return (
    <main
      className="lm-page"
      style={{ paddingBottom: currentLesson && !locked ? 100 : 56 }}
    >
      {/* ---------- Sticky top bar ---------- */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(247, 245, 240, 0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--border-soft)",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Link
          href="/learn"
          aria-label="Back to library"
          className="inline-flex items-center justify-center"
          style={{ width: 40, height: 40, borderRadius: "var(--r-2)", color: "var(--text-2)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <motion.div
          style={{
            flex: 1,
            opacity: titleOpacity,
            fontWeight: 700,
            fontSize: 16,
            color: "var(--text)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {courseTitle(course, lang)}
        </motion.div>
        {streak > 0 ? (
          <span
            className="inline-flex items-center"
            style={{
              gap: 4,
              padding: "6px 10px",
              borderRadius: "var(--r-pill)",
              fontWeight: 700,
              fontSize: 14,
              color: "var(--saffron-deep)",
            }}
          >
            <Flame className="h-4 w-4" />
            <span className="lm-tabular">{streak}</span>
          </span>
        ) : (
          <span style={{ width: 40, height: 40 }} aria-hidden />
        )}
      </div>

      <div className="mx-auto" style={{ maxWidth: 640, padding: "16px 20px 0" }}>
        {/* ---------- Hero (parallax) ---------- */}
        <motion.section
          style={{
            position: "relative",
            borderRadius: "var(--r-5)",
            padding: "24px 24px 28px",
            color: "#fff",
            background: `linear-gradient(135deg, var(--${heroHue}-deep), var(--plum-deep))`,
            overflow: "hidden",
            y: heroY,
            opacity: heroOpacity,
            boxShadow: "var(--shadow-2)",
          }}
        >
          {/* Concentric rings on right side */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "50%",
              right: -50,
              transform: "translateY(-50%)",
              width: 240,
              height: 240,
              pointerEvents: "none",
            }}
          >
            <svg viewBox="0 0 240 240" width="240" height="240">
              <circle cx="120" cy="120" r="110" fill="none" stroke="rgba(255,255,255,0.16)" />
              <circle cx="120" cy="120" r="84"  fill="none" stroke="rgba(255,255,255,0.18)" />
              <circle cx="120" cy="120" r="58"  fill="none" stroke="rgba(255,255,255,0.20)" />
              <circle cx="120" cy="120" r="34"  fill="none" stroke="rgba(255,255,255,0.22)" />
              <circle cx="120" cy="120" r="14" fill="rgba(255,255,255,0.55)" />
            </svg>
          </div>

          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {formatTier(course.plan_tier)} · COURSE{" "}
            {(course.order_index + 1).toString().padStart(2, "0")}
          </span>
          <h1
            className="lm-serif"
            style={{
              marginTop: 14,
              fontSize: 40,
              lineHeight: 1.05,
              maxWidth: "82%",
              position: "relative",
            }}
          >
            {courseTitle(course, lang)}
          </h1>
        </motion.section>

        {/* ---------- Subtitle + description ---------- */}
        {courseSubtitle(course, lang) ? (
          <p
            className="lm-serif"
            style={{
              marginTop: 24,
              fontSize: 22,
              fontStyle: "italic",
              fontWeight: 600,
              lineHeight: 1.25,
              color: "var(--text)",
            }}
          >
            {courseSubtitle(course, lang)}
          </p>
        ) : null}
        {courseDescription(course, lang) ? (
          <p
            style={{
              marginTop: 8,
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--text-2)",
            }}
          >
            {courseDescription(course, lang)}
          </p>
        ) : null}

        {/* ---------- XP card ---------- */}
        <section
          className="lm-card"
          style={{ marginTop: 20, padding: 16 }}
        >
          <div className="flex items-center" style={{ gap: 16 }}>
            <div
              className="lm-serif lm-tabular"
              style={{
                fontSize: 32,
                lineHeight: 1,
                color: "var(--indigo-deep)",
                flexShrink: 0,
              }}
            >
              {displayedXp}
              <span style={{ fontSize: 14, color: "var(--text-3)" }}>
                /{totalXp}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {completedCount} of {lessons.length} lessons
              </p>
              <div
                style={{
                  marginTop: 6,
                  height: 8,
                  borderRadius: "var(--r-pill)",
                  background: "var(--bg-soft)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1, ease: [0, 0, 0.2, 1], delay: 0.25 }}
                  style={{
                    height: "100%",
                    background: "linear-gradient(90deg, var(--moss), var(--indigo))",
                    borderRadius: "var(--r-pill)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Shimmer */}
                  <motion.div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                      pointerEvents: "none",
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
                  />
                </motion.div>
              </div>
            </div>
            {streak > 0 ? (
              <span
                className="inline-flex items-center"
                style={{
                  gap: 4,
                  color: "var(--saffron-deep)",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                <Flame className="h-4 w-4" />
                <span className="lm-tabular">{streak}</span>
              </span>
            ) : null}
          </div>
        </section>

        {/* ---------- Course-locked banner (tier gate) ---------- */}
        {locked ? (
          <section className="lm-card" style={{ marginTop: 24, padding: 24 }}>
            <p className="lm-eyebrow">locked</p>
            <p
              className="lm-serif"
              style={{ marginTop: 8, fontSize: 22, lineHeight: 1.25, color: "var(--text)" }}
            >
              This course is on the {formatTier(course.plan_tier)} plan.
            </p>
            <p
              style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: "var(--text-2)" }}
            >
              Plans open in Phase 2. For now, the starters are yours.
            </p>
            <div style={{ marginTop: 20 }}>
              <Link href="/learn" className="lm-btn lm-btn--secondary lm-btn--sm">
                Browse starters
              </Link>
            </div>
          </section>
        ) : null}

        {/* ---------- Eyebrow ---------- */}
        <p className="lm-eyebrow" style={{ marginTop: 28 }}>
          lessons in order
        </p>

        {/* ---------- Timeline ---------- */}
        {lessons.length === 0 ? (
          <p style={{ marginTop: 12, fontSize: 14, color: "var(--text-2)" }}>
            Lessons are being authored. Check back soon.
          </p>
        ) : (
          <ol
            style={{
              marginTop: 12,
              listStyle: "none",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {lessons.map((l, i) => {
              const p = progByLesson[l.id];
              const completed = p?.status === "completed";
              const isCurrent = i === currentIdx;
              const lockedBySequence = currentIdx >= 0 && i > currentIdx;
              const expanded = expandedId === l.id;
              const prevCompleted =
                i > 0 && progByLesson[lessons[i - 1]!.id]?.status === "completed";
              return (
                <LessonRow
                  key={l.id}
                  course={course}
                  lesson={l}
                  index={i}
                  completed={completed}
                  isCurrent={isCurrent}
                  isLockedByTier={locked}
                  isLockedBySequence={lockedBySequence}
                  expanded={expanded}
                  prevCompleted={prevCompleted}
                  isFirst={i === 0}
                  isLast={i === lessons.length - 1}
                  lang={lang}
                  onToggle={() => setExpandedId(expanded ? null : l.id)}
                />
              );
            })}
          </ol>
        )}
      </div>

      {/* ---------- Sticky resume CTA (bobbing) ---------- */}
      {currentLesson && !locked ? (
        <motion.div
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 40,
            maxWidth: 608,
            margin: "0 auto",
          }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Link
            href={`/learn/${course.slug}/${currentLesson.slug}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 20px",
              borderRadius: "var(--r-pill)",
              background:
                "linear-gradient(90deg, var(--indigo-deep), var(--plum))",
              color: "#fff",
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(46, 39, 122, 0.35)",
            }}
          >
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: "rgba(255,255,255,0.18)",
                flexShrink: 0,
              }}
            >
              <Play className="h-4 w-4" style={{ marginLeft: 2 }} />
            </span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 16, minWidth: 0 }}>
              Continue · lesson{" "}
              <span className="lm-tabular">
                {(currentIdx + 1).toString().padStart(2, "0")}
              </span>
            </span>
            <span
              className="lm-mono lm-tabular"
              style={{ fontSize: 13, opacity: 0.85, flexShrink: 0 }}
            >
              +{currentLesson.xp_reward} XP
            </span>
          </Link>
        </motion.div>
      ) : null}
    </main>
  );
}

function LessonRow({
  course, lesson, index, completed, isCurrent,
  isLockedByTier, isLockedBySequence, expanded,
  prevCompleted, isFirst, isLast, lang, onToggle,
}: {
  course: Course;
  lesson: Lesson;
  index: number;
  completed: boolean;
  isCurrent: boolean;
  isLockedByTier: boolean;
  isLockedBySequence: boolean;
  expanded: boolean;
  prevCompleted: boolean;
  isFirst: boolean;
  isLast: boolean;
  lang: string;
  onToggle: () => void;
}) {
  void index;
  const isLocked = isLockedByTier || isLockedBySequence;
  const title = lessonTitle(lesson, lang);
  const subtitle = lessonSubtitle(lesson, lang);
  const href = `/learn/${course.slug}/${lesson.slug}`;
  const topLineColor = prevCompleted ? "var(--moss)" : "var(--ink-7)";
  const bottomLineColor = completed ? "var(--moss)" : "var(--ink-7)";

  // ---------- Spine node ----------
  const nodeBg = completed
    ? "var(--moss)"
    : isCurrent
    ? "var(--indigo-soft)"
    : "var(--surface)";
  const nodeBorder = completed
    ? "1px solid var(--moss-deep)"
    : isCurrent
    ? "1px solid var(--indigo)"
    : "1px solid var(--border)";
  const nodeColor = completed
    ? "#fff"
    : isCurrent
    ? "var(--indigo-deep)"
    : "var(--text-4)";

  const node = (
    <motion.div
      style={{
        position: "relative",
        zIndex: 1,
        width: 36,
        height: 36,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: nodeBg,
        border: nodeBorder,
        color: nodeColor,
      }}
      animate={
        isCurrent
          ? {
              boxShadow: [
                "0 0 0 0 rgba(79, 70, 186, 0.45)",
                "0 0 0 12px rgba(79, 70, 186, 0)",
                "0 0 0 0 rgba(79, 70, 186, 0)",
              ],
            }
          : { boxShadow: "0 0 0 0 rgba(79, 70, 186, 0)" }
      }
      transition={
        isCurrent
          ? { duration: 2.2, repeat: Infinity, ease: "easeOut" }
          : undefined
      }
    >
      {completed ? (
        <Check className="h-4 w-4" />
      ) : isCurrent ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 2,
            height: 14,
          }}
          aria-hidden
        >
          <Bar duration={1.1} from="30%" to="90%" />
          <Bar duration={1.4} from="60%" to="30%" />
          <Bar duration={1.7} from="80%" to="40%" />
        </div>
      ) : (
        <Lock className="h-3.5 w-3.5" />
      )}
    </motion.div>
  );

  // ---------- Card content ----------
  const meta = (
    <div
      className="flex items-center"
      style={{ gap: 8, fontSize: 12, color: "var(--text-3)", marginTop: 6 }}
    >
      <span className="lm-mono lm-tabular">{lesson.estimated_minutes}m</span>
      <span style={{ color: "var(--border-strong)" }}>·</span>
      <span
        className="lm-mono"
        style={{ color: "var(--saffron-deep)", fontWeight: 700 }}
      >
        +{lesson.xp_reward}xp
      </span>
      {completed ? (
        <>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span
            className="lm-mono"
            style={{ color: "var(--moss-deep)", fontWeight: 700 }}
          >
            done
          </span>
        </>
      ) : isCurrent ? (
        <>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span
            className="lm-mono"
            style={{ color: "var(--indigo)", fontWeight: 700 }}
          >
            continue ›
          </span>
        </>
      ) : null}
    </div>
  );

  const trailingIcon = (() => {
    if (isLocked && !completed && !isCurrent) {
      return <Lock className="h-4 w-4" style={{ color: "var(--text-4)" }} />;
    }
    if (expanded) {
      return <ChevronDown className="h-4 w-4" style={{ color: "var(--indigo)" }} />;
    }
    return (
      <ArrowRight
        className="h-4 w-4"
        style={{ color: isCurrent ? "var(--indigo)" : "var(--text-4)" }}
      />
    );
  })();

  const headerRow = (
    <div className="flex items-center" style={{ gap: 12 }}>
      <p
        className="lm-serif"
        style={{
          flex: 1,
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1.25,
          minWidth: 0,
          color:
            isLocked && !completed && !isCurrent ? "var(--text-3)" : "var(--text)",
          textDecoration: completed ? "line-through" : "none",
          textDecorationThickness: completed ? "1px" : undefined,
          textDecorationColor: completed ? "var(--text-3)" : undefined,
        }}
      >
        {title}
      </p>
      <span style={{ flexShrink: 0 }}>{trailingIcon}</span>
    </div>
  );

  const cardBg = isCurrent ? "var(--indigo-soft)" : "var(--surface)";
  const cardBorder = isCurrent ? "1px solid var(--indigo)" : "1px solid var(--border)";

  const interactiveCardProps = {
    role: "button" as const,
    tabIndex: 0,
    onClick: onToggle,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    "aria-expanded": expanded,
  };

  const inner = (
    <>
      {headerRow}
      {meta}
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingTop: 12 }}>
              {subtitle ? (
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "var(--text-2)",
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
              <Link
                href={href}
                onClick={(e) => e.stopPropagation()}
                className={
                  isCurrent
                    ? "lm-btn lm-btn--accent lm-btn--full"
                    : "lm-btn lm-btn--secondary lm-btn--full"
                }
                style={{ marginTop: 14 }}
              >
                {isCurrent ? (
                  <>
                    Start lesson
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>Replay lesson</>
                )}
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );

  // Tier-locked OR sequence-locked rows are visual only — no expand, no
  // navigation. Tier-locked completed/current rows still show their progress
  // state (strikethrough, waveform), but never expose the lesson Link.
  const card = isLocked ? (
    <div
      className="lm-card"
      style={{
        padding: 14,
        opacity: isLockedBySequence && !completed && !isCurrent ? 0.55 : 1,
        background: cardBg,
        border: cardBorder,
      }}
    >
      {headerRow}
      {meta}
    </div>
  ) : (
    <div
      className="lm-card"
      style={{
        padding: 14,
        cursor: "pointer",
        background: cardBg,
        border: cardBorder,
        boxShadow: isCurrent ? "0 0 0 3px rgba(79, 70, 186, 0.10)" : "none",
        transition: "box-shadow 160ms",
      }}
      {...interactiveCardProps}
    >
      {inner}
    </div>
  );

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr",
        gap: 16,
        position: "relative",
        paddingBottom: isLast ? 0 : 12,
      }}
    >
      {/* spine column */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {!isFirst ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              height: 22,
              width: 2,
              background: topLineColor,
            }}
          />
        ) : null}
        <div style={{ marginTop: 6 }}>{node}</div>
        {!isLast ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 42,
              bottom: 0,
              width: 2,
              background: bottomLineColor,
            }}
          />
        ) : null}
      </div>

      {/* card */}
      {card}
    </li>
  );
}

function Bar({ duration, from, to }: { duration: number; from: string; to: string }) {
  return (
    <motion.span
      style={{
        width: 3,
        background: "currentColor",
        borderRadius: 2,
        display: "block",
      }}
      animate={{ height: [from, to, from] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
