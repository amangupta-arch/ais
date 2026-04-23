import Link from "next/link";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 pt-24 pb-24 min-h-[100dvh] flex flex-col justify-center">
      <Eyebrow number="404">not found</Eyebrow>
      <Display as="h1" size="lg" className="mt-3">
        A path that <em className="italic font-normal">doesn't exist</em>.
      </Display>
      <p className="mt-4 text-ink-600">It happens. Let's get you back.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/home" size="md">Home</ButtonLink>
        <Link href="/" className="inline-flex items-center h-11 px-4 text-ink-600 hover:text-ink-900">
          Landing
        </Link>
      </div>
    </main>
  );
}
