export const diffPreviewLimits = Object.freeze({
  maximumInputLinesPerFile: 2000,
  maximumOutputLinesPerFile: 300,
  contextLines: 3,
});

function splitLines(content) {
  return content
    .replaceAll("\r\n", "\n")
    .split("\n");
}

function createLineOperations(
  originalLines,
  proposedLines,
) {
  const rowCount = originalLines.length + 1;
  const columnCount = proposedLines.length + 1;

  const table = Array.from(
    {
      length: rowCount,
    },
    () => new Uint16Array(columnCount),
  );

  for (
    let originalIndex =
      originalLines.length - 1;
    originalIndex >= 0;
    originalIndex -= 1
  ) {
    for (
      let proposedIndex =
        proposedLines.length - 1;
      proposedIndex >= 0;
      proposedIndex -= 1
    ) {
      table[originalIndex][proposedIndex] =
        originalLines[originalIndex] ===
        proposedLines[proposedIndex]
          ? table[originalIndex + 1][
              proposedIndex + 1
            ] + 1
          : Math.max(
              table[originalIndex + 1][
                proposedIndex
              ],
              table[originalIndex][
                proposedIndex + 1
              ],
            );
    }
  }

  const operations = [];

  let originalIndex = 0;
  let proposedIndex = 0;

  while (
    originalIndex < originalLines.length &&
    proposedIndex < proposedLines.length
  ) {
    if (
      originalLines[originalIndex] ===
      proposedLines[proposedIndex]
    ) {
      operations.push({
        type: "context",
        line: originalLines[originalIndex],
      });

      originalIndex += 1;
      proposedIndex += 1;
      continue;
    }

    if (
      table[originalIndex + 1][proposedIndex] >=
      table[originalIndex][proposedIndex + 1]
    ) {
      operations.push({
        type: "removed",
        line: originalLines[originalIndex],
      });

      originalIndex += 1;
    } else {
      operations.push({
        type: "added",
        line: proposedLines[proposedIndex],
      });

      proposedIndex += 1;
    }
  }

  while (originalIndex < originalLines.length) {
    operations.push({
      type: "removed",
      line: originalLines[originalIndex],
    });

    originalIndex += 1;
  }

  while (proposedIndex < proposedLines.length) {
    operations.push({
      type: "added",
      line: proposedLines[proposedIndex],
    });

    proposedIndex += 1;
  }

  return operations;
}

function selectContextOperations(operations) {
  const includedIndexes = new Set();

  operations.forEach((operation, index) => {
    if (operation.type === "context") {
      return;
    }

    const firstIndex = Math.max(
      0,
      index - diffPreviewLimits.contextLines,
    );

    const lastIndex = Math.min(
      operations.length - 1,
      index + diffPreviewLimits.contextLines,
    );

    for (
      let contextIndex = firstIndex;
      contextIndex <= lastIndex;
      contextIndex += 1
    ) {
      includedIndexes.add(contextIndex);
    }
  });

  const selected = [];
  let previousIndex = -2;

  for (const index of [...includedIndexes].sort(
    (left, right) => left - right,
  )) {
    if (index > previousIndex + 1) {
      selected.push({
        type: "separator",
        line: "...",
      });
    }

    selected.push(operations[index]);
    previousIndex = index;
  }

  return selected;
}

function formatOperation(operation) {
  if (operation.type === "added") {
    return `+ ${operation.line}`;
  }

  if (operation.type === "removed") {
    return `- ${operation.line}`;
  }

  if (operation.type === "separator") {
    return "  ...";
  }

  return `  ${operation.line}`;
}

export function createDiffPreview(
  draftedWorkOrder,
) {
  if (
    !draftedWorkOrder ||
    draftedWorkOrder.status !== "drafted" ||
    !Array.isArray(draftedWorkOrder.drafts)
  ) {
    throw new Error(
      "Eine Diff-Vorschau benötigt einen Arbeitsauftrag mit Änderungsvorschlägen.",
    );
  }

  const sections = [
    "=== TerraControl AI – Diff-Vorschau ===",
  ];

  for (const draft of draftedWorkOrder.drafts) {
    const originalLines = splitLines(
      draft.originalContent,
    );

    const proposedLines = splitLines(
      draft.proposedContent,
    );

    if (
      originalLines.length >
        diffPreviewLimits.maximumInputLinesPerFile ||
      proposedLines.length >
        diffPreviewLimits.maximumInputLinesPerFile
    ) {
      throw new RangeError(
        `Datei enthält zu viele Zeilen für die Diff-Vorschau: ${draft.file}`,
      );
    }

    const operations = createLineOperations(
      originalLines,
      proposedLines,
    );

    const additions = operations.filter(
      (operation) => operation.type === "added",
    ).length;

    const deletions = operations.filter(
      (operation) => operation.type === "removed",
    ).length;

    const selectedOperations =
      selectContextOperations(operations);

    const outputWasLimited =
      selectedOperations.length >
      diffPreviewLimits.maximumOutputLinesPerFile;

    const visibleOperations =
      selectedOperations.slice(
        0,
        diffPreviewLimits.maximumOutputLinesPerFile,
      );

    sections.push(
      "",
      `--- a/${draft.file}`,
      `+++ b/${draft.file}`,
      `Änderungen: +${additions} -${deletions}`,
      ...visibleOperations.map(formatOperation),
    );

    if (outputWasLimited) {
      sections.push(
        "  ... Diff-Ausgabe wurde sicher gekürzt ...",
      );
    }
  }

  sections.push(
    "",
    "Sicherheitsstatus:",
    "- Vorschläge befinden sich nur im Arbeitsspeicher.",
    "- Keine Datei wurde gespeichert.",
  );

  return sections.join("\n");
}
