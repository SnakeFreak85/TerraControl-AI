import { randomUUID } from "node:crypto";
import path from "node:path";

export const workOrderLimits = Object.freeze({
  maximumProblemLength: 4000,
});

export function createWorkOrder(
  {
    problem,
    repositoryPath,
  },
  {
    idFactory = randomUUID,
    clock = () => new Date(),
  } = {},
) {
  if (
    typeof problem !== "string" ||
    problem.trim().length === 0
  ) {
    throw new TypeError(
      "Der Arbeitsauftrag benötigt eine Problembeschreibung.",
    );
  }

  const normalizedProblem = problem.trim();

  if (
    normalizedProblem.length >
    workOrderLimits.maximumProblemLength
  ) {
    throw new RangeError(
      `Die Problembeschreibung darf höchstens ${workOrderLimits.maximumProblemLength} Zeichen enthalten.`,
    );
  }

  if (
    typeof repositoryPath !== "string" ||
    repositoryPath.trim().length === 0
  ) {
    throw new TypeError(
      "Der Arbeitsauftrag benötigt einen Repository-Pfad.",
    );
  }

  const id = idFactory();
  const createdAt = clock();

  if (
    typeof id !== "string" ||
    id.length === 0
  ) {
    throw new Error(
      "Für den Arbeitsauftrag konnte keine ID erzeugt werden.",
    );
  }

  if (
    !(createdAt instanceof Date) ||
    Number.isNaN(createdAt.getTime())
  ) {
    throw new Error(
      "Für den Arbeitsauftrag konnte kein gültiger Zeitpunkt erzeugt werden.",
    );
  }

  return Object.freeze({
    id,
    problem: normalizedProblem,
    repositoryPath: path.resolve(repositoryPath),
    status: "created",
    relevantFiles: Object.freeze([]),
    plannedChanges: Object.freeze([]),
    createdAt: createdAt.toISOString(),
  });
}
