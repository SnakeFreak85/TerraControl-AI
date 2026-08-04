import assert from "node:assert/strict";
import test from "node:test";

import { createPreviewWorkflow } from "../src/preview-workflow.js";

test("führt ein Problem als einen gemeinsamen Vorschau-Auftrag aus", () => {
  const result = createPreviewWorkflow(
    {
      problem:
        "Die Fotos in den Tierakten sind auf Smartphones zu groß.",
      repositoryPath: ".",
      relevantFiles: [
        "src/AnimalRecord.js",
        "src/animal-record.css",
      ],
      changes: [
        {
          file: "src/AnimalRecord.js",
          objective:
            "Responsive Bildklasse verwenden.",
          reason:
            "Die Komponente erzeugt die Bilddarstellung.",
        },
        {
          file: "src/animal-record.css",
          objective:
            "Bildbreite auf kleinen Displays begrenzen.",
          reason:
            "Die Datei enthält die mobilen Styles.",
        },
      ],
      validationScripts: [
        "test",
        "build",
      ],
    },
    {
      repositoryScan: {
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
      },
      project: {
        scripts: {
          build: "node build.js",
          test: "node --test",
        },
      },
      workOrderOptions: {
        idFactory: () => "work-order-001",
        clock: () =>
          new Date("2026-08-04T20:00:00.000Z"),
      },
    },
  );

  assert.equal(
    result.workOrder.id,
    "work-order-001",
  );

  assert.equal(
    result.workOrder.status,
    "planned",
  );

  assert.equal(
    result.workOrder.plannedChanges.length,
    2,
  );

  assert.deepEqual(
    result.workOrder.validationScripts,
    ["test", "build"],
  );

  assert.match(
    result.preview,
    /ein gemeinsamer|Änderungsvorschau/i,
  );

  assert.match(
    result.preview,
    /Keine Datei wurde verändert/,
  );
});
