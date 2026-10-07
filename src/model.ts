import fs from "node:fs/promises";
import path from "node:path";
import { minimatch } from "minimatch";
import type { BuildCtx } from "@quartz-community/types";
import {
  DEFAULT_PREVIEW_LIMIT_BYTES,
  EXERCISE_ROOT,
  MANIFEST_FILE,
  normalizeRelativePath,
  parsePreviewLimit,
  readExerciseManifest,
} from "./config";
import type {
  ExerciseAnnotation,
  ExerciseFenceConfig,
  ExerciseManifest,
  ExerciseViewerFile,
  ExerciseViewerPayload,
  QuartzExerciserOptions,
  ResolvedOutputAssociation,
} from "./types";

const textExtensions = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".json",
  ".kt",
  ".kts",
  ".md",
  ".mjs",
  ".php",
  ".properties",
  ".py",
  ".rb",
  ".rs",
  ".scala",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);
const images = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const audio = new Set([".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"]);
const video = new Set([".m4v", ".mov", ".mp4", ".ogv", ".webm"]);

const languages: Record<string, string> = {
  ".c": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".go": "go",
  ".h": "c",
  ".hpp": "cpp",
  ".html": "html",
  ".java": "java",
  ".js": "javascript",
  ".json": "json",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".md": "markdown",
  ".mjs": "javascript",
  ".php": "php",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".scala": "scala",
  ".sh": "bash",
  ".sql": "sql",
  ".toml": "toml",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
};

const mimeTypes: Record<string, string> = {
  ".aac": "audio/aac",
  ".avif": "image/avif",
  ".flac": "audio/flac",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".ogv": "video/ogg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

const posix = (value: string) => value.replace(/\\/g, "/");

export const matchesAny = (relativePath: string, patterns: string[]) =>
  patterns.some((pattern) => minimatch(relativePath, pattern, { dot: true, nocase: false }));

export const listExercisePaths = async (root: string): Promise<string[]> => {
  const result: string[] = [];
  const walk = async (directory: string, prefix = "") => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else if (entry.isFile() && relative !== MANIFEST_FILE) result.push(relative);
    }
  };
  await walk(root);
  return result;
};

const getBasePath = (ctx: BuildCtx): string => {
  if (ctx.argv.serve) return "";
  const configured = ctx.cfg.configuration.baseUrl;
  if (!configured) return "";
  try {
    const pathname = new URL(`https://${configured}`).pathname.replace(/\/$/, "");
    return pathname === "/" ? "" : pathname;
  } catch {
    return "";
  }
};

const classify = (filePath: string, size: number, limit: number, ignored: boolean) => {
  const extension = path.extname(filePath).toLowerCase();
  if (!ignored && size > limit) return { kind: "oversized" as const, mime: mimeTypes[extension] };
  if (images.has(extension)) return { kind: "image" as const, mime: mimeTypes[extension] };
  if (audio.has(extension)) return { kind: "audio" as const, mime: mimeTypes[extension] };
  if (video.has(extension)) return { kind: "video" as const, mime: mimeTypes[extension] };
  if (extension === ".pdf") return { kind: "pdf" as const, mime: mimeTypes[extension] };
  if (textExtensions.has(extension) || extension === "") {
    return {
      kind: "text" as const,
      language: languages[extension] ?? "plaintext",
      mime: "text/plain",
    };
  }
  return { kind: "binary" as const, mime: mimeTypes[extension] ?? "application/octet-stream" };
};

