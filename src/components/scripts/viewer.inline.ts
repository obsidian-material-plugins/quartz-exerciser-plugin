// Dynamic HAST payloads are validated server-side before this browser-only script runs.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { appendDiff } from "./diff";

const make = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};

const translations = {
  en: {
    compare: "Compare output",
    close: "Close",
    expected: "Expected",
    yours: "Your output",
    compareAction: "Compare",
    ready: "Paste output above, then choose Compare.",
    placeholder: "Paste your program output here…",
    help: "○ stdout — Ordinary output\n› stdin — User input\n! stderr — Error output",
    annotation: "Start here.",
  },
  fi: {
    compare: "Vertaa tulostetta",
    close: "Sulje",
    expected: "Odotettu",
    yours: "Oma tulosteesi",
    compareAction: "Vertaa",
    ready: "Liitä tuloste yllä olevaan kenttään ja valitse Vertaa.",
    placeholder: "Liitä ohjelman tuloste tähän…",
    help: "○ stdout — Normaali tuloste\n› stdin — Käyttäjän syöte\n! stderr — Virhetuloste",
    annotation: "Aloita tästä.",
  },
};

const extensionKind = (file) => {
  const extension = file.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(extension)) return "image";
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(extension)) return "audio";
  if (["mp4", "webm", "mov", "m4v", "ogv"].includes(extension)) return "video";
  if (extension === "pdf") return "pdf";
  return "other";
};

const addTerminal = (container, content, type) => {
  const pre = make("pre", `exercise-terminal exercise-terminal-${type}`);
  const lines = (content || "").split("\n");
  for (const line of lines) {
    const marker = /^\[(stdout|stdin|stderr)\]\s?/.exec(line);
    const row = make(
      "span",
      `exercise-stream exercise-stream-${marker?.[1] || (type === "stderr" ? "stderr" : "stdout")}`,
    );
    const symbol =
      marker?.[1] === "stdin"
        ? "› stdin  "
        : marker?.[1] === "stderr" || type === "stderr"
          ? "! stderr "
          : "○ stdout ";
    row.textContent = `${symbol}${line.replace(/^\[(stdout|stdin|stderr)\]\s?/, "")}`;
    pre.append(row, document.createTextNode("\n"));
  }
  container.append(pre);
};

const createComparison = (payload, example) => {
  const t = translations[payload.locale];
  const dialog = make("dialog", "exercise-comparison");
  const heading = make("header", "exercise-comparison-heading");
  heading.append(make("h3", "", t.compare));
  const close = make("button", "exercise-action", t.close);
  close.type = "button";
  close.addEventListener("click", () => dialog.close());
  heading.append(close);
  const inputs = make("div", "exercise-comparison-inputs");
  const expectedWrap = make("label", "exercise-comparison-field");
  expectedWrap.append(make("strong", "", t.expected));
  const expected = make("textarea");
  expected.readOnly = true;
  expected.value = example.resolvedContent || example.fallback || "";
  expectedWrap.append(expected);
  const actualWrap = make("label", "exercise-comparison-field");
  actualWrap.append(make("strong", "", t.yours));
  const actual = make("textarea");
  actual.placeholder = t.placeholder;
  actualWrap.append(actual);
  inputs.append(expectedWrap, actualWrap);
  const actions = make("div", "exercise-comparison-actions");
  const status = make("p", "exercise-muted", t.ready);
  const compare = make("button", "exercise-action", t.compareAction);
  compare.type = "button";
  const result = make("pre", "exercise-diff");
  compare.addEventListener("click", () => {
    appendDiff(result, expected.value, actual.value);
    status.textContent =
      expected.value === actual.value ? "No differences found" : "Differences found";
  });
  actions.append(status, compare);
  dialog.append(heading, inputs, actions, result);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  dialog.showModal();
};

