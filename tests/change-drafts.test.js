import assert from "node:assert/strict";
import test from "node:test";

import { createChangeDrafts } from "../src/change-drafts.js";
import { repositoryLimits } from "../src/repository-policy.js";

const plannedWorkOrder = Object.freeze({
  id: "work-order-001",
  problem: "Fotos sind mobil zu groß.",
  repositoryPath: "example-repository",
  status: "planned",
  relevantFiles: Object.freeze([
    "src/component.js",
    "src/styles.css",
  ]),
  plannedChanges: Object.freeze([
    Object.freeze({
      file: "src/component.js",
      objective: "Bildklasse ergänzen.",
      reason: "Komponente zeigt das Bild.",
    }),
    Object.freeze({
      file: "src/styles.css",
      objective: "Mobile Bildbreite begrenzen.",
      reason: "Datei enthält die Styles.",
    }),
  ]),
  validationScripts: Object.freeze(["test"]),
});

const readableContent = {
  files: [
    {
      path: "src/component.js",
      content: '<img className="photo" />',
    },
    {
      path: "src/styles.css",
      content: ".photo { width: 800px; }",
    },
  ],
};

const validProposals = [
  {
    file: "src/component.js",
    content:
      '<img className="photo responsive-photo" />',
  },
  {
    file: "src/styles.css",
    content:
      ".photo { max-width: 100%; height: auto; }",
  },
];

test("erstellt unveränderliche Entwürfe im Arbeitsspeicher", () => {
  const draftedWorkOrder = createChangeDrafts(
    plannedWorkOrder,
    readableContent,
    validProposals,
  );

  assert.equal(
    draftedWorkOrder.status,
    "drafted",
  );

  assert.equal(
    draftedWorkOrder.drafts.length,
    2,
  );

  assert.equal(
    draftedWorkOrder.drafts[0].originalContent,
    '<img className="photo" />',
  );

  assert.equal(
    draftedWorkOrder.drafts[0].proposedContent,
    '<img className="photo responsive-photo" />',
  );

  assert.equal(
    Object.isFrozen(draftedWorkOrder),
    true,
  );

  assert.equal(
    plannedWorkOrder.status,
    "planned",
  );
});

test("lehnt nicht geplante Dateien ab", () => {
  assert.throws(
    () =>
      createChangeDrafts(
        plannedWorkOrder,
        readableContent,
        [
          ...validProposals,
          {
            file: "src/unknown.js",
            content: "changed",
          },
        ],
      ),
    /nicht zum freigegebenen Änderungsplan/,
  );
});

test("lehnt unveränderte Inhalte ab", () => {
  assert.throws(
    () =>
      createChangeDrafts(
        plannedWorkOrder,
        readableContent,
        [
          {
            file: "src/component.js",
            content:
              '<img className="photo" />',
          },
          validProposals[1],
        ],
      ),
    /keine Änderung/,
  );
});

test("lehnt unvollständige Vorschläge ab", () => {
  assert.throws(
    () =>
      createChangeDrafts(
        plannedWorkOrder,
        readableContent,
        [validProposals[0]],
      ),
    /fehlt ein Änderungsvorschlag/,
  );
});

test("lehnt zu große Vorschläge ab", () => {
  assert.throws(
    () =>
      createChangeDrafts(
        plannedWorkOrder,
        readableContent,
        [
          {
            file: "src/component.js",
            content: "x".repeat(
              repositoryLimits.maximumFileSizeBytes +
                1,
            ),
          },
          validProposals[1],
        ],
      ),
    /zu groß/,
  );
});
