/**
 * POST /api/yaml-jobs/generate
 *
 * Generates one lesson YAML, applies it to the DB, then runs the
 * ElevenLabs audio pipeline for that (lesson, language) inline.
 * Long-running (≈45–120s); needs maxDuration past Vercel Hobby's 10s.
 *
 * Response: NDJSON stream of progress events. One event per line:
 *   {"kind":"step","at":"...","message":"..."}
 *   {"kind":"audio:start","total":12,"voiceId":"...","model":"..."}
 *   {"kind":"audio:chunk","done":1,"total":12,"cacheHit":true,"bytes":0,"preview":"..."}
 *   {"kind":"audio:done","total":12,"hits":3,"misses":9,"failed":0,"bytesFromTts":...}
 *   {"kind":"result","ok":true,"attempts":1,"yamlPath":null,"diskNote":"...","audio":{...},"lesson":{...}}
 *
 * Validation errors before streaming starts (auth, bad body) are
 * returned as plain JSON with non-200 status.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { submitLessonYaml } from "@/app/update-yaml/actions";
import { LANGUAGE_OPTIONS } from "@/app/update-yaml/constants";
import { runAudioPipeline, type PipelineProgress } from "@/lib/audio/pipeline";
import { createClient } from "@/lib/supabase/server";
import { enumerateAllLessons } from "@/lib/yaml-generation/catalog";
import { loadEnYamlText } from "@/lib/yaml-generation/en-source";
import { GENERATOR_MODEL, generateLessonYaml } from "@/lib/yaml-generation/generate";
import { writeLessonYaml } from "@/lib/yaml-generation/persist";
import { loadBundlePriorContent } from "@/lib/yaml-generation/prior-content";

const ALLOWED_LANGS: ReadonlySet<string> = new Set(LANGUAGE_OPTIONS.map((l) => l.code));

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server.");
  }
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

type Body = {
  courseSlug?: string;
  lessonSlug?: string;
  language?: string;
  /** Free-text guidance from the author. Capped server-side to keep
   *  prompt size sane; longer notes go in docs/lesson-yaml-knowledge.md. */
  customInstructions?: string;
};

const CUSTOM_INSTRUCTIONS_MAX_CHARS = 4000;

