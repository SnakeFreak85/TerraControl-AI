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

test("erstellt lokal einen sicheren gemeinsamen Plan ohne Modellaufruf", async () => {
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
      undefined,
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

  assert.equal(
    result.workOrder.status,
    "planned",
  );

  assert.deepEqual(
    [...result.workOrder.relevantFiles].sort(),
    [
      "src/AnimalRecord.jsx",
      "src/animal-record.css",
    ].sort(),
  );

  assert.deepEqual(
    result.workOrder.validationScripts,
    ["test", "check"],
  );

  assert.equal(
    result.candidates.some(
      (candidate) =>
        candidate.path.includes(
          "unrelated",
        ),
    ),
    false,
  );

  assert.match(
    result.preview,
    /Keine Datei wurde verändert/,
  );

  assert.deepEqual(
    result.metrics,
    {
      mode: "local",
      modelCalls: 0,
    },
  );
});

test("bricht ohne lokale Dateitreffer ab", async () => {
  await assert.rejects(
    planRepositoryFix(
      {
        problem:
          "definitely-nonexistent ghost-file",
        repositoryPath:
          "example-repository",
        repositoryScan,
        readableContent,
        project,
      },
      undefined,
    ),
    /keine passenden realen Repository-Dateien/,
  );
});