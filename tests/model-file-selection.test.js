import assert from "node:assert/strict";
import test from "node:test";

import {
  selectFilesWithModel,
  validateModelFileSelection,
} from "../src/model-file-selection.js";

const candidateContext = Object.freeze({
  entries: Object.freeze([
    Object.freeze({
      path: "src/AnimalRecord.jsx",
      score: 20,
      excerpt: "1: function Tierakte() {}",
    }),
    Object.freeze({
      path: "src/animal-record.css",
      score: 30,
      excerpt:
        "1: .photo { max-width: 100%; }",
    }),
  ]),
  promptText: [
    "DATEI: src/AnimalRecord.jsx",
    "1: function Tierakte() {}",
    "",
    "DATEI: src/animal-record.css",
    "1: .photo { max-width: 100%; }",
  ].join("\n"),
});

const validModelSelection = {
  selectedFiles: [
    {
      path: "src/AnimalRecord.jsx",
      objective:
        "Eine responsive Bildklasse verwenden.",
      reason:
        "Die Komponente erzeugt die Bilddarstellung.",
    },
    {
      path: "src/animal-record.css",
      objective:
        "Die Bildbreite auf kleinen Displays begrenzen.",
      reason:
        "Die Datei enthält die mobilen Styles.",
    },
  ],
};

test("akzeptiert ausschließlich reale Kandidaten", () => {
  const selectedFiles =
    validateModelFileSelection(
      validModelSelection,
      candidateContext,
    );

  assert.deepEqual(
    selectedFiles.map(
      (selection) =>
        selection.path,
    ),
    [
      "src/AnimalRecord.jsx",
      "src/animal-record.css",
    ],
  );

  assert.equal(
    Object.isFrozen(selectedFiles),
    true,
  );
});

test("lehnt erfundene Pfade ab", () => {
  assert.throws(
    () =>
      validateModelFileSelection(
        {
          selectedFiles: [
            {
              path:
                "src/InventedFile.js",
              objective:
                "Datei ändern.",
              reason: "Modellvorschlag",
            },
          ],
        },
        candidateContext,
      ),
    /nicht erlaubte Datei/,
  );
});

test("lehnt doppelte Dateien ab", () => {
  assert.throws(
    () =>
      validateModelFileSelection(
        {
          selectedFiles: [
            validModelSelection
              .selectedFiles[0],
            validModelSelection
              .selectedFiles[0],
          ],
        },
        candidateContext,
      ),
    /doppelt ausgewählt/,
  );
});

test("übergibt nur Kandidatenpfade an das Modellschema", async () => {
  let capturedRequest;

  const ollamaClient = {
    generateStructured:
      async (request) => {
        capturedRequest = request;

        return {
          data:
            validModelSelection,
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
    await selectFilesWithModel(
      {
        analysis: {
          problem:
            "Fotos sind mobil zu groß.",
          goal:
            "Bilder responsiv darstellen.",
        },
        candidateContext,
      },
      ollamaClient,
    );

  assert.deepEqual(
    capturedRequest
      .schema
      .properties
      .selectedFiles
      .items
      .properties
      .path
      .enum,
    [
      "src/AnimalRecord.jsx",
      "src/animal-record.css",
    ],
  );

  assert.equal(
    result.selectedFiles.length,
    2,
  );

  assert.equal(
    result.metrics.tokensPerSecond,
    2.4,
  );
});