export async function POST(req: Request) {
  // ---------- pre-stream validation ----------
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }
  const courseSlug = body.courseSlug?.trim();
  const lessonSlug = body.lessonSlug?.trim();
  const language = body.language?.trim() || "en";
  const customInstructionsRaw = (body.customInstructions ?? "").trim();
  const customInstructions = customInstructionsRaw.slice(0, CUSTOM_INSTRUCTIONS_MAX_CHARS);
  const customInstructionsTruncated =
    customInstructionsRaw.length > CUSTOM_INSTRUCTIONS_MAX_CHARS;

  if (!courseSlug || !lessonSlug) {
    return NextResponse.json(
      { ok: false, message: "Missing courseSlug or lessonSlug." },
      { status: 400 },
    );
  }
  if (!ALLOWED_LANGS.has(language)) {
    return NextResponse.json(
      { ok: false, message: `Unsupported language "${language}".` },
      { status: 400 },
    );
  }

  const entry = enumerateAllLessons().find(
    (e) => e.courseSlug === courseSlug && e.lessonSlug === lessonSlug,
  );
  if (!entry) {
    return NextResponse.json(
      { ok: false, message: `Unknown lesson: ${courseSlug}/${lessonSlug}` },
      { status: 404 },
    );
  }

  // ---------- streaming work ----------
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(enc.encode(JSON.stringify(event) + "\n"));
      };
      const step = (message: string) =>
        send({ kind: "step", at: new Date().toISOString(), message });
      const result = (event: Record<string, unknown>) =>
        send({ kind: "result", at: new Date().toISOString(), ...event });

      try {
        const admin = adminClient();
        step(`resolving course "${entry.courseSlug}" in DB…`);
        const { data: course, error: courseErr } = await admin
          .from("courses")
          .select("id")
          .eq("slug", entry.courseSlug)
          .maybeSingle();
        if (courseErr) {
          result({ ok: false, stage: "lookup", message: `course lookup: ${courseErr.message}` });
          controller.close();
          return;
        }
        if (!course) {
          result({
            ok: false,
            stage: "lookup",
            message: `Course "${entry.courseSlug}" not in DB. Run scripts/load-bundle-courses.ts first.`,
          });
          controller.close();
          return;
        }
        step(`course id ${(course.id as string).slice(0, 8)}…`);

        // Mark job running. Fail fast if the row can't be persisted —
        // otherwise downstream finalize() updates would silently target
        // a missing row and /yaml-status would never reflect the real
        // state.
        const startedAt = new Date().toISOString();
        const { error: upsertErr } = await admin.from("yaml_generation_jobs").upsert(
          {
            bundle_slug: entry.bundleSlug,
            course_slug: entry.courseSlug,
            course_title: entry.courseTitle,
            lesson_slug: entry.lessonSlug,
            lesson_title: entry.lessonTitle,
            lesson_index: entry.lessonIndex,
            language,
            status: "running",
            attempts: 0,
            model: GENERATOR_MODEL,
            yaml_path: null,
            error: null,
            started_at: startedAt,
            finished_at: null,
          },
          { onConflict: "course_slug,lesson_slug,language" },
        );
        if (upsertErr) {
          result({
            ok: false,
            stage: "record",
            message: `record job: ${upsertErr.message}`,
          });
          controller.close();
          return;
        }

        const finalize = async (fields: Record<string, unknown>) => {
          await admin
            .from("yaml_generation_jobs")
            .update({ ...fields, finished_at: new Date().toISOString() })
            .eq("course_slug", entry.courseSlug)
            .eq("lesson_slug", entry.lessonSlug)
            .eq("language", language);
        };

        // Prior-bundle context (EN-only — translations rely on the EN
        // base of the SAME lesson, not cross-lesson continuity).
        let priorContext: string | null = null;
        if (language === "en") {
          step("loading prior lessons in this bundle for continuity…");
          const prior = await loadBundlePriorContent(entry);
          if (prior.totalCount === 0) {
            step("no prior lessons in this bundle — nothing to carry over.");
          } else {
            const droppedNote =
              prior.droppedCount > 0
                ? ` (truncated: dropped ${prior.droppedCount} earliest to fit budget)`
                : "";
            step(
              `loaded ${prior.lessons.length}/${prior.totalCount} prior lessons · ${prior.approxTokens.toLocaleString()} approx tokens${droppedNote}`,
            );
            priorContext = prior.promptText;
          }
        }

        // EN reference for translations.
        let enReference: string | null = null;
        if (language !== "en") {
          step(`loading canonical EN reference for "${entry.lessonSlug}"…`);
          enReference = await loadEnYamlText(entry);
          if (!enReference) {
            const msg =
              "English YAML must exist before generating a translation. Generate the EN version first.";
            await finalize({ status: "failed", attempts: 0, error: msg });
            result({ ok: false, stage: "prerequisite", message: msg });
            controller.close();
            return;
          }
          step(`EN reference loaded (${enReference.length.toLocaleString()} chars)`);
        }

        if (customInstructions) {
          step(
            `custom instructions: ${customInstructions.length} chars added${
              customInstructionsTruncated
                ? ` (truncated from ${customInstructionsRaw.length})`
                : ""
            }`,
          );
        }

        // Generate.
        step(
          `calling ${GENERATOR_MODEL} (${language === "en" ? "fresh generation" : `${language} translation`})…`,
        );
        const gen = await generateLessonYaml({
          entry,
          language,
          enReference,
          customInstructions: customInstructions || null,
          priorContext,
        });
        if (!gen.ok) {
          await finalize({ status: "failed", attempts: gen.attempts, error: gen.message });
          result({
            ok: false,
            stage: "generate",
            message: gen.message,
            attempts: gen.attempts,
          });
          controller.close();
          return;
        }
        step(`YAML received & validated (${gen.attempts} attempt${gen.attempts === 1 ? "" : "s"})`);

        // Persist yaml_text early so it survives downstream failures.
        await admin
          .from("yaml_generation_jobs")
          .update({ attempts: gen.attempts, yaml_text: gen.yamlText })
          .eq("course_slug", entry.courseSlug)
          .eq("lesson_slug", entry.lessonSlug)
          .eq("language", language);

        // Disk write — best effort, skipped on Vercel.
        let yamlPath: string | null = null;
        let diskNote: string | null = null;
        if (process.env.VERCEL === "1") {
          diskNote = "skipped on Vercel (read-only fs); GH workflow will sync to repo.";
          step(diskNote);
        } else {
          try {
            yamlPath = writeLessonYaml(entry, language, gen.yamlText);
            step(`wrote ${yamlPath}`);
          } catch (e) {
            diskNote = `skipped: ${String(e)}`;
            step(diskNote);
          }
        }

        // Apply to DB.
        step(`applying to lesson_turns…`);
        const submit = await submitLessonYaml({
          courseId: course.id as string,
          yamlText: gen.yamlText,
          language,
          slug: entry.lessonSlug,
          orderIndex: entry.lessonIndex,
        });
        if (!submit.ok) {
          await finalize({
            status: "failed",
            attempts: gen.attempts,
            yaml_path: yamlPath,
            error: `db apply: ${submit.message}`,
          });
          result({
            ok: false,
            stage: "apply",
            message: submit.message,
            attempts: gen.attempts,
            yamlPath,
          });
          controller.close();
          return;
        }
        const lessonId = submit.lesson?.id;
        const turnCount = submit.lesson?.turn_count ?? 0;
        step(`applied: ${turnCount} turns → lesson ${lessonId?.slice(0, 8)}…`);

        // ---------- AUDIO PIPELINE ----------
        let audioSummary: Record<string, unknown> | null = null;
        if (lessonId) {
          const audio = await runAudioPipeline({
            lessonId,
            language,
            yamlText: gen.yamlText,
            onProgress: (e: PipelineProgress) => send(e),
          });
          audioSummary = {
            ok: audio.ok,
            total: audio.total,
            hits: audio.hits,
            misses: audio.misses,
            failed: audio.failed,
            bytesFromTts: audio.bytesFromTts,
            skipReason: audio.skipReason,
          };
        } else {
          send({
            kind: "audio:skipped",
            reason: "no lesson id returned from submitLessonYaml",
          });
          audioSummary = {
            ok: false,
            total: 0,
            hits: 0,
            misses: 0,
            failed: 0,
            bytesFromTts: 0,
            skipReason: "no_lesson_id",
          };
        }

        await finalize({
          status: "done",
          attempts: gen.attempts,
          yaml_path: yamlPath,
          error: diskNote,
        });

        result({
          ok: true,
          attempts: gen.attempts,
          yamlPath,
          diskNote,
          lesson: submit.lesson,
          audio: audioSummary,
        });
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ kind: "step", at: new Date().toISOString(), message: `unexpected: ${msg}` });
        result({ ok: false, stage: "unexpected", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
