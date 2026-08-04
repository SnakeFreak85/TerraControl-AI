import path from "node:path";

export const fileSelectionLimits = Object.freeze({
  maximumRelevantFiles: 20,
});

function normalizeRepositoryPath(filePath) {
  return filePath
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");
}

export function selectRelevantFiles(
  workOrder,
  candidatePaths,
  repositoryScan,
) {
  if (
    !workOrder ||
    workOrder.status !== "created"
  ) {
    throw new Error(
      "Dateien können nur für einen neu erstellten Arbeitsauftrag ausgewählt werden.",
    );
  }

  if (
    !Array.isArray(candidatePaths) ||
    candidatePaths.length === 0
  ) {
    throw new TypeError(
      "Mindestens eine relevante Datei muss ausgewählt werden.",
    );
  }

  if (
    candidatePaths.length >
    fileSelectionLimits.maximumRelevantFiles
  ) {
    throw new RangeError(
      `Es dürfen höchstens ${fileSelectionLimits.maximumRelevantFiles} relevante Dateien ausgewählt werden.`,
    );
  }

  if (
    !repositoryScan ||
    !Array.isArray(repositoryScan.files)
  ) {
    throw new TypeError(
      "Für die Dateiauswahl wird ein gültiger Repository-Scan benötigt.",
    );
  }

  const availablePaths = new Set(
    repositoryScan.files.map((file) => file.path),
  );

  const selectedPaths = [];

  for (const candidatePath of candidatePaths) {
    if (
      typeof candidatePath !== "string" ||
      candidatePath.trim().length === 0
    ) {
      throw new TypeError(
        "Jeder Dateipfad muss eine Zeichenkette sein.",
      );
    }

    const normalizedPath = normalizeRepositoryPath(
      candidatePath.trim(),
    );

    if (
      path.isAbsolute(normalizedPath) ||
      normalizedPath === ".." ||
      normalizedPath.startsWith("../")
    ) {
      throw new Error(
        `Ungültiger Repository-Pfad: ${candidatePath}`,
      );
    }

    if (!availablePaths.has(normalizedPath)) {
      throw new Error(
        `Datei gehört nicht zum sicheren Repository-Scan: ${normalizedPath}`,
      );
    }

    if (!selectedPaths.includes(normalizedPath)) {
      selectedPaths.push(normalizedPath);
    }
  }

  return Object.freeze({
    ...workOrder,
    status: "files-selected",
    relevantFiles: Object.freeze(selectedPaths),
  });
}
