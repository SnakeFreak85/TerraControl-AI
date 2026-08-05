import assert from "node:assert/strict";
import test from "node:test";

import {
  commitPlanLimits,
  createCommitPlan,
} from "../src/commit-plan.js";

const validatedWorkOrder = Object.freeze({
  id: "work-order-001",
  repositoryPath: "example-repository",
  status: "validated",
  appliedFiles: Object.freeze([
    "src/example.js",
    "src/example.css",
  ]),
});

const gitStatus = Object.freeze({
  branch: "main",
  remoteUrl:
    "https://github.com/example/project.git",
});

const changedFiles = Object.freeze([
  Object.freeze({
    status: " M",
    file: "src/example.js",
  }),
  Object.freeze({
    status: " M",
    file: "src/example.css",
  }),
]);

test("erstellt einen Commit-Plan für exakt freigegebene Dateien", () => {
  const plan = createCommitPlan(
    validatedWorkOrder,
    {
      message:
        "fix: improve responsive image sizing",
      gitStatus,
      changedFiles,
    },
  );

  assert.equal(
    plan.status,
    "ready-to-commit",
  );

  assert.equal(plan.branch, "main");

  assert.equal(
    plan.message,
    "fix: improve responsive image sizing",
  );

  assert.deepEqual(
    plan.files,
    [
      "src/example.js",
      "src/example.css",
    ],
  );

  assert.equal(Object.isFrozen(plan), true);
});

test("lehnt nicht validierte Arbeitsaufträge ab", () => {
  assert.throws(
    () =>
      createCommitPlan(
        {
          ...validatedWorkOrder,
          status: "diff-verified",
        },
        {
          message:
            "fix: improve responsive images",
          gitStatus,
          changedFiles,
        },
      ),
    /erfolgreich validierten/,
  );
});

test("lehnt unerwartete Git-Dateien ab", () => {
  assert.throws(
    () =>
      createCommitPlan(
        validatedWorkOrder,
        {
          message:
            "fix: improve responsive images",
          gitStatus,
          changedFiles: [
            ...changedFiles,
            {
              status: "??",
              file: "unexpected.txt",
            },
          ],
        },
      ),
    /unerwartete Änderungen/,
  );
});

test("lehnt ungültige Commit-Nachrichten ab", () => {
  assert.throws(
    () =>
      createCommitPlan(
        validatedWorkOrder,
        {
          message: "irgendeine Nachricht",
          gitStatus,
          changedFiles,
        },
      ),
    /Format/,
  );
});

test("lehnt mehrzeilige Commit-Nachrichten ab", () => {
  assert.throws(
    () =>
      createCommitPlan(
        validatedWorkOrder,
        {
          message:
            "fix: first line\nsecond line",
          gitStatus,
          changedFiles,
        },
      ),
    /nur eine Zeile/,
  );
});

test("begrenzt die Länge der Commit-Nachricht", () => {
  assert.throws(
    () =>
      createCommitPlan(
        validatedWorkOrder,
        {
          message:
            "fix: " +
            "x".repeat(
              commitPlanLimits.maximumMessageLength,
            ),
          gitStatus,
          changedFiles,
        },
      ),
    /höchstens/,
  );
});