const renderNotes = (root, payload, selected) => {
  const target = root.querySelector(".exercise-source-notes");
  target.replaceChildren();
  const annotation = payload.annotations.find((item) => item.source === selected);
  if (annotation) {
    const row = make("p", "exercise-annotation", `ⓘ L${annotation.line} · ${annotation.text}`);
    target.append(row);
  }
  const highlight = payload.highlights.find((item) => item.source === selected);
  highlight?.ranges.forEach((range, index) => {
    if (!range.note) return;
    const row = make(
      "p",
      "exercise-highlight-note",
      `${String.fromCodePoint(0x2460 + index)} Lines ${range.lines} · ${range.note}`,
    );
    if (range.accent) row.style.setProperty("--exercise-accent", range.accent);
    target.append(row);
  });
  target.hidden = target.childElementCount === 0;
};

const applyLineStates = (root, payload, selected) => {
  const panel = [...root.querySelectorAll(".exercise-file-panel")].find(
    (item) => item.dataset.exerciseFile === selected,
  );
  if (!panel) return;
  const lines = panel.querySelectorAll(".exercise-source .line");
  lines.forEach((line, index) => {
    line.dataset.line = String(index + 1);
    line.classList.remove(
      "exercise-line-dim",
      "exercise-line-highlight",
      "exercise-line-annotated",
    );
  });
  const highlight = payload.highlights.find((item) => item.source === selected);
  if (highlight && lines.length) {
    lines.forEach((line) => line.classList.add("exercise-line-dim"));
    highlight.ranges.forEach((range) => {
      const [from, to = from] = range.lines.split("-").map(Number);
      for (let number = from; number <= to; number += 1) {
        const line = lines[number - 1];
        line?.classList.remove("exercise-line-dim");
        line?.classList.add("exercise-line-highlight");
        if (range.accent) line?.style.setProperty("--exercise-accent", range.accent);
      }
    });
  }
  payload.annotations
    .filter((item) => item.source === selected)
    .forEach((item) => lines[item.line - 1]?.classList.add("exercise-line-annotated"));
};

const renderOutput = (root, payload, selected) => {
  const target = root.querySelector(".exercise-output");
  target.replaceChildren();
  const association = payload.outputs.find((item) => item.source === selected);
  if (!association) {
    target.hidden = true;
    return;
  }
  target.hidden = false;
  let active = 0;
  const render = () => {
    target.replaceChildren();
    const heading = make("header", "exercise-output-heading");
    heading.append(make("strong", "", association.heading));
    const help = make("button", "exercise-help", "?");
    help.type = "button";
    help.title = translations[payload.locale].help;
    const compare = make("button", "exercise-action", translations[payload.locale].compare);
    compare.type = "button";
    compare.addEventListener("click", () =>
      createComparison(payload, association.examples[active]),
    );
    heading.append(help, compare);
    target.append(heading);
    if (association.examples.length > 1) {
      const tabs = make("div", "exercise-output-tabs");
      association.examples.forEach((example, index) => {
        const tab = make("button", index === active ? "is-active" : "", example.label);
        tab.type = "button";
        tab.addEventListener("click", () => {
          active = index;
          render();
        });
        tabs.append(tab);
      });
      target.append(tabs);
    }
    target.append(make("code", "exercise-output-path", association.source));
    const example = association.examples[active];
    if (example.type === "file" && example.publicUrl) {
      const kind = extensionKind(example.file || "");
      const media = make("div", "exercise-media");
      let node;
      if (kind === "image") {
        node = document.createElement("img");
        node.alt = example.file || "";
      } else if (kind === "audio" || kind === "video") {
        node = document.createElement(kind);
        node.controls = true;
      } else if (kind === "pdf") {
        node = document.createElement("iframe");
        node.title = example.file || "PDF";
      }
      if (node) {
        node.src = example.publicUrl;
        media.append(node);
        target.append(media);
      } else if (example.fallback) addTerminal(target, example.fallback, "raw");
    } else {
      addTerminal(target, example.resolvedContent || example.fallback || "", example.type);
    }
  };
  render();
};

