import fs from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";
import type { FilePath, QuartzEmitterPlugin } from "@quartz-community/types";
import { EXERCISE_ROOT, readExerciseManifest } from "./config";
import { injectAnnotations, listExercisePaths, matchesAny } from "./model";
import type { QuartzExerciserOptions } from "./types";

const defaults: QuartzExerciserOptions = {
  exerciseRoot: EXERCISE_ROOT,
  defaultPreviewLimitBytes: 50 * 1024 * 1024,
};

export const emitExerciseArchives = async (
  contentRoot: string,
  outputRoot: string,
): Promise<FilePath[]> => {
  const root = path.resolve(contentRoot, EXERCISE_ROOT);
  const emitted: FilePath[] = [];
  let exercises;
  try {
    exercises = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return emitted;
  }
  for (const exercise of exercises.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!exercise.isDirectory() || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(exercise.name)) continue;
    const directory = path.join(root, exercise.name);
    const manifest = await readExerciseManifest(directory);
    const archiveEntries: Record<string, Uint8Array> = {};
    for (const relative of await listExercisePaths(directory)) {
      if (matchesAny(relative, manifest.files["exclude-from-quartz"])) continue;
      const source = new Uint8Array(
        await fs.readFile(path.join(directory, ...relative.split("/"))),
      );
      archiveEntries[`${exercise.name}/${relative}`] = injectAnnotations(
        source,
        relative,
        manifest.annotations,
      );
    }
    const destination = path.join(outputRoot, "exercises", `${exercise.name}.zip`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, zipSync(archiveEntries, { level: 6 }));
    emitted.push(destination.replace(/\\/g, "/") as FilePath);
  }
  return emitted;
};

export const emitter: QuartzEmitterPlugin<Partial<QuartzExerciserOptions>> = (userOptions) => {
  const options = { ...defaults, ...userOptions };
  if (options.exerciseRoot !== EXERCISE_ROOT) options.exerciseRoot = EXERCISE_ROOT;
  return {
    name: "ExerciseArchiveEmitter",
    async emit(ctx) {
      return emitExerciseArchives(ctx.argv.directory, ctx.argv.output);
    },
    async *partialEmit(ctx) {
      for (const filePath of await emitExerciseArchives(ctx.argv.directory, ctx.argv.output)) {
        yield filePath;
      }
    },
  };
};
