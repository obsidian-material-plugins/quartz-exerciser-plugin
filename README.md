# Exerciser for Quartz

A Quartz 5 transformer and emitter for read-only programming exercise projects created by the companion Obsidian Exerciser plugin. It renders fenced `exercise` blocks as responsive project viewers and emits one downloadable ZIP per exercise.

The source root is intentionally fixed at `content/assets/exercises/`. Root Index Panels is optional visual context, not a dependency.

## Install

```bash
npx quartz plugin add github:obsidian-material-plugins/quartz-exerciser-plugin
```

Keep the plugin before syntax highlighting so fenced blocks become viewers first:

```yaml
plugins:
  - source: github:obsidian-material-plugins/quartz-exerciser-plugin
    enabled: true
    options:
      exerciseRoot: assets/exercises
      defaultPreviewLimitBytes: 52428800
    order: 10
```

`exclude-from-quartz` must be known before Quartz performs its initial content glob. Add the plugin's pre-build helper to `quartz.ts`:

```ts
import { applyExerciseIgnorePatterns } from "./.quartz/plugins";
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader";

const config = await loadQuartzConfig();
await applyExerciseIgnorePatterns(config);

export default config;
export const layout = await loadQuartzLayout();
```

This excludes `.exercise.yml` and manifest policy paths before publication, rather than merely hiding them in the rendered viewer.

## Use

The Obsidian creation workflow generates the fence at the current cursor:

````markdown
```exercise
exercise: hello-world
layout: ide
entrypoint: src/Main.java
word-wrap: true
```
````

`layout` accepts `ide` or `dropdown`. Both are responsive; the IDE layout automatically becomes compact in a narrow viewport. `entrypoint` is optional and `word-wrap` defaults to `true`.

Project-owned behavior lives in `content/assets/exercises/<name>/.exercise.yml`:

```yaml
version: 1
files:
  hide-from-preview:
    - instructor-notes/**
  exclude-from-quartz:
    - solutions/**
preview:
  ignore-size-limit: false
outputs:
  - source: src/Main.java
    heading: Expected output
    examples:
      - label: Example 1
        type: normal
        content: |-
          [stdout] Hello
highlights:
  - source: src/Main.java
    ranges:
      - lines: 3-8
        note: Main loop
        accent: "#7c3aed"
annotations:
  - source: src/Main.java
    line: 4
    text: Start here.
    inject-into-export: true
```

The sidecar is never rendered, published as an asset, or included in ZIP files. Preview-hidden files remain in downloads. Quartz-excluded files do not.

## Viewer behavior

- IDE tree/tabs and explicit compact dropdown views
- host syntax highlighting, raw view, line numbers, wrap toggle, and per-file download
- line-range focus, notes, accent colors, and annotations
- image, audio, video, and PDF previews
- terminal/stdout/stdin/stderr output markers, multiple examples, generated-file output, and accessible output comparison
- base-path-safe asset and ZIP URLs
- light, dark, narrow, and forced-colors styling
- English and Finnish viewer strings selected from the Quartz locale

The root `content/index.md` frontmatter may set `exercise-preview-size-limit` as positive bytes or as `KB`, `MB`, or `GB`. Missing or malformed values use the configured fallback, which defaults to **50 MB**.

## Development

```bash
npm install
npm run check
npm run build
```

Tests, including pre-glob exclusion and ZIP integration tests, remain in this repository. The host site is a consumer, not a test dependency.

## License

MIT
