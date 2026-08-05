import assert from "node:assert/strict";
import test from "node:test";

import {
  rankRelevantFiles,
} from "../src/file-ranking.js";

const analysis = Object.freeze({
  problem:
    "Fotos in Tierakten sind mobil zu groß.",
  goal:
    "Bilder in Tierakten responsiv darstellen.",
  searchTerms: Object.freeze([
    "Tierakte",
    "responsive image",
    "max-width",
  ]),
  sourceHints: Object.freeze([
    "Tierakten-Komponente",
    "CSS für Bilddarstellung",
    "src/components/InventedFile.js",
  ]),
});

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
        "export function Tierakte() { return <img className='animal-photo' />; }",
    },
    {
      path: "src/animal-record.css",
      content:
        ".animal-photo { max-width: 100%; height: auto; } /* responsive image */",
    },
    {
      path: "src/unrelated.js",
      content:
        "export const unrelated = true;",
    },
    {
      path: "src/not-scanned.js",
      content:
        "Tierakte responsive image max-width",
    },
  ],
};

test("ordnet ausschließlich vorhandene sichere Dateien nach Relevanz", () => {
  const candidates =
    rankRelevantFiles({
      analysis,
      repositoryScan,
      readableContent,
    });

  assert.deepEqual(
    candidates.map(
      (candidate) =>
        candidate.path,
    ),
    [
      "src/animal-record.css",
      "src/AnimalRecord.jsx",
    ],
  );

  assert.equal(
    candidates[0].score >
      candidates[1].score,
    true,
  );

  assert.equal(
    candidates.some(
      (candidate) =>
        candidate.path.includes(
          "InventedFile",
        ),
    ),
    false,
  );

  assert.equal(
    candidates.some(
      (candidate) =>
        candidate.path ===
        "src/not-scanned.js",
    ),
    false,
  );
});

test("begrenzt die Kandidatenzahl", () => {
  const candidates =
    rankRelevantFiles(
      {
        analysis,
        repositoryScan,
        readableContent,
      },
      {
        maximumCandidates: 1,
      },
    );

  assert.equal(candidates.length, 1);

  assert.equal(
    candidates[0].path,
    "src/animal-record.css",
  );
});

test("liefert keine erfundenen Treffer ohne lokale Übereinstimmung", () => {
  const candidates =
    rankRelevantFiles({
      analysis: {
        problem: "Completely unknown subject",
        goal: "Unknown target",
        searchTerms: [
          "nonexistent-search-term",
        ],
        sourceHints: [
          "src/invented/ghost.xyz",
        ],
      },
      repositoryScan,
      readableContent,
    });

  assert.deepEqual(candidates, []);
});
