import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { BuildCtx } from "@quartz-community/types";
import { EXERCISE_ROOT, parseExerciseFence } from "../src/config";
import { loadViewerPayload } from "../src/model";
import { globalSettingsNotePath, readGlobalSettingsNotePath } from "../src/settings-note";

describe("portable global settings filename", () => {
  it("uses the contracted basename with an index fallback", () => {
    expect(globalSettingsNotePath(null)).toBe("index.md");
    expect(
      globalSettingsNotePath({ contract: "book-structure/v2", globalNote: "Overview.md" }),
    ).toBe("Overview.md");
  });

  it("rejects unsupported and path-like conventions", () => {
    expect(() =>
      globalSettingsNotePath({ contract: "book-structure/v3", globalNote: "index.md" }),
    ).toThrow();
    expect(() =>
      globalSettingsNotePath({ contract: "book-structure/v2", globalNote: "../secret.md" }),
    ).toThrow();
  });

  it("reads the selected global note for preview limits and falls back to index", async () => {
    const content = await fs.mkdtemp(path.join(os.tmpdir(), "quartz-exerciser-settings-"));
    try {
      const exercise = path.join(content, EXERCISE_ROOT, "demo");
      await fs.mkdir(exercise, { recursive: true });
      await fs.writeFile(path.join(exercise, "sample.txt"), "hello");
      await fs.writeFile(
        path.join(content, "index.md"),
        "---\nexercise-preview-size-limit: 1\n---\n",
      );
      await fs.writeFile(
        path.join(content, "overview.md"),
        "---\nexercise-preview-size-limit: 10\n---\n",
      );
      const record = path.join(content, ".obsidian-to-quartz-workspace.json");
      await fs.writeFile(
        record,
        JSON.stringify({
          contract: "book-structure/v2",
          globalNote: "overview.md",
          localNotePattern: "index.md",
        }),
      );
      const ctx = {
        argv: { directory: content, serve: false },
        cfg: { configuration: { baseUrl: "example.test", locale: "en-US" } },
      } as BuildCtx;
      const fence = parseExerciseFence("exercise: demo")!;
      const options = { exerciseRoot: EXERCISE_ROOT, defaultPreviewLimitBytes: 50 };

      expect(await readGlobalSettingsNotePath(content)).toBe("overview.md");
      const custom = await loadViewerPayload(ctx, fence, options);
      if (!("files" in custom)) throw new Error("Expected an exercise payload");
      expect(custom.files[0]?.kind).toBe("text");

      await fs.unlink(record);
      expect(await readGlobalSettingsNotePath(content)).toBe("index.md");
      const fallback = await loadViewerPayload(ctx, fence, options);
      if (!("files" in fallback)) throw new Error("Expected an exercise payload");
      expect(fallback.files[0]?.kind).toBe("oversized");
    } finally {
      await fs.rm(content, { recursive: true, force: true });
    }
  });
});
