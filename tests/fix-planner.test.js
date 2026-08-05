import assert from "node:assert/strict";
import test from "node:test";

import {
  planRepositoryFix,
} from "../src/fix-planner.js";

const repositoryScan = {
  files: [
    {
      path: "src/AnimalRecord.jsx",
      sizeBytes: 100,
    },
    {
      path: "src/animal-record.css",
      sizeBytes: 100,
    },
    {
      path: "src/unrelated.js",
      sizeBytes: 100,
    },
  ],
};

const readableContent = {
  files: [
    {
      path: "src/AnimalRecord.jsx",
      content:
        "export function Tierakte() { return <img className='photo' />; }",
    },
    {
      path: "src/animal-record.css",
      content:
        ".photo { max-width: 100%; height: auto; } /* responsive */",
    },
    {
      path: "src/unrelated.js",
      content:
        "export const unrelated = true;",
    },
  ],
};

const project = {
  type: "node",
  packageManager: "npm",
  scripts: {
    check:
      "node --check src/index.js",
    test:
      "node --test",
  },
};

test("erstellt aus zwei Modellschritten einen sicheren gemeinsamen Plan", async () => {
  let modelCall = 0;

  const ollamaClient = {
    generateStructured:
      async () => {
        modelCall += 1;

        if (modelCall === 1) {
          return {
            data: {
              problem:
                "Fotos in Tierakten sind mobil zu groß.",
              goal:
                "Bilder responsiv darstellen.",
              searchTerms: [
                "Tierakte",
                "responsive",
                "max-width",
              ],
              sourceHints: [
                "Tierakten-Komponente",
                "CSS-Bilddarstellung",
                "src/InventedFile.js",
              ],
              validationScripts: [
                "test",
                "lint",
              ],
            },
            metrics: {
              model:
                "qwen2.5-coder:7b",
              generatedTokens: 100,
              totalDurationMs: 80000,
              tokensPerSecond: 2.5,
            },
          };
        }

        return {
          data: {
            selectedFiles: [
              {
                path:
                  "src/AnimalRecord.jsx",
                objective:
                  "Responsive Bildklasse verwenden.",
                reason:
                  "Die Komponente zeigt das Tieraktenbild.",
              },
              {
                path:
                  "src/animal-record.css",
                objective:
                  "Bildbreite mobil begrenzen.",
                reason:
                  "Die Datei enthält die Bildstyles.",
              },
            ],
          },
          metrics: {
            model:
              "qwen2.5-coder:7b",
            generatedTokens: 120,
            totalDurationMs: 90000,
            tokensPerSecond: 2.4,
          },
        };
      },
  };

  const result =
    await planRepositoryFix(
      {
        problem:
          "Fotos in Tierakten sind mobil zu groß.",
        repositoryPath:
          "example-repository",
        repositoryScan,
        readableContent,
        project,
      },
      ollamaClient,
      {
        workOrderOptions: {
          idFactory: () =>
            "work-order-001",
          clock: () =>
            new Date(
              "2026-08-05T10:00:00.000Z",
            ),
        },
      },
    );

  assert.equal(modelCall, 2);

  assert.equal(
    result.workOrder.status,
    "planned",
  );

  assert.deepEqual(
    result.workOrder.relevantFiles,
    [
      "src/AnimalRecord.jsx",
      "src/animal-record.css",
    ],
  );

  assert.deepEqual(
    result.workOrder.validationScripts,
    ["test"],
  );

  assert.equal(
    result.candidates.some(
      (candidate) =>
        candidate.path.includes(
          "InventedFile",
        ),
    ),
    false,
  );

  assert.match(
    result.preview,
    /Keine Datei wurde verändert/,
  );

  assert.equal(
    result.metrics
      .fileSelection
      .tokensPerSecond,
    2.4,
  );
});

test("bricht ohne lokale Dateitreffer vor der Dateiauswahl ab", async () => {
  let modelCall = 0;

  const ollamaClient = {
    generateStructured:
      async () => {
        modelCall += 1;

        return {
          data: {
            problem:
              "Unbekanntes Problem",
            goal:
              "Unbekanntes Ziel",
            searchTerms: [
              "definitely-nonexistent",
            ],
            sourceHints: [
              "ghost-file.xyz",
            ],
            validationScripts: [
              "test",
            ],
          },
          metrics: {},
        };
      },
  };

  await assert.rejects(
    planRepositoryFix(
      {
        problem:
          "Unbekanntes Problem",
        repositoryPath:
          "example-repository",
        repositoryScan,
        readableContent,
        project,
      },
      ollamaClient,
    ),
    /keine passenden realen Repository-Dateien/,
  );

  assert.equal(modelCall, 1);
});
