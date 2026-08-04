import assert from "node:assert/strict";
import test from "node:test";

import { createChangePlan } from "../src/change-plan.js";
import { selectRelevantFiles } from "../src/file-selection.js";
import { createWorkOrder } from "../src/work-order.js";

function createSelectedWorkOrder() {
  const workOrder = createWorkOrder(
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

  return selectRelevantFiles(
    workOrder,
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
}

const project = {
  scripts: {
    build: "node build.js",
    test: "node --test",
  },
};

const validChanges = [
  {
    file: "src/AnimalRecord.js",
    objective:
      "Bild erhält eine responsive CSS-Klasse.",
    reason:
      "Die Komponente erzeugt die Bilddarstellung.",
  },
  {
    file: "src/animal-record.css",
    objective:
      "Bildbreite auf kleinen Displays begrenzen.",
    reason:
      "Die Datei enthält die Darstellungsregeln.",
  },
];

test("erstellt einen gemeinsamen Plan für mehrere Dateien", () => {
  const plan = createChangePlan(
    createSelectedWorkOrder(),
    {
      changes: validChanges,
      validationScripts: ["test", "build"],
    },
    project,
  );

  assert.equal(plan.status, "planned");
  assert.equal(plan.plannedChanges.length, 2);

  assert.deepEqual(
    plan.validationScripts,
    ["test", "build"],
  );

  assert.equal(Object.isFrozen(plan), true);
  assert.equal(
    Object.isFrozen(plan.plannedChanges),
    true,
  );
});

test("entfernt doppelte Validierungsskripte", () => {
  const plan = createChangePlan(
    createSelectedWorkOrder(),
    {
      changes: validChanges,
      validationScripts: ["test", "test"],
    },
    project,
  );

  assert.deepEqual(
    plan.validationScripts,
    ["test"],
  );
});

test("lehnt nicht ausgewählte Dateien ab", () => {
  assert.throws(
    () =>
      createChangePlan(
        createSelectedWorkOrder(),
        {
          changes: [
            {
              file: "src/unknown.js",
              objective: "Datei ändern.",
              reason: "Test",
            },
          ],
        },
        project,
      ),
    /nicht als relevant ausgewählt/,
  );
});

test("lehnt doppelte Dateiänderungen ab", () => {
  assert.throws(
    () =>
      createChangePlan(
        createSelectedWorkOrder(),
        {
          changes: [
            validChanges[0],
            validChanges[0],
          ],
        },
        project,
      ),
    /nur einmal/,
  );
});

test("lehnt unbekannte Validierungsskripte ab", () => {
  assert.throws(
    () =>
      createChangePlan(
        createSelectedWorkOrder(),
        {
          changes: validChanges,
          validationScripts: [
            "test",
            "delete-everything",
          ],
        },
        project,
      ),
    /Unbekanntes Validierungsskript/,
  );
});
