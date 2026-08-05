export const commitPlanLimits = Object.freeze({
  maximumMessageLength: 72,
});

const conventionalCommitPattern =
  /^(feat|fix|docs|refactor|test|chore|build|ci|perf|style)(\([a-z0-9_-]+\))?!?: .+/;

export function createCommitPlan(
  validatedWorkOrder,
  {
    message,
    gitStatus,
    changedFiles,
  },
) {
  if (
    !validatedWorkOrder ||
    validatedWorkOrder.status !== "validated"
  ) {
    throw new Error(
      "Ein Commit-Plan benötigt einen erfolgreich validierten Arbeitsauftrag.",
    );
  }

  if (
    !Array.isArray(
      validatedWorkOrder.appliedFiles,
    ) ||
    validatedWorkOrder.appliedFiles.length === 0
  ) {
    throw new Error(
      "Der validierte Arbeitsauftrag enthält keine geänderten Dateien.",
    );
  }

  if (
    typeof message !== "string" ||
    message.trim().length === 0
  ) {
    throw new TypeError(
      "Eine Commit-Nachricht wird benötigt.",
    );
  }

  const normalizedMessage = message.trim();

  if (
    normalizedMessage.includes("\n") ||
    normalizedMessage.includes("\r")
  ) {
    throw new Error(
      "Die Commit-Nachricht darf nur eine Zeile enthalten.",
    );
  }

  if (
    normalizedMessage.length >
    commitPlanLimits.maximumMessageLength
  ) {
    throw new RangeError(
      `Die Commit-Nachricht darf höchstens ${commitPlanLimits.maximumMessageLength} Zeichen enthalten.`,
    );
  }

  if (
    !conventionalCommitPattern.test(
      normalizedMessage,
    )
  ) {
    throw new Error(
      "Die Commit-Nachricht muss dem Format „fix: Beschreibung“ entsprechen.",
    );
  }

  if (
    !gitStatus ||
    typeof gitStatus.branch !== "string" ||
    gitStatus.branch.length === 0 ||
    gitStatus.branch === "(kein Branch)"
  ) {
    throw new Error(
      "Ein Commit benötigt einen gültigen Git-Branch.",
    );
  }

  if (
    !Array.isArray(changedFiles)
  ) {
    throw new TypeError(
      "Der Commit-Plan benötigt einen strukturierten Git-Status.",
    );
  }

  const expectedFiles = new Set(
    validatedWorkOrder.appliedFiles,
  );

  if (
    changedFiles.length !==
    expectedFiles.size
  ) {
    throw new Error(
      "Git enthält unerwartete Änderungen außerhalb des Arbeitsauftrags.",
    );
  }

  for (const change of changedFiles) {
    if (
      change.status !== " M" ||
      !expectedFiles.has(change.file)
    ) {
      throw new Error(
        `Nicht freigegebene Git-Änderung: ${change.status} ${change.file}`,
      );
    }
  }

  return Object.freeze({
    status: "ready-to-commit",
    workOrderId: validatedWorkOrder.id,
    repositoryPath:
      validatedWorkOrder.repositoryPath,
    branch: gitStatus.branch,
    remoteUrl:
      gitStatus.remoteUrl || null,
    message: normalizedMessage,
    files: Object.freeze([
      ...expectedFiles,
    ]),
  });
}
