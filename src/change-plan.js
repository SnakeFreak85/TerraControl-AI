export const changePlanLimits = Object.freeze({
  maximumChanges: 20,
  maximumObjectiveLength: 2000,
});

function requireText(value, fieldName) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new TypeError(
      `${fieldName} muss eine nicht leere Zeichenkette sein.`,
    );
  }

  return value.trim();
}

export function createChangePlan(
  workOrder,
  {
    changes,
    validationScripts = [],
  },
  project,
) {
  if (
    !workOrder ||
    workOrder.status !== "files-selected"
  ) {
    throw new Error(
      "Ein Änderungsplan benötigt einen Arbeitsauftrag mit ausgewählten Dateien.",
    );
  }

  if (
    !Array.isArray(changes) ||
    changes.length === 0
  ) {
    throw new TypeError(
      "Der Änderungsplan benötigt mindestens eine Änderung.",
    );
  }

  if (
    changes.length >
    changePlanLimits.maximumChanges
  ) {
    throw new RangeError(
      `Ein Plan darf höchstens ${changePlanLimits.maximumChanges} Änderungen enthalten.`,
    );
  }

  if (
    !project ||
    !project.scripts ||
    typeof project.scripts !== "object"
  ) {
    throw new TypeError(
      "Der Änderungsplan benötigt eine gültige Projekterkennung.",
    );
  }

  const relevantFiles = new Set(
    workOrder.relevantFiles,
  );

  const plannedFiles = new Set();

  const normalizedChanges = changes.map(
    (change) => {
      if (
        !change ||
        typeof change !== "object"
      ) {
        throw new TypeError(
          "Jede geplante Änderung muss ein Objekt sein.",
        );
      }

      const file = requireText(
        change.file,
        "Dateipfad",
      );

      if (!relevantFiles.has(file)) {
        throw new Error(
          `Geplante Datei wurde nicht als relevant ausgewählt: ${file}`,
        );
      }

      if (plannedFiles.has(file)) {
        throw new Error(
          `Eine Datei darf nur einmal im Änderungsplan vorkommen: ${file}`,
        );
      }

      plannedFiles.add(file);

      const objective = requireText(
        change.objective,
        "Änderungsziel",
      );

      if (
        objective.length >
        changePlanLimits.maximumObjectiveLength
      ) {
        throw new RangeError(
          `Das Änderungsziel darf höchstens ${changePlanLimits.maximumObjectiveLength} Zeichen enthalten.`,
        );
      }

      const reason = requireText(
        change.reason,
        "Begründung",
      );

      return Object.freeze({
        file,
        objective,
        reason,
      });
    },
  );

  if (!Array.isArray(validationScripts)) {
    throw new TypeError(
      "validationScripts muss ein Array sein.",
    );
  }

  const normalizedValidationScripts = [
    ...new Set(
      validationScripts.map((scriptName) =>
        requireText(
          scriptName,
          "Validierungsskript",
        ),
      ),
    ),
  ];

  for (
    const scriptName of normalizedValidationScripts
  ) {
    if (
      !Object.hasOwn(project.scripts, scriptName)
    ) {
      throw new Error(
        `Unbekanntes Validierungsskript: ${scriptName}`,
      );
    }
  }

  return Object.freeze({
    ...workOrder,
    status: "planned",
    plannedChanges: Object.freeze(
      normalizedChanges,
    ),
    validationScripts: Object.freeze(
      normalizedValidationScripts,
    ),
  });
}
