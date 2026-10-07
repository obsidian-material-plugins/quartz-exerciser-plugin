import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import type { QuartzConfig } from "@quartz-community/types";
import { applyExerciseIgnorePatterns } from "../src/prebuild";
import { emitExerciseArchives } from "../src/emitter";

const temporary: string[] = [];

const fixture = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "quartz-exerciser-"));
  temporary.push(root);
  const content = path.join(root, "content");
  const exercise = path.join(content, "assets", "exercises", "exercise-1");
  await fs.mkdir(path.join(exercise, "src"), { recursive: true });
  await fs.mkdir(path.join(exercise, "solutions"), { recursive: true });
  await fs.writeFile(path.join(exercise, "src", "Main.java"), "class Main {}\n");
  await fs.writeFile(path.join(exercise, "solutions", "Answer.java"), "class Answer {}\n");
  await fs.writeFile(
    path.join(exercise, ".exercise.yml"),
    `version: 1
files:
  hide-from-preview: []
  exclude-from-quartz: [solutions/**]
annotations:
  - source: src/Main.java
    line: 1
    text: Start here.
    inject-into-export: true
`,
  );
  return { root, content };
};

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => fs.rm(directory, { recursive: true })));
});

describe("Quartz integration boundaries", () => {
  it("adds excluded paths before the build glob", async () => {
    const { content } = await fixture();
    const config = { configuration: { ignorePatterns: [] } } as unknown as QuartzConfig;
    await applyExerciseIgnorePatterns(config, content);
    expect(config.configuration.ignorePatterns).toContain(
      "assets/exercises/exercise-1/solutions/**",
    );
    expect(config.configuration.ignorePatterns).toContain("assets/exercises/*/.exercise.yml");
  });

  it("emits a rooted ZIP without excluded files and injects export annotations", async () => {
    const { root, content } = await fixture();
    const output = path.join(root, "public");
    const emitted = await emitExerciseArchives(content, output);
    expect(emitted).toHaveLength(1);
    const archive = unzipSync(new Uint8Array(await fs.readFile(emitted[0]!)));
    expect(Object.keys(archive)).toEqual(["exercise-1/src/Main.java"]);
    expect(strFromU8(archive["exercise-1/src/Main.java"]!)).toContain("// Start here.");
  });
});
