// Meta CAPI requires PII fields to be lowercase-trimmed, then
// SHA-256 hex hashed before transmission. Phones additionally need
// to be digits-only with country-code prefix (no leading +).
//
// Spec: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters

import { createHash } from "node:crypto";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const normalised = email.trim().toLowerCase();
  if (!normalised) return undefined;
  return sha256Hex(normalised);
}

export function hashPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  // Strip everything that isn't a digit. If the result is a bare
  // 10-digit Indian mobile, prefix the country code so Meta can
  // dedupe with WhatsApp/Instagram identities (which always store
  // E.164-style).
  let digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = "91" + digits;
  return sha256Hex(digits);
}

export function hashName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const normalised = name.trim().toLowerCase();
  if (!normalised) return undefined;
  return sha256Hex(normalised);
}
