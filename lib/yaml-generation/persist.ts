/** Writes a generated lesson YAML to the canonical disk path. Creates
 *  the course folder (and the -<lang> sibling for translations) if it
 *  doesn't exist yet. Returns the absolute path so the caller can
 *  store it on the job row.
 *
 * Server-only.
 */

import { mkdirSync, writeFileSync } from "node:fs";

import {
  courseFolderPath,
  lessonYamlPath,
  type LessonEntry,
} from "./catalog";

export function writeLessonYaml(
  entry: LessonEntry,
  language: string,
  yamlText: string,
): string {
  const folder = courseFolderPath(entry.courseSlug, language);
  mkdirSync(folder, { recursive: true });
  const path = lessonYamlPath(entry, language);
  // Trailing newline keeps git diffs clean.
  writeFileSync(path, yamlText.endsWith("\n") ? yamlText : `${yamlText}\n`, "utf8");
  return path;
}
