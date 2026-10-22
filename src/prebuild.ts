import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import type { QuartzConfig } from "@quartz-community/types";
import {
  EXERCISE_ROOT,
  MANIFEST_FILE,
  normalizeExerciseName,
  readExerciseManifest,
} from "./config";

/** Apply exercise exclusions before Quartz performs its initial content glob. */
export const applyExerciseIgnorePatterns = async (
  config: QuartzConfig | undefined,
  contentDirectory = "content",
): Promise<void> => {
  if (!config?.configuration) return;
  const exerciseRoot = path.resolve(contentDirectory, EXERCISE_ROOT);
  const ignorePatterns = config.configuration.ignorePatterns ?? [];
  config.configuration.ignorePatterns = ignorePatterns;
  const patterns = new Set(ignorePatterns);
  patterns.add(`${EXERCISE_ROOT}/*/${MANIFEST_FILE}`);
  let entries: Dirent[];
  try {
    entries = await fs.readdir(exerciseRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    entries = [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !normalizeExerciseName(entry.name)) continue;
    const manifest = await readExerciseManifest(path.join(exerciseRoot, entry.name));
    for (const excluded of manifest.files["exclude-from-quartz"]) {
      patterns.add(`${EXERCISE_ROOT}/${entry.name}/${excluded}`);
    }
  }
  ignorePatterns.splice(0, ignorePatterns.length, ...patterns);
};
