import assert from "node:assert/strict";
import test from "node:test";

import {
  createDiffPreview,
  diffPreviewLimits,
} from "../src/diff-preview.js";

function createDraftedWorkOrder(
  originalContent,
  proposedContent,
) {
  return Object.freeze({
    id: "work-order-001",
    status: "drafted",
    drafts: Object.freeze([
      Object.freeze({
        file: "src/example.js",
        originalContent,
        proposedContent,
      }),
    ]),
  });
}

test("zeigt Ergänzungen und Löschungen", () => {
  const preview = createDiffPreview(
    createDraftedWorkOrder(
      [
        "function example() {",
        '  return "old";',
        "}",
      ].join("\n"),
      [
        "function example() {",
        '  return "new";',
        "}",
      ].join("\n"),
    ),
  );

  assert.match(
    preview,
    /-   return "old";/,
  );

  assert.match(
    preview,
    /\+   return "new";/,
  );

  assert.match(preview, /Änderungen: \+1 -1/);

  assert.match(
    preview,
    /Keine Datei wurde gespeichert/,
  );
});

test("zeigt nur begrenzten Kontext", () => {
  const originalLines = Array.from(
    {
      length: 20,
    },
    (_, index) => `line-${index + 1}`,
  );

  const proposedLines = [...originalLines];
  proposedLines[10] = "changed-line";

  const preview = createDiffPreview(
    createDraftedWorkOrder(
      originalLines.join("\n"),
      proposedLines.join("\n"),
    ),
  );

  assert.match(preview, /changed-line/);
  assert.match(preview, /\.\.\./);
  assert.doesNotMatch(preview, /  line-1\r?\n/);
  assert.doesNotMatch(preview, /  line-20\r?\n/);
});

test("lehnt Dateien oberhalb des Zeilenlimits ab", () => {
  const excessiveContent = Array.from(
    {
      length:
        diffPreviewLimits.maximumInputLinesPerFile +
        1,
    },
    () => "line",
  ).join("\n");

  assert.throws(
    () =>
      createDiffPreview(
        createDraftedWorkOrder(
          excessiveContent,
          `${excessiveContent}\nchanged`,
        ),
      ),
    /zu viele Zeilen/,
  );
});

test("lehnt Arbeitsaufträge ohne Entwürfe ab", () => {
  assert.throws(
    () =>
      createDiffPreview({
        status: "planned",
      }),
    /Änderungsvorschlägen/,
  );
});
