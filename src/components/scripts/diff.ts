const visible = (value: string) =>
  value.replace(/ /g, "·").replace(/\t/g, "⇥").replace(/\r/g, "␍").replace(/\n/g, "↵\n");

type DiffPart = { kind: "same" | "expected" | "actual"; value: string };

const compact = (parts: DiffPart[]): DiffPart[] => {
  const result: DiffPart[] = [];
  for (const part of parts) {
    const previous = result.at(-1);
    if (previous?.kind === part.kind) previous.value += part.value;
    else result.push({ ...part });
  }
  return result;
};

export const characterDiff = (expected: string, actual: string): DiffPart[] => {
  if (expected === actual) return [{ kind: "same", value: expected }];
  if (expected.length * actual.length > 4_000_000) {
    return [
      { kind: "expected", value: expected },
      { kind: "actual", value: actual },
    ];
  }
  const rows = expected.length + 1;
  const columns = actual.length + 1;
  const table = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let left = expected.length - 1; left >= 0; left -= 1) {
    for (let right = actual.length - 1; right >= 0; right -= 1) {
      table[left]![right] =
        expected[left] === actual[right]
          ? table[left + 1]![right + 1]! + 1
          : Math.max(table[left + 1]![right]!, table[left]![right + 1]!);
    }
  }
  const parts: DiffPart[] = [];
  let left = 0;
  let right = 0;
  while (left < expected.length && right < actual.length) {
    if (expected[left] === actual[right]) {
      parts.push({ kind: "same", value: expected[left]! });
      left += 1;
      right += 1;
    } else if (table[left + 1]![right]! >= table[left]![right + 1]!) {
      parts.push({ kind: "expected", value: expected[left++]! });
    } else {
      parts.push({ kind: "actual", value: actual[right++]! });
    }
  }
  while (left < expected.length) parts.push({ kind: "expected", value: expected[left++]! });
  while (right < actual.length) parts.push({ kind: "actual", value: actual[right++]! });
  return compact(parts);
};

export const appendDiff = (target: HTMLElement, expected: string, actual: string) => {
  target.replaceChildren();
  for (const part of characterDiff(expected, actual)) {
    const span = document.createElement("span");
    span.className = `exercise-diff-${part.kind}`;
    span.textContent = visible(part.value);
    target.append(span);
  }
  if (!expected.endsWith("\n") || !actual.endsWith("\n")) {
    const note = document.createElement("span");
    note.className = "exercise-diff-note";
    note.textContent = " ∅ missing final newline";
    target.append(note);
  }
};