const buildTree = (root, payload, select) => {
  const tree = {};
  payload.files.forEach((file) => {
    let cursor = tree;
    const parts = file.path.split("/");
    parts.forEach((part, index) => {
      cursor[part] ||= index === parts.length - 1 ? { __file: file } : {};
      cursor = cursor[part];
    });
  });
  const renderBranch = (branch) => {
    const list = make("ul", "exercise-tree-list");
    Object.keys(branch)
      .sort()
      .forEach((name) => {
        const value = branch[name];
        const item = make("li");
        if (value.__file) {
          const button = make("button", "exercise-tree-file", name);
          button.type = "button";
          button.dataset.exercisePath = value.__file.path;
          button.addEventListener("click", () => select(value.__file.path));
          item.append(button);
        } else {
          const details = document.createElement("details");
          details.open = true;
          details.append(make("summary", "", name), renderBranch(value));
          item.append(details);
        }
        list.append(item);
      });
    return list;
  };
  root.querySelector(".exercise-tree-body").replaceChildren(renderBranch(tree));
};

const setupViewer = (root) => {
  if (root.dataset.exerciseReady === "true") return;
  root.dataset.exerciseReady = "true";
  let payload;
  try {
    payload = JSON.parse(decodeURIComponent(root.dataset.exercisePayload));
  } catch {
    return;
  }
  let selected = payload.entrypoint;
  let raw = false;
  let wrap = payload.wordWrap;
  const open = [selected];
  const selector = root.querySelector("[data-exercise-selector]");
  payload.files.forEach((file) => selector.append(new Option(file.path, file.path)));

  const renderTabs = () => {
    const tabs = root.querySelector(".exercise-source-tabs");
    tabs.replaceChildren();
    open.forEach((filePath) => {
      const file = payload.files.find((item) => item.path === filePath);
      const tab = make(
        "button",
        filePath === selected ? "is-active" : "",
        file?.basename || filePath,
      );
      tab.type = "button";
      tab.addEventListener("click", () => select(filePath));
      const close = make("span", "exercise-tab-close", "×");
      close.setAttribute("aria-hidden", "true");
      tab.append(close);
      tab.addEventListener("auxclick", () => closeTab(filePath));
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        closeTab(filePath);
      });
      tabs.append(tab);
    });
  };
  const closeTab = (filePath) => {
    if (open.length === 1) return;
    const index = open.indexOf(filePath);
    if (index >= 0) open.splice(index, 1);
    if (selected === filePath) selected = open[Math.max(0, index - 1)];
    update();
  };
  const select = (filePath) => {
    selected = filePath;
    if (!open.includes(filePath)) open.push(filePath);
    update();
  };
  const update = () => {
    root.dataset.exerciseWrap = String(wrap);
    root.dataset.exerciseRaw = String(raw);
    root.querySelector(".exercise-current-path").textContent = selected;
    selector.value = selected;
    root.querySelectorAll(".exercise-file-panel").forEach((panel) => {
      const active = panel.dataset.exerciseFile === selected;
      panel.hidden = !active;
      panel.querySelector(".exercise-source")?.toggleAttribute("hidden", raw);
      panel.querySelector(".exercise-raw")?.toggleAttribute("hidden", !raw);
    });
    root
      .querySelectorAll(".exercise-tree-file")
      .forEach((button) =>
        button.classList.toggle("is-active", button.dataset.exercisePath === selected),
      );
    renderTabs();
    renderNotes(root, payload, selected);
    applyLineStates(root, payload, selected);
    renderOutput(root, payload, selected);
  };
  selector.addEventListener("change", () => select(selector.value));
  root.querySelector('[data-exercise-action="copy"]').addEventListener("click", async () => {
    const file = payload.files.find((item) => item.path === selected);
    if (file?.content !== undefined) await navigator.clipboard.writeText(file.content);
  });
  root.querySelector('[data-exercise-action="download"]').addEventListener("click", () => {
    const file = payload.files.find((item) => item.path === selected);
    if (!file?.publicUrl) return;
    const link = document.createElement("a");
    link.href = file.publicUrl;
    link.download = file.basename;
    link.click();
  });
  root.querySelector('[data-exercise-action="wrap"]').addEventListener("click", () => {
    wrap = !wrap;
    update();
  });
  root.querySelector('[data-exercise-action="raw"]').addEventListener("click", () => {
    raw = !raw;
    update();
  });
  buildTree(root, payload, select);
  update();
};

const initialize = () => document.querySelectorAll(".exercise-viewer").forEach(setupViewer);
document.addEventListener("nav", initialize);
window.addCleanup(() => document.removeEventListener("nav", initialize));
initialize();

export default "";
