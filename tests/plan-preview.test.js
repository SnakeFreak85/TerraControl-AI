import assert from "node:assert/strict";
import test from "node:test";

import { createChangePlan } from "../src/change-plan.js";
import { selectRelevantFiles } from "../src/file-selection.js";
import { formatChangePlanPreview } from "../src/plan-preview.js";
import { createWorkOrder } from "../src/work-order.js";

function createPlannedWorkOrder() {
  const created = createWorkOrder(
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

  const selected = selectRelevantFiles(
    created,
    [
      "src/AnimalRecord.js",
      "src/animal-record.css",
    ],
    {
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
  );

  return createChangePlan(
    selected,
    {
      changes: [
        {
          file: "src/AnimalRecord.js",
          objective:
            "Responsive CSS-Klasse verwenden.",
          reason:
            "Die Komponente zeigt das Bild an.",
        },
        {
          file: "src/animal-record.css",
          objective:
            "Mobile Bildbreite begrenzen.",
          reason:
            "Die Datei enthält die Styles.",
        },
      ],
      validationScripts: ["test"],
    },
    {
      scripts: {
        test: "node --test",
      },
    },
  );
}

test("zeigt alle Änderungen als einen Auftrag an", () => {
  const workOrder = createPlannedWorkOrder();

  const preview =
    formatChangePlanPreview(workOrder);

  assert.match(preview, /work-order-001/);
  assert.match(preview, /Fotos sind mobil zu groß/);
  assert.match(preview, /src\/AnimalRecord\.js/);
  assert.match(preview, /src\/animal-record\.css/);
  assert.match(preview, /Responsive CSS-Klasse/);
  assert.match(preview, /Mobile Bildbreite/);
  assert.match(preview, /- test/);
  assert.match(
    preview,
    /Keine Datei wurde verändert/,
  );

  assert.equal(workOrder.status, "planned");
});

test("lehnt unvollständige Arbeitsaufträge ab", () => {
  const created = createWorkOrder(
    {
      problem: "Testproblem",
      repositoryPath: ".",
    },
    {
      idFactory: () => "work-order-002",
      clock: () =>
        new Date("2026-08-04T20:00:00.000Z"),
    },
  );

  assert.throws(
    () => formatChangePlanPreview(created),
    /vollständig geplanten Arbeitsauftrag/,
  );
});
