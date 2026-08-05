import assert from "node:assert/strict";
import test from "node:test";

import { createValidationPlan } from "../src/validation-plan.js";

const verifiedWorkOrder = Object.freeze({
  repositoryPath: "example-repository",
  status: "diff-verified",
  validationScripts: Object.freeze([
    "test",
    "build",
  ]),
});

const nodeProject = Object.freeze({
  type: "node",
  packageManager: "npm",
  scripts: Object.freeze({
    build: "node build.js",
    test: "node --test",
  }),
});

test("erzeugt sichere npm-Befehle für Windows", () => {
  const plan = createValidationPlan(
    verifiedWorkOrder,
    nodeProject,
    {
      platform: "win32",
    },
  );

  assert.equal(plan.commands.length, 2);

  assert.deepEqual(
    plan.commands[0],
    {
      scriptName: "test",
      executable: "npm.cmd",
      arguments: ["run", "test"],
      displayCommand: "npm run test",
    },
  );

  assert.deepEqual(
    plan.commands[1].arguments,
    ["run", "build"],
  );
});

test("verwendet npm ohne Dateiendung auf anderen Plattformen", () => {
  const plan = createValidationPlan(
    verifiedWorkOrder,
    nodeProject,
    {
      platform: "linux",
    },
  );

  assert.equal(
    plan.commands[0].executable,
    "npm",
  );
});

test("lehnt unbekannte Skripte ab", () => {
  assert.throws(
    () =>
      createValidationPlan(
        {
          ...verifiedWorkOrder,
          validationScripts: [
            "test",
            "delete-everything",
          ],
        },
        nodeProject,
      ),
    /nicht vorhanden/,
  );
});

test("verbietet Validierung vor der Diff-Prüfung", () => {
  assert.throws(
    () =>
      createValidationPlan(
        {
          ...verifiedWorkOrder,
          status: "drafted",
        },
        nodeProject,
      ),
    /erfolgreich geprüften Git-Diff/,
  );
});

test("lehnt Arbeitsaufträge ohne Validierung ab", () => {
  assert.throws(
    () =>
      createValidationPlan(
        {
          ...verifiedWorkOrder,
          validationScripts: [],
        },
        nodeProject,
      ),
    /keine Validierungsskripte/,
  );
});
