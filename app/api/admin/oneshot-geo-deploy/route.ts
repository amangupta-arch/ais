/**
 * EPHEMERAL one-shot deploy endpoint for the Class 10 Geography Ch.1 bundle.
 *
 *   Path: /api/admin/_oneshot-geo-deploy?token=<TOKEN>&action=<a>
 *
 *   action=seed-images  — fetches the 7 PNGs from public Drive URLs
 *                         and uploads to the lesson-images bucket at the
 *                         filenames the lesson YAMLs reference.
 *   action=load-content — reads the 4 EN + 4 Hinglish lesson YAMLs from
 *                         the deployed filesystem, validates against
 *                         lessonSchema, inserts lesson_turns and folds
 *                         the Hinglish docs into translations.hinglish.
 *
 * This file MUST be deleted immediately after a successful deploy run —
 * the token is one-shot and the file lives only on the
 * content/class10-geo-ch01 branch (never merged to main).
 *
 * Why a query-string token instead of the standard /api/yaml-jobs/* admin
 * gate: this session has no Supabase auth cookie, can't sign in, and the
 * MCP web_fetch_vercel_url tool is GET-only with no header support. The
 * token rotates with the route's deletion — Vercel logs may keep one
 * request's URL but the token is useless once the route is gone.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { NextResponse, type NextRequest } from "next/server";
import yaml from "js-yaml";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  lessonSchema,
  turnContent,
  turnXpReward,
  type LessonYaml,
} from "@/lib/content/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ONESHOT_TOKEN =
  "32649ac3bf52ef8535a939bb21abb4958bfbf0eadaaa7aadfc4ac6f7a9652557";

const BUNDLE_SLUG = "b-class-10-geography-ch01-resources-and-development";
/** Pilot scope: only Course 1's lesson YAMLs are loaded.
 *  Courses 2 (land-as-a-resource) and 3 (soil-as-a-resource) are
 *  authored on this branch but DELIBERATELY excluded until the
 *  operator says "take course 2 live" / "take course 3 live".
 *  The bundle row already declares all three courses with empty
 *  lesson stubs — the dashboard surfaces a "coming soon" feel
 *  for the unloaded ones, which is the desired UX for a phased
 *  rollout. */
const COURSE_SLUGS = ["resources-and-resource-planning"] as const;
const STORAGE_BUCKET = "lesson-images";

/** Drive file id → target filename. Seven PNGs from
 *  cowork_images/class10-geo-ch01-course1/ on operator's Drive. */
