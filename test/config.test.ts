import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW_LIMIT_BYTES,
  normalizeExerciseName,
  parseExerciseFence,
  parseExerciseManifest,
  parsePreviewLimit,
} from "../src/config";

describe("exercise configuration", () => {
  it("normalizes a valid fence and rejects traversal", () => {
    expect(
      parseExerciseFence("exercise: exercise-1\nlayout: dropdown\nentrypoint: src/Main.java"),
    ).toEqual({
      exercise: "exercise-1",
      layout: "dropdown",
      entrypoint: "src/Main.java",
      "word-wrap": true,
    });
    expect(parseExerciseFence("exercise: ../../private")).toBeNull();
    expect(parseExerciseFence("exercise: exercise-1\nentrypoint: ../../secret")).toBeNull();
  });

  it("accepts underscore-prefixed template exercises without accepting paths", () => {
    expect(normalizeExerciseName("_template-exercise-1")).toBe("_template-exercise-1");
    expect(parseExerciseFence("exercise: _template-exercise-1")).toEqual({
      exercise: "_template-exercise-1",
      layout: "ide",
      entrypoint: undefined,
      "word-wrap": true,
    });
    expect(normalizeExerciseName(".hidden")).toBeNull();
    expect(normalizeExerciseName("../escape")).toBeNull();
    expect(normalizeExerciseName("nested/exercise")).toBeNull();
    expect(normalizeExerciseName("C:\\exercise")).toBeNull();
  });

  it("uses 50 MB when root metadata is absent or malformed", () => {
    expect(parsePreviewLimit("# Course", DEFAULT_PREVIEW_LIMIT_BYTES)).toBe(
      DEFAULT_PREVIEW_LIMIT_BYTES,
    );
    expect(
      parsePreviewLimit(
        "---\nexercise-preview-size-limit: definitely-large\n---\n",
        DEFAULT_PREVIEW_LIMIT_BYTES,
      ),
    ).toBe(DEFAULT_PREVIEW_LIMIT_BYTES);
    expect(parsePreviewLimit("---\nexercise-preview-size-limit: 25 MB\n---\n", 1)).toBe(
      25 * 1024 * 1024,
    );
  });

  it("keeps safe policies and drops escaping patterns", () => {
    const manifest = parseExerciseManifest(`
version: 1
files:
  hide-from-preview: [outputs/**]
  exclude-from-quartz: [solutions/**, ../../outside]
preview:
  ignore-size-limit: true
`);
    expect(manifest.files["hide-from-preview"]).toEqual(["outputs/**"]);
    expect(manifest.files["exclude-from-quartz"]).toEqual(["solutions/**"]);
    expect(manifest.preview["ignore-size-limit"]).toBe(true);
  });
});
