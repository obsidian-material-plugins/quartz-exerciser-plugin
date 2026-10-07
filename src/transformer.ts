import type { Element, ElementContent, Root, Text } from "hast";
import type { Plugin } from "unified";
import type { BuildCtx, QuartzTransformerPlugin } from "@quartz-community/types";
import { parseExerciseFence, EXERCISE_ROOT } from "./config";
import { loadViewerPayload } from "./model";
import type { ExerciseViewerFile, ExerciseViewerPayload, QuartzExerciserOptions } from "./types";
import viewerScript from "./components/scripts/viewer.inline";
import viewerStyle from "./components/styles/viewer.scss";

const defaults: QuartzExerciserOptions = {
  exerciseRoot: EXERCISE_ROOT,
  defaultPreviewLimitBytes: 50 * 1024 * 1024,
};

const text = (value: string): Text => ({ type: "text", value });
const element = (
  tagName: string,
  properties: Element["properties"] = {},
  children: ElementContent[] = [],
): Element => ({ type: "element", tagName, properties, children });

const state = (message: string): Element =>
  element("div", { className: ["exercise-viewer-state"], role: "status" }, [
    element("p", {}, [text(message)]),
  ]);

const formatBytes = (size: number) => {
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

const preview = (file: ExerciseViewerFile, visible: boolean): Element => {
  const properties: Element["properties"] = {
    className: ["exercise-file-panel"],
    dataExerciseFile: file.path,
    hidden: !visible,
  };
  if (file.kind === "text") {
    return element("section", properties, [
      element("pre", { className: ["exercise-source"] }, [
        element("code", { className: [`language-${file.language ?? "plaintext"}`] }, [
          text(file.content ?? ""),
        ]),
      ]),
      element("pre", { className: ["exercise-raw"], hidden: true }, [text(file.content ?? "")]),
    ]);
  }
  if (file.kind === "image") {
    return element("section", properties, [
      element("div", { className: ["exercise-media"] }, [
        element("img", { src: file.publicUrl, alt: file.basename, loading: "lazy" }),
      ]),
    ]);
  }
  if (file.kind === "audio") {
    return element("section", properties, [
      element("div", { className: ["exercise-media"] }, [
        element("audio", { src: file.publicUrl, controls: true, preload: "metadata" }),
      ]),
    ]);
  }
  if (file.kind === "video") {
    return element("section", properties, [
      element("div", { className: ["exercise-media"] }, [
        element("video", { src: file.publicUrl, controls: true, preload: "metadata" }),
      ]),
    ]);
  }
  if (file.kind === "pdf") {
    return element("section", properties, [
      element("div", { className: ["exercise-media", "exercise-pdf"] }, [
        element("iframe", { src: file.publicUrl, title: file.basename, loading: "lazy" }),
      ]),
    ]);
  }
  const reason =
    file.kind === "oversized"
      ? "This file exceeds the configured preview limit."
      : "Preview unavailable";
  return element("section", properties, [
    element("div", { className: ["exercise-binary"] }, [
      element("strong", {}, [text(file.basename)]),
      element("p", {}, [text(reason)]),
      element("p", { className: ["exercise-muted"] }, [
        text(`File type: ${file.mime ?? "Unknown"} · File size: ${formatBytes(file.size)}`),
      ]),
      element(
        "a",
        { className: ["exercise-action"], href: file.publicUrl, download: file.basename },
        [text("Download file")],
      ),
    ]),
  ]);
};

const viewer = (payload: ExerciseViewerPayload): Element => {
  const labels =
    payload.locale === "fi"
      ? {
          downloadZip: "Lataa ZIP",
          files: "Tiedostot",
          copy: "Kopioi tiedoston sisältö",
          download: "Lataa tämä tiedosto",
          wrap: "Vaihda rivien rivitys",
          raw: "Vaihda raakatekstinäkymä",
        }
      : {
          downloadZip: "Download ZIP",
          files: "Files",
          copy: "Copy file contents",
          download: "Download this file",
          wrap: "Toggle word wrap",
          raw: "Toggle raw view",
        };
  const encoded = encodeURIComponent(JSON.stringify(payload));
  return element(
    "div",
    {
      className: ["exercise-viewer", `exercise-layout-${payload.layout}`],
      dataExercisePayload: encoded,
      dataExerciseWrap: payload.wordWrap ? "true" : "false",
    },
    [
      element("div", { className: ["exercise-titlebar"] }, [
        element("code", { className: ["exercise-name"] }, [text(payload.exercise)]),
        element(
          "a",
          {
            className: ["exercise-action"],
            href: payload.zipUrl,
            download: `${payload.exercise}.zip`,
          },
          [element("span", { ariaHidden: "true" }, [text("⇩")]), text(labels.downloadZip)],
        ),
      ]),
      element("div", { className: ["exercise-shell"] }, [
        element("aside", { className: ["exercise-tree"], ariaLabel: labels.files }, [
          element("strong", { className: ["exercise-tree-title"] }, [text(payload.exercise)]),
          element("div", { className: ["exercise-tree-body"] }),
        ]),
        element("div", { className: ["exercise-main"] }, [
          element("div", { className: ["exercise-source-tabs"], role: "tablist" }),
          element("label", { className: ["exercise-selector"] }, [
            element("span", { className: ["sr-only"] }, [text(labels.files)]),
            element("select", { dataExerciseSelector: true }),
          ]),
          element("header", { className: ["exercise-preview-header"] }, [
            element("code", { className: ["exercise-current-path"] }, [text(payload.entrypoint)]),
            element("div", { className: ["exercise-toolbar"] }, [
              element(
                "button",
                {
                  type: "button",
                  dataExerciseAction: "copy",
                  title: labels.copy,
                  ariaLabel: labels.copy,
                },
                [text("⧉")],
              ),
              element(
                "button",
                {
                  type: "button",
                  dataExerciseAction: "download",
                  title: labels.download,
                  ariaLabel: labels.download,
                },
                [text("⇩")],
              ),
              element(
                "button",
                {
                  type: "button",
                  dataExerciseAction: "wrap",
                  title: labels.wrap,
                  ariaLabel: labels.wrap,
                },
                [text("↵")],
              ),
              element(
                "button",
                {
                  type: "button",
                  dataExerciseAction: "raw",
                  title: labels.raw,
                  ariaLabel: labels.raw,
                },
                [text("<>")],
              ),
            ]),
          ]),
          element(
            "div",
            { className: ["exercise-previews"] },
            payload.files.map((file) => preview(file, file.path === payload.entrypoint)),
          ),
          element("div", { className: ["exercise-source-notes"], hidden: true }),
          element("div", { className: ["exercise-output"], hidden: true }),
        ]),
      ]),
    ],
  );
};

const exerciseCode = (node: Element): string | null => {
  if (node.tagName !== "pre" || node.children.length !== 1) return null;
  const code = node.children[0]!;
  if (code.type !== "element" || code.tagName !== "code") return null;
  const classes = Array.isArray(code.properties.className) ? code.properties.className : [];
  if (!classes.includes("language-exercise")) return null;
  return code.children.map((child) => (child.type === "text" ? child.value : "")).join("");
};

const replaceExercises = async (ctx: BuildCtx, tree: Root, options: QuartzExerciserOptions) => {
  const work: Array<{ parent: Root | Element; index: number; source: string }> = [];
  const walk = (parent: Root | Element) => {
    parent.children.forEach((child, index) => {
      if (child.type !== "element") return;
      const source = exerciseCode(child);
      if (source !== null) work.push({ parent, index, source });
      else walk(child);
    });
  };
  walk(tree);
  for (const item of work) {
    const fence = parseExerciseFence(item.source);
    if (!fence) {
      item.parent.children[item.index] = state("Invalid exercise path");
      continue;
    }
    const payload = await loadViewerPayload(ctx, fence, options);
    if ("error" in payload) {
      const locale = ctx.cfg.configuration.locale?.toLowerCase().startsWith("fi") ? "fi" : "en";
      const message =
        payload.error === "invalid"
          ? locale === "fi"
            ? "Virheellinen harjoituspolku"
            : "Invalid exercise path"
          : payload.error === "missing"
            ? locale === "fi"
              ? "Harjoituskansiota ei löytynyt."
              : "Exercise folder not found."
            : locale === "fi"
              ? "Harjoituksessa ei ole tiedostoja."
              : "No files in this exercise.";
      item.parent.children[item.index] = state(message);
      continue;
    }
    item.parent.children[item.index] = viewer(payload);
  }
};

const rehypeExerciseViewer =
  (ctx: BuildCtx, options: QuartzExerciserOptions): Plugin<[], Root> =>
  () =>
  async (tree: Root) =>
    replaceExercises(ctx, tree, options);

export const transformer: QuartzTransformerPlugin<Partial<QuartzExerciserOptions>> = (
  userOptions,
) => {
  const options = { ...defaults, ...userOptions } as QuartzExerciserOptions;
  if (options.exerciseRoot !== EXERCISE_ROOT) options.exerciseRoot = EXERCISE_ROOT;
  if (!Number.isFinite(options.defaultPreviewLimitBytes) || options.defaultPreviewLimitBytes <= 0) {
    options.defaultPreviewLimitBytes = defaults.defaultPreviewLimitBytes;
  }
  return {
    name: "ExerciseViewerTransformer",
    htmlPlugins(ctx) {
      return [rehypeExerciseViewer(ctx, options)];
    },
    externalResources() {
      return {
        css: [{ content: viewerStyle, inline: true }],
        js: [{ contentType: "inline", loadTime: "afterDOMReady", script: viewerScript }],
        additionalHead: [],
      };
    },
  };
};
