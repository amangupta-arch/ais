import Image from "next/image";
import { personaById, type Persona } from "@/lib/types";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-lg",
  lg: "h-14 w-14 text-2xl",
};

const sizePx: Record<Size, number> = { sm: 32, md: 40, lg: 56 };

function avatarUrl(id: Persona["id"]): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/tutor-avatars/${id}.svg`;
}

type Props = {
  personaId?: Persona["id"];
  size?: Size;
  className?: string;
  glyphOnly?: boolean;
};

export function TutorAvatar({ personaId = "nova", size = "md", className, glyphOnly }: Props) {
  const persona = personaById(personaId);
  const url = avatarUrl(persona.id);
  const px = sizePx[size];

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-paper-200 text-ink-700 font-serif overflow-hidden relative",
        sizeClass[size],
        className,
      )}
      aria-label={`${persona.name} avatar`}
    >
      {url && !glyphOnly ? (
        <Image
          src={url}
          alt={persona.name}
          width={px}
          height={px}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span aria-hidden>{persona.glyph}</span>
      )}
    </div>
  );
}
