import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCandidateContext,
  candidateContextLimits,
} from "../src/candidate-context.js";

const analysis = {
  problem:
    "Fotos in Tierakten sind mobil zu groß.",
  goal:
    "Tieraktenbilder responsiv darstellen.",
  searchTerms: [
    "Tierakte",
    "responsive",
    "max-width",
  ],
  sourceHints: [
    "Bildkomponente",
    "CSS",
  ],
};

test("erzeugt zeilennummerierten Kontext rund um Treffer", () => {
  const lines = [
    "unrelated start",
    "another unrelated line",
    "before context",
    "function Tierakte() {",
    "  return image;",
    "}",
    "after context",
    "distant unrelated content",
    "final unrelated content",
  ];

  const result =
    buildCandidateContext({
      analysis,
      candidates: [
        {
          path: "src/AnimalRecord.js",
          score: 20,
        },
      ],
      readableContent: {
        files: [
          {
            path:
              "src/AnimalRecord.js",
            content:
              lines.join("\n"),
          },
        ],
      },
    });

  assert.equal(
    result.entries.length,
    1,
  );

  assert.match(
    result.promptText,
    /DATEI: src\/AnimalRecord\.js/,
  );

  assert.match(
    result.promptText,
    /4: function Tierakte/,
  );

  assert.match(
    result.promptText,
    /RELEVANZ: 20/,
  );
});

test("verwendet bei fehlenden Treffern einen begrenzten Anfangsausschnitt", () => {
  const lines = Array.from(
    {
      length: 100,
    },
    (_, index) =>
      `generic line ${index + 1}`,
  );

  const result =
    buildCandidateContext({
      analysis,
      candidates: [
        {
          path: "src/generic.js",
          score: 1,
        },
      ],
      readableContent: {
        files: [
          {
            path: "src/generic.js",
            content:
              lines.join("\n"),
          },
        ],
      },
    });

  assert.match(
    result.promptText,
    /1: generic line 1/,
  );

  assert.match(
    result.promptText,
    /40: generic line 40/,
  );

  assert.doesNotMatch(
    result.promptText,
    /41: generic line 41/,
  );
});

test("begrenzt Dateien und Zeichenzahl", () => {
  const candidates = Array.from(
    {
      length: 12,
    },
    (_, index) => ({
      path: `src/file-${index}.js`,
      score: 100 - index,
    }),
  );

  const readableContent = {
    files: candidates.map(
      (candidate) => ({
        path: candidate.path,
        content:
          "Tierakte " +
          "x".repeat(5000),
      }),
    ),
  };

  const result =
    buildCandidateContext({
      analysis,
      candidates,
      readableContent,
    });

  assert.equal(
    result.entries.length <=
      candidateContextLimits.maximumFiles,
    true,
  );

  assert.equal(
    result.totalCharacters <=
      candidateContextLimits
        .maximumTotalCharacters,
    true,
  );

  assert.equal(
    result.entries.every(
      (entry) =>
        entry.excerpt.length <=
        candidateContextLimits
          .maximumCharactersPerFile +
          40,
    ),
    true,
  );
});
