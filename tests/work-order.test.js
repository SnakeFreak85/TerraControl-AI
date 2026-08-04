import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  createWorkOrder,
  workOrderLimits,
} from "../src/work-order.js";

const fixedOptions = {
  idFactory: () => "work-order-001",
  clock: () => new Date("2026-08-04T20:00:00.000Z"),
};

test("erstellt genau einen unveränderlichen Arbeitsauftrag", () => {
  const workOrder = createWorkOrder(
    {
      problem:
        "Die Fotos in den Tierakten sind mobil zu groß.",
      repositoryPath: "example-repository",
    },
    fixedOptions,
  );

  assert.equal(workOrder.id, "work-order-001");

  assert.equal(
    workOrder.problem,
    "Die Fotos in den Tierakten sind mobil zu groß.",
  );

  assert.equal(
    workOrder.repositoryPath,
    path.resolve("example-repository"),
  );

  assert.equal(workOrder.status, "created");
  assert.equal(
    workOrder.createdAt,
    "2026-08-04T20:00:00.000Z",
  );

  assert.deepEqual(workOrder.relevantFiles, []);
  assert.deepEqual(workOrder.plannedChanges, []);

  assert.equal(Object.isFrozen(workOrder), true);
  assert.equal(
    Object.isFrozen(workOrder.relevantFiles),
    true,
  );
});

test("entfernt überflüssige Leerzeichen", () => {
  const workOrder = createWorkOrder(
    {
      problem: "  Fehler beheben  ",
      repositoryPath: ".",
    },
    fixedOptions,
  );

  assert.equal(workOrder.problem, "Fehler beheben");
});

test("lehnt eine leere Problembeschreibung ab", () => {
  assert.throws(
    () =>
      createWorkOrder(
        {
          problem: "   ",
          repositoryPath: ".",
        },
        fixedOptions,
      ),
    /Problembeschreibung/,
  );
});

test("lehnt eine überlange Problembeschreibung ab", () => {
  assert.throws(
    () =>
      createWorkOrder(
        {
          problem: "x".repeat(
            workOrderLimits.maximumProblemLength + 1,
          ),
          repositoryPath: ".",
        },
        fixedOptions,
      ),
    /höchstens/,
  );
});
