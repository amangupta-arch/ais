// Dynamic label for the primary "advance" button after a turn's gate
// clears. Replaces the universal "Continue" with 2–3 word phrases that
// match the turn type and the user's just-completed action — so the
// lesson reads like a tutor reacting, not a slideshow with a Next button.
//
// Pick is deterministic per (turn.id) — same turn always gets the same
// label, but adjacent turns of the same type vary. The map is closed-set
// per turn type so authors can scan and tune voice.

const LABELS: Record<string, readonly string[]> = {
  tutor_message: ["Tell me more", "Keep going", "Got it", "I'm with you", "Onward"],
  mcq: ["Locked in", "Nice — onward", "Got it"],
  fill_in_the_blank: ["Filled in", "Locked in", "Onward"],
  drag_to_reorder: ["Order set", "Looks right", "Locked in"],
  tap_to_match: ["All matched", "Pairs set", "Onward"],
  ai_conversation: ["Wrap it up", "Done chatting", "Onward"],
  media: ["Got it", "Onward"],
  exercise: ["Logged it", "Onward", "Done"],
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function continueLabel(turnType: string, turnId: string): string {
  const opts = LABELS[turnType];
  if (!opts || opts.length === 0) return "Continue";
  return opts[hashStr(turnId) % opts.length] ?? "Continue";
}
