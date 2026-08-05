export const candidateContextLimits =
  Object.freeze({
    maximumFiles: 8,
    maximumCharactersPerFile: 3000,
    maximumTotalCharacters: 12000,
    contextLines: 3,
  });

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}

function extractSearchTokens(
  analysis,
) {
  const values = [
    analysis.problem,
    analysis.goal,
    ...analysis.searchTerms,
    ...analysis.sourceHints,
  ];

  const tokens = new Set();

  for (const value of values) {
    for (
      const token of
      normalizeText(value).split(
        /[^a-z0-9_-]+/,
      )
    ) {
      if (token.length >= 4) {
        tokens.add(token);
      }
    }
  }

  return [...tokens];
}

function selectLineIndexes(
  lines,
  searchTokens,
) {
  const indexes = new Set();

  lines.forEach((line, index) => {
    const normalizedLine =
      normalizeText(line);

    if (
      searchTokens.some(
        (token) =>
          normalizedLine.includes(
            token,
          ),
      )
    ) {
      const firstIndex = Math.max(
        0,
        index -
          candidateContextLimits.contextLines,
      );

      const lastIndex = Math.min(
        lines.length - 1,
        index +
          candidateContextLimits.contextLines,
      );

      for (
        let contextIndex = firstIndex;
        contextIndex <= lastIndex;
        contextIndex += 1
      ) {
        indexes.add(contextIndex);
      }
    }
  });

  if (indexes.size === 0) {
    const fallbackLineCount =
      Math.min(lines.length, 40);

    for (
      let index = 0;
      index < fallbackLineCount;
      index += 1
    ) {
      indexes.add(index);
    }
  }

  return [...indexes].sort(
    (left, right) => left - right,
  );
}

function createExcerpt(
  content,
  searchTokens,
) {
  const lines = content
    .replaceAll("\r\n", "\n")
    .split("\n");

  const selectedIndexes =
    selectLineIndexes(
      lines,
      searchTokens,
    );

  const excerptLines = [];
  let previousIndex = -2;

  for (
    const index of selectedIndexes
  ) {
    if (index > previousIndex + 1) {
      excerptLines.push("...");
    }

    excerptLines.push(
      `${index + 1}: ${lines[index]}`,
    );

    previousIndex = index;
  }

  const completeExcerpt =
    excerptLines.join("\n");

  if (
    completeExcerpt.length <=
    candidateContextLimits
      .maximumCharactersPerFile
  ) {
    return {
      excerpt: completeExcerpt,
      truncated: false,
    };
  }

  return {
    excerpt:
      completeExcerpt.slice(
        0,
        candidateContextLimits
          .maximumCharactersPerFile,
      ) +
      "\n... [Dateiausschnitt gekürzt]",
    truncated: true,
  };
}

export function buildCandidateContext(
  {
    analysis,
    candidates,
    readableContent,
  },
) {
  if (
    !analysis ||
    !Array.isArray(candidates) ||
    !readableContent ||
    !Array.isArray(
      readableContent.files,
    )
  ) {
    throw new Error(
      "Für den Kandidatenkontext fehlen gültige Eingaben.",
    );
  }

  const contentByPath = new Map(
    readableContent.files.map(
      (file) => [
        file.path,
        file.content,
      ],
    ),
  );

  const searchTokens =
    extractSearchTokens(analysis);

  const entries = [];
  let totalCharacters = 0;

  for (
    const candidate of candidates.slice(
      0,
      candidateContextLimits.maximumFiles,
    )
  ) {
    const content =
      contentByPath.get(
        candidate.path,
      );

    if (typeof content !== "string") {
      continue;
    }

    const {
      excerpt,
      truncated,
    } = createExcerpt(
      content,
      searchTokens,
    );

    const formattedEntry = [
      `DATEI: ${candidate.path}`,
      `RELEVANZ: ${candidate.score}`,
      excerpt,
    ].join("\n");

    if (
      totalCharacters +
        formattedEntry.length >
      candidateContextLimits
        .maximumTotalCharacters
    ) {
      break;
    }

    totalCharacters +=
      formattedEntry.length;

    entries.push(
      Object.freeze({
        path: candidate.path,
        score: candidate.score,
        excerpt,
        truncated,
      }),
    );
  }

  if (entries.length === 0) {
    throw new Error(
      "Es konnte kein sicherer Kandidatenkontext erstellt werden.",
    );
  }

  return Object.freeze({
    entries:
      Object.freeze(entries),
    totalCharacters,
    promptText:
      entries
        .map((entry) =>
          [
            `DATEI: ${entry.path}`,
            `RELEVANZ: ${entry.score}`,
            entry.excerpt,
          ].join("\n"),
        )
        .join("\n\n"),
  });
}
