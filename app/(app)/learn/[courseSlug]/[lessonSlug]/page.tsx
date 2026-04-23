import Link from "next/link";

import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const dynamic = "force-dynamic";

export default async function LessonPlaceholder({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = await params;

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-10">
      <Link href={`/learn/${courseSlug}`} className="text-sm text-ink-500 hover:text-ink-800 transition-colors">← back to course</Link>
      <div className="mt-8 rounded-3xl border border-paper-200 bg-paper-100 shadow-paper p-8">
        <Eyebrow>phase 2</Eyebrow>
        <Display as="h1" size="md" className="mt-3">
          The <em className="italic font-normal">lesson player</em> lands soon.
        </Display>
        <p className="mt-4 text-ink-600 leading-relaxed">
          The chat walkthrough with Nova is Phase 2. This page is the slot where <span className="font-tabular">{courseSlug}</span> / <span className="font-tabular">{lessonSlug}</span> will open.
        </p>
      </div>
    </main>
  );
}
