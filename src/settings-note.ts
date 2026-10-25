import fs from "node:fs/promises";
import path from "node:path";

const INVALID_NAME = /[\\/:*?"<>|]/;
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function globalSettingsNotePath(value: unknown): string {
  if (value === null || value === undefined) return "index.md";
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid settings-note convention");
  const record = value as Record<string, unknown>;
  if (record.contract !== "book-structure/v2")
    throw new Error("Unsupported settings-note convention");
  const name = record.globalNote;
  if (
    typeof name !== "string" ||
    !name.endsWith(".md") ||
    name.length <= 3 ||
    INVALID_NAME.test(name) ||
    [...name].some((character) => character.charCodeAt(0) < 32) ||
    RESERVED_NAME.test(name) ||
    /[. ]\.md$/.test(name)
  ) {
    throw new Error("Invalid global settings-note filename");
  }
  return name;
}

export async function readGlobalSettingsNotePath(contentRoot: string): Promise<string> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(contentRoot, ".obsidian-to-quartz-workspace.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "index.md";
    throw error;
  }
  return globalSettingsNotePath(JSON.parse(raw) as unknown);
}
