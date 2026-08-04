import assert from "node:assert/strict";
import test from "node:test";

import {
  fileSelectionLimits,
  selectRelevantFiles,
} from "../src/file-selection.js";
import { createWorkOrder } from "../src/work-order.js";

function createTestWorkOrder() {
  return createWorkOrder(
    {
      problem: "Fotos sind mobil zu groß.",
      repositoryPath: ".",
    },
    {
      idFactory: () => "work-order-001",
      clock: () =>
        new Date("2026-08-04T20:00:00.000Z"),
    },
  );
}

const repositoryScan = {
  files: [
    {
      path: "src/AnimalRecord.js",
      sizeBytes: 100,
    },
    {
      path: "src/animal-record.css",
      sizeBytes: 200,
    },
  ],
};

test("wählt ausschließlich gescannte Dateien aus", () => {
  const originalWorkOrder = createTestWorkOrder();

  const selectedWorkOrder = selectRelevantFiles(
    originalWorkOrder,
    [
      "src/AnimalRecord.js",
      "src/animal-record.css",
    ],
    repositoryScan,
  );

  assert.equal(
    selectedWorkOrder.status,
    "files-selected",
  );

  assert.deepEqual(
    selectedWorkOrder.relevantFiles,
    [
      "src/AnimalRecord.js",
      "src/animal-record.css",
    ],
  );

  assert.equal(originalWorkOrder.status, "created");
  assert.deepEqual(originalWorkOrder.relevantFiles, []);
});

test("normalisiert Pfade und entfernt Duplikate", () => {
  const selectedWorkOrder = selectRelevantFiles(
    createTestWorkOrder(),
    [
      ".\\src\\AnimalRecord.js",
      "src/AnimalRecord.js",
    ],
    repositoryScan,
  );

  assert.deepEqual(
    selectedWorkOrder.relevantFiles,
    ["src/AnimalRecord.js"],
  );
});

test("lehnt unbekannte Dateien ab", () => {
  assert.throws(
    () =>
      selectRelevantFiles(
        createTestWorkOrder(),
        ["src/unknown.js"],
        repositoryScan,
      ),
    /nicht zum sicheren Repository-Scan/,
  );
});

test("lehnt Pfade außerhalb des Repositorys ab", () => {
  assert.throws(
    () =>
      selectRelevantFiles(
        createTestWorkOrder(),
        ["../secret.txt"],
        repositoryScan,
      ),
    /Ungültiger Repository-Pfad/,
  );
});

test("begrenzt die Anzahl relevanter Dateien", () => {
  const candidatePaths = Array.from(
    {
      length:
        fileSelectionLimits.maximumRelevantFiles + 1,
    },
    (_, index) => `src/file-${index}.js`,
  );

  assert.throws(
    () =>
      selectRelevantFiles(
        createTestWorkOrder(),
        candidatePaths,
        repositoryScan,
      ),
    /höchstens/,
  );
});