const resolveOutputs = async (
  exerciseDirectory: string,
  exerciseName: string,
  basePath: string,
  manifest: ExerciseManifest,
  localizedHeading: string,
): Promise<ResolvedOutputAssociation[]> => {
  const associations: ResolvedOutputAssociation[] = [];
  for (const association of manifest.outputs) {
    const examples: ResolvedOutputAssociation["examples"] = [];
    for (let index = 0; index < association.examples.length; index += 1) {
      const example = association.examples[index]!;
      let resolvedContent = example.content;
      if (example["content-file"]) {
        try {
          resolvedContent = await fs.readFile(
            path.join(exerciseDirectory, example["content-file"]),
            "utf8",
          );
        } catch {
          resolvedContent = example.fallback;
        }
      }
      let publicUrl: string | undefined;
      if (example.file) {
        publicUrl = `${basePath}/${EXERCISE_ROOT}/${encodeURIComponent(exerciseName)}/${example.file
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;
      }
      if (example.type !== "file" || publicUrl || resolvedContent) {
        examples.push({
          ...example,
          label: example.label ?? `Example ${index + 1}`,
          resolvedContent,
          publicUrl,
        });
      }
    }
    if (examples.length > 0) {
      associations.push({
        source: association.source,
        heading: association.heading ?? localizedHeading,
        examples,
      });
    }
  }
  return associations;
};

export const loadViewerPayload = async (
  ctx: BuildCtx,
  fence: ExerciseFenceConfig,
  options: QuartzExerciserOptions,
): Promise<ExerciseViewerPayload | { error: "invalid" | "missing" | "empty" }> => {
  if (options.exerciseRoot !== EXERCISE_ROOT) return { error: "invalid" };
  const contentRoot = path.resolve(ctx.argv.directory);
  const exerciseDirectory = path.resolve(contentRoot, EXERCISE_ROOT, fence.exercise);
  const expectedPrefix = `${path.resolve(contentRoot, EXERCISE_ROOT)}${path.sep}`;
  if (!exerciseDirectory.startsWith(expectedPrefix)) return { error: "invalid" };
  try {
    if (!(await fs.stat(exerciseDirectory)).isDirectory()) return { error: "missing" };
  } catch {
    return { error: "missing" };
  }

  const manifest = await readExerciseManifest(exerciseDirectory);
  const paths = (await listExercisePaths(exerciseDirectory)).filter(
    (relative) =>
      !matchesAny(relative, manifest.files["exclude-from-quartz"]) &&
      !matchesAny(relative, manifest.files["hide-from-preview"]),
  );
  if (paths.length === 0) return { error: "empty" };

  let previewLimit = options.defaultPreviewLimitBytes || DEFAULT_PREVIEW_LIMIT_BYTES;
  try {
    previewLimit = parsePreviewLimit(
      await fs.readFile(path.join(contentRoot, "index.md"), "utf8"),
      previewLimit,
    );
  } catch {
    // Safe fallback is already selected.
  }

  const basePath = getBasePath(ctx);
  const files: ExerciseViewerFile[] = [];
  for (const relative of paths) {
    const absolute = path.join(exerciseDirectory, relative);
    const stat = await fs.stat(absolute);
    const details = classify(
      relative,
      stat.size,
      previewLimit,
      manifest.preview["ignore-size-limit"],
    );
    const publicUrl = `${basePath}/${EXERCISE_ROOT}/${encodeURIComponent(fence.exercise)}/${relative
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    let content: string | undefined;
    if (details.kind === "text") {
      try {
        content = await fs.readFile(absolute, "utf8");
      } catch {
        content = undefined;
      }
    }
    files.push({
      path: relative,
      basename: path.posix.basename(posix(relative)),
      size: stat.size,
      ...details,
      content,
      publicUrl,
    });
  }

  const selected =
    (fence.entrypoint &&
      files.some((file) => file.path === fence.entrypoint) &&
      fence.entrypoint) ||
    files[0]!.path;
  const locale = ctx.cfg.configuration.locale?.toLowerCase().startsWith("fi") ? "fi" : "en";
  const outputs = await resolveOutputs(
    exerciseDirectory,
    fence.exercise,
    basePath,
    manifest,
    locale === "fi" ? "Odotettu tuloste" : "Expected output",
  );

  return {
    exercise: fence.exercise,
    layout: fence.layout,
    entrypoint: selected,
    wordWrap: fence["word-wrap"],
    zipUrl: `${basePath}/exercises/${encodeURIComponent(fence.exercise)}.zip`,
    locale,
    files,
    outputs,
    highlights: manifest.highlights,
    annotations: manifest.annotations,
  };
};

export const injectAnnotations = (
  source: Uint8Array,
  relativePath: string,
  annotations: ExerciseAnnotation[],
): Uint8Array => {
  const relevant = annotations
    .filter((annotation) => annotation.source === relativePath && annotation["inject-into-export"])
    .sort((a, b) => b.line - a.line);
  if (relevant.length === 0) return source;
  const extension = path.extname(relativePath).toLowerCase();
  const marker = [".py", ".rb", ".sh", ".yaml", ".yml"].includes(extension) ? "#" : "//";
  const text = new TextDecoder().decode(source);
  const lines = text.split(/\r?\n/);
  for (const annotation of relevant) {
    const index = Math.min(Math.max(annotation.line - 1, 0), lines.length);
    lines.splice(index, 0, `${marker} ${annotation.text}`);
  }
  return new TextEncoder().encode(lines.join("\n"));
};

export const safeManifestPath = (root: string, relative: string): string | null => {
  const normalized = normalizeRelativePath(relative);
  if (!normalized) return null;
  const resolved = path.resolve(root, ...normalized.split("/"));
  return resolved.startsWith(`${path.resolve(root)}${path.sep}`) ? resolved : null;
};
