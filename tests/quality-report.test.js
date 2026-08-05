import assert from "node:assert/strict";
import test from "node:test";

import {
  formatQualityFailureReport,
  formatQualitySuccessReport,
} from "../src/quality-report.js";

function createValidatedWorkOrder(
  standardOutput = "all tests passed",
) {
  return {
    id: "work-order-001",
    status: "validated",
    appliedFiles: [
      "src/example.js",
      "src/example.css",
    ],
    validation: {
      success: true,
      results: [
        {
          scriptName: "test",
          displayCommand: "npm run test",
          exitCode: 0,
          durationMs: 125,
          standardOutput,
          errorOutput: "",
        },
      ],
    },
    diff: {
      sizeBytes: 512,
    },
  };
}

test("formatiert einen erfolgreichen Qualitätsbericht", () => {
  const report =
    formatQualitySuccessReport(
      createValidatedWorkOrder(),
    );

  assert.match(
    report,
    /Gesamtstatus: ERFOLGREICH/,
  );

  assert.match(
    report,
    /src\/example\.js/,
  );

  assert.match(report, /npm run test/);
  assert.match(report, /Laufzeit: 125 ms/);
  assert.match(report, /all tests passed/);
  assert.match(report, /Git-Diff: 512 Bytes/);

  assert.match(
    report,
    /noch kein Commit oder Push/,
  );
});

test("formatiert einen fehlgeschlagenen Qualitätsbericht", () => {
  const commandResult = {
    scriptName: "test",
    displayCommand: "npm run test",
    exitCode: 1,
    durationMs: 200,
    standardOutput: "",
    errorOutput: "test failed",
  };

  const commandError = new Error(
    "Validierung fehlgeschlagen",
    {
      cause: commandResult,
    },
  );

  const workflowError = new Error(
    "Änderungen wurden zurückgesetzt",
    {
      cause: commandError,
    },
  );

  const report =
    formatQualityFailureReport(
      workflowError,
    );

  assert.match(
    report,
    /Gesamtstatus: FEHLGESCHLAGEN/,
  );

  assert.match(
    report,
    /Fehlgeschlagener Befehl: npm run test/,
  );

  assert.match(report, /Exit-Code: 1/);
  assert.match(report, /test failed/);

  assert.match(
    report,
    /kein Commit oder Push/,
  );
});

test("begrenzt lange Befehlsausgaben", () => {
  const longOutput = Array.from(
    {
      length: 100,
    },
    (_, index) => `line-${index + 1}`,
  ).join("\n");

  const report =
    formatQualitySuccessReport(
      createValidatedWorkOrder(
        longOutput,
      ),
    );

  assert.match(
    report,
    /\[Ausgabe gekürzt\]/,
  );

  assert.match(report, /line-100/);

  assert.doesNotMatch(
    report,
    /\n    line-1\r?\n/,
  );
});
