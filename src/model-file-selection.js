function createFileSelectionSchema(
  candidatePaths,
) {
  return Object.freeze({
    type: "object",
    additionalProperties: false,
    properties: {
      selectedFiles: {
        type: "array",
        minItems: 1,
        maxItems:
          candidatePaths.length,
        items: {
          type: "object",
          additionalProperties:
            false,
          properties: {
            path: {
              type: "string",
              enum: candidatePaths,
            },
            objective: {
              type: "string",
              minLength: 1,
              maxLength: 1000,
            },
            reason: {
              type: "string",
              minLength: 1,
              maxLength: 1000,
            },
          },
          required: [
            "path",
            "objective",
            "reason",
          ],
        },
      },
    },
    required: ["selectedFiles"],
  });
}

function requireText(
  value,
  fieldName,
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `${fieldName} fehlt in der Dateiauswahl.`,
    );
  }

  return value.trim();
}

export function validateModelFileSelection(
  modelData,
  candidateContext,
) {
  if (
    !modelData ||
    !Array.isArray(
      modelData.selectedFiles,
    ) ||
    modelData.selectedFiles.length === 0
  ) {
    throw new Error(
      "Das Modell hat keine Datei ausgewählt.",
    );
  }

  const allowedPaths = new Set(
    candidateContext.entries.map(
      (entry) => entry.path,
    ),
  );

  if (
    modelData.selectedFiles.length >
    allowedPaths.size
  ) {
    throw new Error(
      "Das Modell hat zu viele Dateien ausgewählt.",
    );
  }

  const selectedPaths = new Set();

  const selectedFiles =
    modelData.selectedFiles.map(
      (selection) => {
        if (
          !selection ||
          typeof selection !==
            "object"
        ) {
          throw new Error(
            "Die Modelldateiauswahl enthält einen ungültigen Eintrag.",
          );
        }

        const filePath = requireText(
          selection.path,
          "Dateipfad",
        );

        if (
          !allowedPaths.has(filePath)
        ) {
          throw new Error(
            `Das Modell hat eine nicht erlaubte Datei ausgewählt: ${filePath}`,
          );
        }

        if (
          selectedPaths.has(filePath)
        ) {
          throw new Error(
            `Das Modell hat eine Datei doppelt ausgewählt: ${filePath}`,
          );
        }

        selectedPaths.add(filePath);

        return Object.freeze({
          path: filePath,
          objective: requireText(
            selection.objective,
            "Änderungsziel",
          ),
          reason: requireText(
            selection.reason,
            "Begründung",
          ),
        });
      },
    );

  return Object.freeze(
    selectedFiles,
  );
}

export async function selectFilesWithModel(
  {
    analysis,
    candidateContext,
  },
  ollamaClient,
) {
  if (
    !candidateContext ||
    !Array.isArray(
      candidateContext.entries,
    ) ||
    candidateContext.entries.length === 0
  ) {
    throw new Error(
      "Für die Modelldateiauswahl fehlen reale Kandidaten.",
    );
  }

  const candidatePaths =
    candidateContext.entries.map(
      (entry) => entry.path,
    );

  const schema =
    createFileSelectionSchema(
      candidatePaths,
    );

  const response =
    await ollamaClient.generateStructured({
      system: [
        "Du wählst relevante Dateien für einen Software-Fix aus.",
        "Du darfst ausschließlich Pfade aus der bereitgestellten Kandidatenliste verwenden.",
        "Wähle nur Dateien, die wahrscheinlich wirklich geändert werden müssen.",
        "Ein Problem bleibt ein gemeinsamer Arbeitsauftrag über alle ausgewählten Dateien.",
      ].join(" "),
      prompt: [
        `Problem: ${analysis.problem}`,
        `Ziel: ${analysis.goal}`,
        "",
        "Reale Repository-Kandidaten:",
        candidateContext.promptText,
      ].join("\n"),
      schema,
      maximumOutputTokens: 800,
    });

  const selectedFiles =
    validateModelFileSelection(
      response.data,
      candidateContext,
    );

  return Object.freeze({
    selectedFiles,
    metrics: response.metrics,
  });
}
