type ClassValue = string | number | null | undefined | false | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue): void => {
    if (!v && v !== 0) return;
    if (Array.isArray(v)) v.forEach(walk);
    else out.push(String(v));
  };
  inputs.forEach(walk);
  return out.join(" ");
}

export function formatTier(tier: "free" | "basic" | "advanced"): string {
  if (tier === "free")  return "Free";
  if (tier === "basic") return "Basic";
  return "Advanced";
}

export function firstName(displayName: string | null | undefined): string {
  if (!displayName) return "there";
  const first = displayName.trim().split(/\s+/)[0];
  return first ?? "there";
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