const DRIVE_FILES: Array<{ id: string; name: string }> = [
  { id: "1mD35XKQAm3CXcPyWgkzLIHTXzvCu6qmt", name: "c1l1-three-resources.png" },
  { id: "1omQsDbZqDGw3f2g-PREf7nIfoU2gCuR3", name: "c1l1-human-transforms.png" },
  { id: "1rVcjwXKqhXYphvVCcG86-uPbaDW-0mu1", name: "c1l2-renewable-vs-nonrenewable.png" },
  { id: "17bq4fCsdzLhB_mb-wkc0Scj6-IehYBYV", name: "c1l3-need-not-greed.png" },
  { id: "1GKpSU2ltQP6WfIOEC_aJIPgmwSdOaLT4", name: "c1l3-think-global-act-local.png" },
  { id: "1AGkoRTYL8J_oV1IxxuE9iHDY4Re_wxKd", name: "c1l4-ingredients-to-meal.png" },
  { id: "1VSk36_35ADM46SkNdivC0hB8_PfGCfuN", name: "c1l4-uneven-india.png" },
];

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL / SERVICE_ROLE_KEY missing.");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const action = url.searchParams.get("action") ?? "";

  if (token !== ONESHOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "bad token" }, { status: 401 });
  }

  try {
    if (action === "seed-images") {
      // Optional per-file mode keeps each request well under the
      // MCP gateway's ~15s timeout. Without ?image=, falls back
      // to parallelised all-7 mode (~5s).
      const singleImage = url.searchParams.get("image");
      return NextResponse.json(await seedImages(singleImage));
    }
    if (action === "load-content") {
      return NextResponse.json(await loadContent());
    }
    return NextResponse.json(
      { ok: false, error: "action must be 'seed-images' or 'load-content'" },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// ───────────────────── action=seed-images ────────────────────────

async function seedImages(singleImage: string | null) {
  const sb = admin();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const work = singleImage
    ? DRIVE_FILES.filter((f) => f.name === singleImage)
    : DRIVE_FILES;
  if (singleImage && work.length === 0) {
    return {
      ok: false,
      bucket: STORAGE_BUCKET,
      folder: BUNDLE_SLUG,
      error: `unknown image: ${singleImage}`,
      allowed: DRIVE_FILES.map((f) => f.name),
    };
  }

  // Parallelise — the original sequential loop exceeded the MCP
  // gateway's ~15s read timeout when called over Vercel SSO. With
  // Promise.all the 7 small PNGs land in roughly the time of the
  // slowest single fetch.
  const results = await Promise.all(
    work.map(async ({ id, name }) => {
      try {
        // Public Drive download. `confirm=t` skips the virus-scan
        // interstitial that Drive sometimes injects.
        const driveUrl = `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;
        const res = await fetch(driveUrl, { redirect: "follow" });
        if (!res.ok) throw new Error(`drive fetch ${res.status}`);
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
          // Drive interstitial leaked through — fall back to the
          // usercontent endpoint which is more direct.
          const fallback = `https://drive.usercontent.google.com/download?id=${id}&export=download&authuser=0&confirm=t`;
          const res2 = await fetch(fallback, { redirect: "follow" });
          if (!res2.ok) throw new Error(`drive fallback ${res2.status}`);
          const ct2 = res2.headers.get("content-type") ?? "";
          if (ct2.includes("text/html")) {
            throw new Error("drive returned HTML on both endpoints — file may not be public");
          }
          const bytes = await uploadPng(sb, url, key, name, res2);
          return { name, ok: true, bytes };
        }
        const bytes = await uploadPng(sb, url, key, name, res);
        return { name, ok: true, bytes };
      } catch (err) {
        return {
          name,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return {
    ok: results.every((r) => r.ok),
    bucket: STORAGE_BUCKET,
    folder: BUNDLE_SLUG,
    results,
  };
}

async function uploadPng(
  _sb: ReturnType<typeof admin>,
  supabaseUrl: string,
  serviceKey: string,
  name: string,
  res: Response,
): Promise<number> {
  const blob = await res.arrayBuffer();
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${BUNDLE_SLUG}/${name}`;
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: blob,
  });
  if (!up.ok) {
    const detail = await up.text().catch(() => "");
    throw new Error(`storage ${up.status}: ${detail.slice(0, 200)}`);
  }
  return blob.byteLength;
}

// ───────────────────── action=load-content ───────────────────────

const CONTENT_ROOT = join(process.cwd(), "supabase", "content");

type LessonFile = {
  path: string;          // for error messages
  courseSlug: string;    // canonical
  lessonSlug: string;
  orderIndex: number;
  doc: LessonYaml;
  lang?: string;
};

function readGeoLessons(): {
  canonical: LessonFile[];
  translations: LessonFile[];
  errors: string[];
} {
  const errors: string[] = [];
  const canonical: LessonFile[] = [];
  const translations: LessonFile[] = [];
  const re = /^(\d{2,})-([a-z0-9][a-z0-9-]*)\.ya?ml$/;

  for (const courseSlug of COURSE_SLUGS) {
    for (const [folder, lang] of [
      [courseSlug, undefined],
      [`${courseSlug}-hinglish`, "hinglish"],
    ] as const) {
      const dir = join(CONTENT_ROOT, folder);
      let files: string[];
      try {
        files = readdirSync(dir).filter(
          (f) => (f.endsWith(".yaml") || f.endsWith(".yml")) && !f.startsWith("_"),
        ).sort();
      } catch {
        errors.push(`${folder}/: not readable`);
        continue;
      }
      for (const file of files) {
        const match = file.match(re);
        if (!match) {
          errors.push(`${folder}/${file}: filename must match NN-<slug>.yaml`);
          continue;
        }
        const rel = `${folder}/${file}`;
        const raw = readFileSync(join(dir, file), "utf8");
        let parsed: unknown;
        try {
          parsed = yaml.load(raw);
        } catch (e) {
          errors.push(`${rel}: YAML parse — ${(e as Error).message}`);
          continue;
        }
        const v = lessonSchema.safeParse(parsed);
        if (!v.success) {
          errors.push(`${rel}: ${v.error.issues[0]?.message ?? "schema invalid"}`);
          continue;
        }
        const entry: LessonFile = {
          path: rel,
          courseSlug,
          lessonSlug: match[2]!,
          orderIndex: parseInt(match[1]!, 10),
          doc: v.data,
          ...(lang ? { lang } : {}),
        };
        if (lang) translations.push(entry);
        else canonical.push(entry);
      }
    }
  }
  return { canonical, translations, errors };
}

async function loadContent() {
  const { canonical, translations, errors: fileErrors } = readGeoLessons();
  if (fileErrors.length > 0) {
    return { ok: false, stage: "validate", errors: fileErrors };
  }

  const sb = admin();
  const runErrors: string[] = [];
  let lessonsLoaded = 0;
  let turnsLoaded = 0;
  let translationsLoaded = 0;

  // Resolve every course id up front.
  const courseIdBySlug = new Map<string, string>();
  for (const slug of COURSE_SLUGS) {
    const { data, error } = await sb
      .from("courses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) {
      return {
        ok: false,
        stage: "course-lookup",
        error: `course ${slug} not found: ${error?.message ?? "missing"}`,
      };
    }
    courseIdBySlug.set(slug, data.id as string);
  }

  // (course/lessonSlug) → lesson id
  const lessonIdByKey = new Map<string, string>();

  // ── canonical pass ──
  for (const lesson of canonical) {
    try {
      const courseId = courseIdBySlug.get(lesson.courseSlug)!;
      const { data: existing } = await sb
        .from("lessons")
        .select("translations")
        .eq("course_id", courseId)
        .eq("slug", lesson.lessonSlug)
        .maybeSingle();
      const existingTrans =
        (existing?.translations as Record<string, unknown> | null) ?? {};

      const translations: Record<string, unknown> = {
        ...existingTrans,
        en: {
          title: lesson.doc.title,
          ...(lesson.doc.subtitle ? { subtitle: lesson.doc.subtitle } : {}),
        },
      };

      const { data: lessonRow, error: upErr } = await sb
        .from("lessons")
        .upsert(
          {
            course_id: courseId,
            slug: lesson.lessonSlug,
            translations,
            order_index: lesson.orderIndex,
            estimated_minutes: lesson.doc.estimated_minutes,
            xp_reward: lesson.doc.xp_reward,
            format: "ai_chat",
            is_published: true,
          },
          { onConflict: "course_id,slug" },
        )
        .select("id")
        .single();
      if (upErr || !lessonRow) throw new Error(`upsert: ${upErr?.message}`);

      lessonIdByKey.set(
        `${lesson.courseSlug}/${lesson.lessonSlug}`,
        lessonRow.id as string,
      );

      const { error: delErr } = await sb
        .from("lesson_turns")
        .delete()
        .eq("lesson_id", lessonRow.id);
      if (delErr) throw new Error(`clear turns: ${delErr.message}`);

      const turnRows = lesson.doc.turns.map((turn, idx) => ({
        lesson_id: lessonRow.id as string,
        order_index: idx + 1,
        turn_type: turn.type,
        content: turnContent(turn),
        xp_reward: turnXpReward(turn),
        is_required: true,
      }));
      const { error: insErr } = await sb.from("lesson_turns").insert(turnRows);
      if (insErr) throw new Error(`insert turns: ${insErr.message}`);

      lessonsLoaded += 1;
      turnsLoaded += turnRows.length;
    } catch (e) {
      runErrors.push(`${lesson.path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── translation pass ──
  for (const t of translations) {
    if (!t.lang) continue;
    try {
      const courseId = courseIdBySlug.get(t.courseSlug)!;
      const key = `${t.courseSlug}/${t.lessonSlug}`;
      let lessonId = lessonIdByKey.get(key);
      if (!lessonId) {
        const { data, error } = await sb
          .from("lessons")
          .select("id")
          .eq("course_id", courseId)
          .eq("slug", t.lessonSlug)
          .maybeSingle();
        if (error) throw new Error(`lookup: ${error.message}`);
        if (!data) throw new Error(`canonical lesson missing`);
        lessonId = data.id as string;
      }

      const translatedTurns = t.doc.turns.map((turn, idx) => ({
        order_index: idx + 1,
        turn_type: turn.type,
        content: turnContent(turn),
        xp_reward: turnXpReward(turn),
      }));
      const langDoc: Record<string, unknown> = {
        title: t.doc.title,
        ...(t.doc.subtitle ? { subtitle: t.doc.subtitle } : {}),
        turns: translatedTurns,
      };

      const { data: cur, error: curErr } = await sb
        .from("lessons")
        .select("translations")
        .eq("id", lessonId)
        .single();
      if (curErr) throw new Error(`read translations: ${curErr.message}`);
      const merged = {
        ...((cur?.translations as Record<string, unknown> | null) ?? {}),
        [t.lang]: langDoc,
      };
      const { error: updErr } = await sb
        .from("lessons")
        .update({ translations: merged })
        .eq("id", lessonId);
      if (updErr) throw new Error(`update translations: ${updErr.message}`);

      translationsLoaded += 1;
    } catch (e) {
      runErrors.push(
        `${t.path} [${t.lang}]: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return {
    ok: runErrors.length === 0,
    canonical_lessons: lessonsLoaded,
    canonical_turns: turnsLoaded,
    translations_loaded: translationsLoaded,
    errors: runErrors,
  };
}
