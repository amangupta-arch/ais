/** GET /api/yaml-jobs/list — small read-only endpoint the /yaml-generate
 *  client polls every 3s while a generation is in flight. Bypasses RLS
 *  via the service-role key, returns the full jobs table. Public.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ jobs: [] });
  }
  const admin = createServiceClient(url, key, { auth: { persistSession: false } });
  const { data } = await admin
    .from("yaml_generation_jobs")
    .select(
      "course_slug, lesson_slug, language, status, attempts, started_at, finished_at, yaml_path, error, model",
    );
  return NextResponse.json({ jobs: data ?? [] });
}
