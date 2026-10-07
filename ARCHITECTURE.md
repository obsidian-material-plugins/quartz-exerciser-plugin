# Architecture

The package has three build-time responsibilities and one browser resource:

- `src/prebuild.ts` reads each `.exercise.yml` before Quartz globs content and extends `ignorePatterns` with sidecars and `exclude-from-quartz` paths.
- `src/transformer.ts` replaces fenced `exercise` blocks with accessible HAST and attaches the viewer CSS and SPA-safe inline script.
- `src/emitter.ts` creates `/exercises/<name>.zip`, excludes sidecars/publication-excluded files, and injects opted-in annotations into exported source.
- `src/components/scripts/viewer.inline.ts` owns in-page file selection, tabs, output examples, comparison, copy/download, and Quartz `nav` lifecycle handling.

`src/config.ts` independently validates all YAML input and traversal-sensitive paths. `src/model.ts` performs filesystem discovery and resolves base-path-aware viewer payloads. The fixed root is a deliberate public contract, not a configurable security boundary.

Unit and integration tests live under `test/`. The integration fixture uses temporary directories and does not depend on a Quartz site checkout.
