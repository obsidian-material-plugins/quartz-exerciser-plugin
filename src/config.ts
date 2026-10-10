import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type {
  ExerciseAnnotation,
  ExerciseFenceConfig,
  ExerciseHighlight,
  ExerciseManifest,
  ExerciseOutputAssociation,
} from "./types";

export const EXERCISE_ROOT = "assets/exercises" as const;
export const MANIFEST_FILE = ".exercise.yml";
export const DEFAULT_PREVIEW_LIMIT_BYTES = 50 * 1024 * 1024;

const emptyManifest = (): ExerciseManifest => ({
  version: 1,
  files: { "hide-from-preview": [], "exclude-from-quartz": [] },
  preview: { "ignore-size-limit": false },
  outputs: [],
  highlights: [],
  annotations: [],
});

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap((item) => (asString(item) ? [asString(item)!] : [])) : [];

export const normalizeRelativePath = (value: string): string | null => {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split("/").some((segment) => segment === ".." || segment === "")
  ) {
    return null;
  }
  return normalized;
};

export const normalizeExerciseName = (value: unknown): string | null => {
  const name = asString(value);
  return name && /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(name) ? name : null;
};

const normalizePatterns = (value: unknown): string[] =>
  asStrings(value).flatMap((pattern) => {
    const clean = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
    if (
      clean.startsWith("/") ||
      clean.startsWith("!") ||
      /^[A-Za-z]:/.test(clean) ||
      clean.split("/").some((segment) => segment === ".." || segment === "")
    ) {
      return [];
    }
    return [clean];
  });

const normalizeOutputs = (value: unknown): ExerciseOutputAssociation[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asObject(item);
    const source = asString(record.source);
    const examples = Array.isArray(record.examples)
      ? record.examples.flatMap((example) => {
          const data = asObject(example);
          const type = asString(data.type);
          if (!type || !["normal", "stderr", "raw", "file"].includes(type)) return [];
          const contentFile = asString(data["content-file"]);
          const file = asString(data.file);
          if (contentFile && !normalizeRelativePath(contentFile)) return [];
          if (file && !normalizeRelativePath(file)) return [];
          return [
            {
              label: asString(data.label),
              type: type as "normal" | "stderr" | "raw" | "file",
              "content-file": contentFile,
              content: typeof data.content === "string" ? data.content : undefined,
              file,
              fallback: typeof data.fallback === "string" ? data.fallback : undefined,
            },
          ];
        })
      : [];
    const normalizedSource = source ? normalizeRelativePath(source) : null;
    return normalizedSource && examples.length > 0
      ? [{ source: normalizedSource, heading: asString(record.heading), examples }]
      : [];
  });
};

const normalizeHighlights = (value: unknown): ExerciseHighlight[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asObject(item);
    const source = asString(record.source);
    const normalizedSource = source ? normalizeRelativePath(source) : null;
    const ranges = Array.isArray(record.ranges)
      ? record.ranges.flatMap((range) => {
          const data = asObject(range);
          const lines = asString(data.lines);
          if (!lines || !/^\d+(?:-\d+)?$/.test(lines)) return [];
          const accent = asString(data.accent);
          return [
            {
              lines,
              note: asString(data.note),
              accent: accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : undefined,
            },
          ];
        })
      : [];
    return normalizedSource && ranges.length > 0 ? [{ source: normalizedSource, ranges }] : [];
  });
};

const normalizeAnnotations = (value: unknown): ExerciseAnnotation[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asObject(item);
    const source = asString(record.source);
    const normalizedSource = source ? normalizeRelativePath(source) : null;
    const line = typeof record.line === "number" ? Math.floor(record.line) : 0;
    const text = asString(record.text);
    return normalizedSource && line > 0 && text
      ? [
          {
            source: normalizedSource,
            line,
            text,
            "inject-into-export": record["inject-into-export"] === true,
          },
        ]
      : [];
  });
};

export const parseExerciseManifest = (source: string): ExerciseManifest => {
  const parsed = asObject(YAML.parse(source));
  const manifest = emptyManifest();
  const files = asObject(parsed.files);
  const preview = asObject(parsed.preview);
  manifest.files["hide-from-preview"] = normalizePatterns(files["hide-from-preview"]);
  manifest.files["exclude-from-quartz"] = normalizePatterns(files["exclude-from-quartz"]);
  manifest.preview["ignore-size-limit"] = preview["ignore-size-limit"] === true;
  manifest.outputs = normalizeOutputs(parsed.outputs);
  manifest.highlights = normalizeHighlights(parsed.highlights);
  manifest.annotations = normalizeAnnotations(parsed.annotations);
  return manifest;
};

export const readExerciseManifest = async (
  exerciseDirectory: string,
): Promise<ExerciseManifest> => {
  try {
    return parseExerciseManifest(
      await fs.readFile(path.join(exerciseDirectory, MANIFEST_FILE), "utf8"),
    );
  } catch {
    return emptyManifest();
  }
};

export const parseExerciseFence = (source: string): ExerciseFenceConfig | null => {
  try {
    const parsed = asObject(YAML.parse(source));
    const exercise = normalizeExerciseName(parsed.exercise);
    if (!exercise) return null;
    const entrypoint = asString(parsed.entrypoint);
    const normalizedEntrypoint = entrypoint ? normalizeRelativePath(entrypoint) : undefined;
    if (entrypoint && !normalizedEntrypoint) return null;
    return {
      exercise,
      layout: parsed.layout === "dropdown" ? "dropdown" : "ide",
      entrypoint: normalizedEntrypoint ?? undefined,
      "word-wrap": parsed["word-wrap"] !== false,
    };
  } catch {
    return null;
  }
};

export const parsePreviewLimit = (rootIndexSource: string, fallback: number): number => {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/m.exec(rootIndexSource);
  if (!match) return fallback;
  try {
    const frontmatter = asObject(YAML.parse(match[1]!));
    const raw = frontmatter["exercise-preview-size-limit"];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    if (typeof raw !== "string") return fallback;
    const size = /^\s*(\d+(?:\.\d+)?)\s*(KB|MB|GB)\s*$/i.exec(raw);
    if (!size) return fallback;
    const unit = size[2]!.toUpperCase();
    const multiplier = unit === "KB" ? 1024 : unit === "MB" ? 1024 ** 2 : 1024 ** 3;
    const result = Number(size[1]!) * multiplier;
    return Number.isFinite(result) && result > 0 ? Math.floor(result) : fallback;
  } catch {
    return fallback;
  }
};
