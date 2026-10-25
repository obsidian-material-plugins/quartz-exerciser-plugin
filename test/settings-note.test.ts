import { describe, expect, it } from "vitest";
import { globalSettingsNotePath } from "../src/settings-note";

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
});
