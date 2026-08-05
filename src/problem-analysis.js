export const problemAnalysisSchema =
  Object.freeze({
    type: "object",
    additionalProperties: false,
    properties: {
      problem: {
        type: "string",
      },
      goal: {
        type: "string",
      },
      searchTerms: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: {
          type: "string",
        },
      },
      sourceHints: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: {
          type: "string",
        },
      },
      validationScripts: {
        type: "array",
        maxItems: 6,
        items: {
          type: "string",

        },
      },
    },
    required: [
      "problem",
      "goal",
      "searchTerms",
      "sourceHints",
      "validationScripts",
    ],
  });

function requireText(
  value,
  fieldName,
  maximumLength,
) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `${fieldName} fehlt in der Modellantwort.`,
    );
  }

  const normalizedValue =
    value.trim();

  if (
    normalizedValue.length >
    maximumLength
  ) {
    throw new Error(
      `${fieldName} ist in der Modellantwort zu lang.`,
    );
  }

  return normalizedValue;
}

function normalizeTextArray(
  value,
  fieldName,
  {
    minimumItems,
    maximumItems,
    maximumItemLength,
    pattern,
  },
) {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems
  ) {
    throw new Error(
      `${fieldName} hat eine ungültige Anzahl von Einträgen.`,
    );
  }

  const normalizedValues = [];

  for (const item of value) {
    const normalizedItem =
      requireText(
        item,
        fieldName,
        maximumItemLength,
      );

    if (
      pattern &&
      !pattern.test(normalizedItem)
    ) {
      throw new Error(
        `${fieldName} enthält einen ungültigen Eintrag.`,
      );
    }

    if (
      !normalizedValues.includes(
        normalizedItem,
      )
    ) {
      normalizedValues.push(
        normalizedItem,
      );
    }
  }

  return normalizedValues;
}

export function validateProblemAnalysis(
  modelData,
  project,
) {
  if (
    !modelData ||
    typeof modelData !== "object" ||
    Array.isArray(modelData)
  ) {
    throw new Error(
      "Die Modellantwort enthält keine Problemanalyse.",
    );
  }

  if (
    !project ||
    !project.scripts ||
    typeof project.scripts !== "object"
  ) {
    throw new Error(
      "Die Problemanalyse benötigt eine gültige Projekterkennung.",
    );
  }

  const problem = requireText(
    modelData.problem,
    "Problem",
    2000,
  );

  const goal = requireText(
    modelData.goal,
    "Ziel",
    2000,
  );

  const searchTerms =
    normalizeTextArray(
      modelData.searchTerms,
      "Suchbegriffe",
      {
        minimumItems: 1,
        maximumItems: 12,
        maximumItemLength: 80,
      },
    );

  const sourceHints =
    normalizeTextArray(
      modelData.sourceHints,
      "Quellcodehinweise",
      {
        minimumItems: 1,
        maximumItems: 12,
        maximumItemLength: 120,
      },
    );

  const suggestedValidationScripts =
    normalizeTextArray(
      modelData.validationScripts,
      "Validierungsskripte",
      {
        minimumItems: 0,
        maximumItems: 6,
        maximumItemLength: 80,
        pattern:
          /^[a-zA-Z0-9:_-]+$/,
      },
    );

  const availableScripts =
    new Set(
      Object.keys(project.scripts),
    );

  let validationScripts =
    suggestedValidationScripts.filter(
      (scriptName) =>
        availableScripts.has(
          scriptName,
        ),
    );

  if (validationScripts.length === 0) {
    const fallbackOrder = [
      "test",
      "check",
      "build",
      "lint",
    ];

    validationScripts =
      fallbackOrder.filter(
        (scriptName) =>
          availableScripts.has(
            scriptName,
          ),
      );
  }

  if (validationScripts.length === 0) {
    throw new Error(
      "Das Projekt besitzt kein geeignetes Validierungsskript.",
    );
  }

  return Object.freeze({
    problem,
    goal,
    searchTerms:
      Object.freeze(searchTerms),
    sourceHints:
      Object.freeze(sourceHints),
    validationScripts:
      Object.freeze(
        validationScripts,
      ),
  });
}

export async function analyzeProblem(
  {
    problem,
    project,
  },
  ollamaClient,
) {
  const normalizedProblem =
    requireText(
      problem,
      "Problembeschreibung",
      4000,
    );

  if (
    !ollamaClient ||
    typeof ollamaClient.generateStructured !==
      "function"
  ) {
    throw new TypeError(
      "Ein lokaler Ollama-Client wird benötigt.",
    );
  }

  const availableScripts =
    Object.keys(
      project.scripts || {},
    );

  const response =
    await ollamaClient.generateStructured({
      system: [
        "Du analysierst Probleme in Software-Repositories.",
        "Erzeuge nur Suchbegriffe und unverbindliche Quellcodehinweise.",
        "Behaupte niemals, dass eine Datei tatsächlich existiert.",
        "Nenne keine MIME-Typen oder Bilddateiformate als Quellcodedateien.",
        "Nutze ausschließlich die genannten package.json-Skripte.",
      ].join(" "),
      prompt: [
        `Problem: ${normalizedProblem}`,
        `Projekttyp: ${project.type}`,
        `Verfügbare Skripte: ${availableScripts.join(", ") || "(keine)"}`,
      ].join("\n"),
      schema:
        problemAnalysisSchema,
      maximumOutputTokens: 500,
    });

  return Object.freeze({
    analysis:
      validateProblemAnalysis(
        response.data,
        project,
      ),
    metrics: response.metrics,
  });
}
