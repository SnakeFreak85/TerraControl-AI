import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCommitPlanPreview,
} from "../src/commit-preview.js";

const commitPlan = Object.freeze({
  status: "ready-to-commit",
  workOrderId: "work-order-001",
  repositoryPath: "example-repository",
  branch: "main",
  remoteUrl:
    "https://github.com/example/project.git",
  message:
    "fix: improve responsive image sizing",
  files: Object.freeze([
    "src/example.js",
    "src/example.css",
  ]),
});

test("zeigt alle freigegebenen Commit-Daten", () => {
  const preview =
    formatCommitPlanPreview(
      commitPlan,
    );

  assert.match(
    preview,
    /work-order-001/,
  );

  assert.match(preview, /Branch: main/);

  assert.match(
    preview,
    /fix: improve responsive image sizing/,
  );

  assert.match(
    preview,
    /src\/example\.js/,
  );

  assert.match(
    preview,
    /src\/example\.css/,
  );

  assert.match(
    preview,
    /noch kein Commit erstellt/,
  );

  assert.match(
    preview,
    /noch kein Push ausgeführt/,
  );
});

test("lehnt ungeprüfte Pläne ab", () => {
  assert.throws(
    () =>
      formatCommitPlanPreview({
        ...commitPlan,
        status: "draft",
      }),
    /geprüften Commit-Plan/,
  );
});
