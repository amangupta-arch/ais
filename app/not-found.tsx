import Link from "next/link";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 pt-24 pb-24 min-h-[100dvh] flex flex-col justify-center">
      <Eyebrow number="404">not found</Eyebrow>
      <Display as="h1" size="lg" className="mt-2">A path that doesn't exist.</Display>
      <p className="mt-3 text-ink-700">It happens. Let's get you back.</p>
      <div className="mt-6 flex gap-3">
        <ButtonLink href="/home" size="md">Home</ButtonLink>
        <Link href="/" className="inline-flex items-center h-10 px-4 text-ink-600 hover:text-ink-900 transition-colors duration-150 ease-out">
          Landing
        </Link>
      </div>
    </main>
  );
}
