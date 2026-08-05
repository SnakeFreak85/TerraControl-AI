import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeProblem,
  problemAnalysisSchema,
  validateProblemAnalysis,
} from "../src/problem-analysis.js";

const project = Object.freeze({
  type: "node",
  packageManager: "npm",
  scripts: Object.freeze({
    build: "node build.js",
    check: "node check.js",
    test: "node --test",
  }),
});

const validModelData = {
  problem:
    "Fotos sind auf Smartphones zu groß.",
  goal:
    "Bilder responsiv innerhalb der Tierakte darstellen.",
  searchTerms: [
    "Tierakte",
    "responsive image",
    "max-width",
  ],
  sourceHints: [
    "Komponenten für Tierakten",
    "CSS-Dateien für Bilddarstellung",
    "src/components/InventedFile.js",
  ],
  validationScripts: [
    "test",
    "lint",
    "build",
  ],
};

test("validiert Modellhinweise und filtert unbekannte Skripte", () => {
  const analysis =
    validateProblemAnalysis(
      validModelData,
      project,
    );

  assert.deepEqual(
    analysis.validationScripts,
    ["test", "build"],
  );

  assert.deepEqual(
    analysis.searchTerms,
    [
      "Tierakte",
      "responsive image",
      "max-width",
    ],
  );

  assert.equal(
    analysis.sourceHints.includes(
      "src/components/InventedFile.js",
    ),
    true,
  );

  assert.equal(
    Object.hasOwn(
      analysis,
      "relevantFiles",
    ),
    false,
  );
});

test("verwendet vorhandene sichere Fallback-Skripte", () => {
  const analysis =
    validateProblemAnalysis(
      {
        ...validModelData,
        validationScripts: [
          "unknown-script",
        ],
      },
      project,
    );

  assert.deepEqual(
    analysis.validationScripts,
    [
      "test",
      "check",
      "build",
    ],
  );
});

test("lehnt unvollständige Modellantworten ab", () => {
  assert.throws(
    () =>
      validateProblemAnalysis(
        {
          ...validModelData,
          searchTerms: [],
        },
        project,
      ),
    /ungültige Anzahl/,
  );
});

test("verwendet das JSON-Schema beim lokalen Modellaufruf", async () => {
  let capturedRequest;

  const ollamaClient = {
    generateStructured:
      async (request) => {
        capturedRequest = request;

        return {
          data: validModelData,
          metrics: {
            model:
              "qwen2.5-coder:7b",
            generatedTokens: 100,
            totalDurationMs: 80000,
            tokensPerSecond: 2.5,
          },
        };
      },
  };

  const result = await analyzeProblem(
    {
      problem:
        "Fotos sind auf Smartphones zu groß.",
      project,
    },
    ollamaClient,
  );

  assert.deepEqual(
    capturedRequest.schema,
    problemAnalysisSchema,
  );

  assert.equal(
    capturedRequest.maximumOutputTokens,
    500,
  );

  assert.equal(
    result.analysis.goal,
    validModelData.goal,
  );

  assert.equal(
    result.metrics.tokensPerSecond,
    2.5,
  );
});
