export const fileRankingLimits =
  Object.freeze({
    maximumCandidates: 12,
    maximumReasonsPerFile: 8,
  });

const ignoredSearchTokens = new Set([
  "code",
  "component",
  "components",
  "datei",
  "dateien",
  "file",
  "files",
  "public",
  "source",
  "src",
  "style",
  "styles",
]);

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}

function extractTokens(values) {
  const tokens = new Set();

  for (const value of values) {
    const normalizedValue =
      normalizeText(value);

    for (
      const token of
      normalizedValue.split(
        /[^a-z0-9_-]+/,
      )
    ) {
      if (
        token.length >= 3 &&
        !ignoredSearchTokens.has(
          token,
        )
      ) {
        tokens.add(token);
      }
    }
  }

  return [...tokens];
}

function addReason(
  reasons,
  reason,
) {
  if (
    reasons.length <
      fileRankingLimits.maximumReasonsPerFile &&
    !reasons.includes(reason)
  ) {
    reasons.push(reason);
  }
}

export function rankRelevantFiles(
  {
    analysis,
    repositoryScan,
    readableContent,
  },
  {
    maximumCandidates =
      fileRankingLimits.maximumCandidates,
  } = {},
) {
  if (
    !analysis ||
    !Array.isArray(
      analysis.searchTerms,
    ) ||
    !Array.isArray(
      analysis.sourceHints,
    )
  ) {
    throw new Error(
      "Eine validierte Problemanalyse wird benötigt.",
    );
  }

  if (
    !repositoryScan ||
    !Array.isArray(
      repositoryScan.files,
    ) ||
    !readableContent ||
    !Array.isArray(
      readableContent.files,
    )
  ) {
    throw new Error(
      "Ein sicherer Repository-Scan mit lesbaren Inhalten wird benötigt.",
    );
  }

  if (
    !Number.isInteger(
      maximumCandidates,
    ) ||
    maximumCandidates < 1 ||
    maximumCandidates >
      fileRankingLimits.maximumCandidates
  ) {
    throw new RangeError(
      "Die maximale Kandidatenzahl ist ungültig.",
    );
  }

  const scannedPaths = new Set(
    repositoryScan.files.map(
      (file) => file.path,
    ),
  );

  const searchPhrases = [
    ...analysis.searchTerms,
    ...analysis.sourceHints,
  ]
    .map(normalizeText)
    .filter(
      (value) => value.length >= 3,
    );

  const searchTokens = extractTokens([
    analysis.problem,
    analysis.goal,
    ...analysis.searchTerms,
    ...analysis.sourceHints,
  ]);

  const candidates = [];

  for (
    const file of readableContent.files
  ) {
    if (
      !scannedPaths.has(file.path)
    ) {
      continue;
    }

    const normalizedPath =
      normalizeText(file.path);

    const normalizedContent =
      normalizeText(file.content);

    let score = 0;
    const reasons = [];

    for (
      const phrase of searchPhrases
    ) {
      if (
        normalizedPath.includes(
          phrase,
        )
      ) {
        score += 10;

        addReason(
          reasons,
          `Pfad enthält „${phrase}“`,
        );
      } else if (
        normalizedContent.includes(
          phrase,
        )
      ) {
        score += 5;

        addReason(
          reasons,
          `Inhalt enthält „${phrase}“`,
        );
      }
    }

    for (const token of searchTokens) {
      if (
        normalizedPath.includes(token)
      ) {
        score += 4;

        addReason(
          reasons,
          `Pfad passt zu „${token}“`,
        );
      } else if (
        normalizedContent.includes(
          token,
        )
      ) {
        score += 1;

        addReason(
          reasons,
          `Inhalt passt zu „${token}“`,
        );
      }
    }

    if (score > 0) {
      candidates.push(
        Object.freeze({
          path: file.path,
          score,
          reasons:
            Object.freeze(reasons),
        }),
      );
    }
  }

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.path.localeCompare(
        right.path,
      ),
  );

  return Object.freeze(
    candidates.slice(
      0,
      maximumCandidates,
    ),
  );
}
